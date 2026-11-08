// U5 Step 8: WaitEstimation (BR4.1), "Running late" (BR4.2) and stored times (BR11.6).
process.env.DB_FILE = ':memory:';

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getDb, resetDb, seedIfEmpty, openVisit, nextOrderNumber } from '../../db.js';
import { computeEstimate } from '../../services/waitEstimation.js';
import { localDayBounds, minutesBetween, parseStoredTime, toIso } from '../../time.js';
import { waitDisplay } from '../../../shared/wait.js';

// A local time on a fixed day, so "today" is the same whatever the machine's zone is.
const local = (h: number, m = 0, day = 8) => new Date(2026, 10, day, h, m, 0, 0);
/** The database's datetime('now') text: UTC with no zone marker. */
const sqliteText = (d: Date) => d.toISOString().slice(0, 19).replace('T', ' ');
const NOW = local(14, 0);

let visit: string;
function addOrder(status: string, placed: string, completed: string | null) {
  getDb()
    .prepare(
      `INSERT INTO orders (order_number, visit_id, table_id, status, placement_key, placed_at, completed_at)
       VALUES (?, ?, 1, ?, ?, ?, ?)`
    )
    .run(nextOrderNumber(), visit, status, `k-${Math.random()}`, placed, completed);
}
/** A Completed order that took `minutes`, placed `agoMinutes` before NOW. */
function completedOrder(minutes: number, placedAt: Date, format: 'iso' | 'sqlite' = 'iso') {
  const done = new Date(placedAt.getTime() + minutes * 60_000);
  addOrder(
    'Completed',
    format === 'iso' ? placedAt.toISOString() : sqliteText(placedAt),
    format === 'iso' ? done.toISOString() : sqliteText(done)
  );
}

describe('WaitEstimation', () => {
  beforeEach(() => {
    resetDb();
    seedIfEmpty();
    visit = openVisit(1);
  });
  afterEach(() => {
    resetDb();
  });

  it('with no completed order today the average is 15 and the basis is "default"', () => {
    expect(computeEstimate(NOW)).toEqual({ estimate_minutes: 15, basis: 'default', open_orders: 0 });
  });

  it('is the average of today\'s placed-to-Completed minutes', () => {
    completedOrder(10, local(9));
    completedOrder(20, local(10));
    expect(computeEstimate(NOW)).toEqual({ estimate_minutes: 15, basis: 'today', open_orders: 0 });
    completedOrder(30, local(11));
    expect(computeEstimate(NOW).estimate_minutes).toBe(20);
  });

  it('adds 2 minutes for every Pending or Preparing order', () => {
    addOrder('Pending', local(13, 50).toISOString(), null);
    addOrder('Preparing', local(13, 55).toISOString(), null);
    addOrder('Preparing', local(13, 56).toISOString(), null);
    expect(computeEstimate(NOW)).toEqual({ estimate_minutes: 21, basis: 'default', open_orders: 3 }); // 15 + 3 x 2
    completedOrder(10, local(9));
    expect(computeEstimate(NOW)).toEqual({ estimate_minutes: 16, basis: 'today', open_orders: 3 }); // 10 + 6
  });

  it('reads both stored time formats: ISO text and the database\'s date-time text', () => {
    completedOrder(10, local(9), 'iso');
    completedOrder(20, local(10), 'sqlite');
    expect(computeEstimate(NOW)).toMatchObject({ estimate_minutes: 15, basis: 'today' });
    // The date-time text is UTC: read as local time it would be hours off and give a wrong average
    completedOrder(30, local(11), 'sqlite');
    expect(computeEstimate(NOW).estimate_minutes).toBe(20);
  });

  it('leaves out Cancelled orders, orders with no completed_at, and orders from other days', () => {
    completedOrder(10, local(9));
    addOrder('Cancelled', local(9, 30).toISOString(), local(10, 30).toISOString()); // 60 min, must not count
    addOrder('Completed', local(10).toISOString(), null); // a v1-era order: no completed time
    completedOrder(50, local(9, 0, 7)); // yesterday
    completedOrder(50, local(9, 0, 9)); // tomorrow
    expect(computeEstimate(NOW)).toEqual({ estimate_minutes: 10, basis: 'today', open_orders: 0 });
  });

  it('is never below 1 minute and is rounded', () => {
    completedOrder(0, local(9));
    expect(computeEstimate(NOW).estimate_minutes).toBe(1);
    completedOrder(1, local(10)); // average 0.5 minutes
    expect(computeEstimate(NOW).estimate_minutes).toBe(1);
    completedOrder(4, local(11)); // average 1.67
    expect(computeEstimate(NOW).estimate_minutes).toBe(2);
  });

  it('ignores a time that cannot be read and a clock that went backwards', () => {
    completedOrder(10, local(9));
    addOrder('Completed', 'not a time', 'also not');
    addOrder('Completed', local(11).toISOString(), local(10).toISOString());
    expect(computeEstimate(NOW).estimate_minutes).toBe(10);
  });
});

describe('"Running late" (BR4.2)', () => {
  const placed = '2026-11-08T12:00:00.000Z';
  const at = (minutes: number, seconds = 0) => new Date(Date.parse(placed) + minutes * 60_000 + seconds * 1000);

  it('shows the time left: the estimate minus whole minutes elapsed, at least 1', () => {
    expect(waitDisplay(placed, 15, at(0))).toEqual({ kind: 'remaining', minutes: 15 });
    expect(waitDisplay(placed, 15, at(4, 59))).toEqual({ kind: 'remaining', minutes: 11 }); // 4 whole minutes elapsed
    expect(waitDisplay(placed, 15, at(15))).toEqual({ kind: 'remaining', minutes: 1 }); // exactly the estimate: not late yet
  });

  it('is late once the wait is more than the estimate, never a zero or negative time', () => {
    expect(waitDisplay(placed, 15, at(16))).toEqual({ kind: 'late' });
    expect(waitDisplay(placed, 15, at(300))).toEqual({ kind: 'late' });
  });

  it('shows no time for an order with no stored estimate or an unreadable placed time', () => {
    expect(waitDisplay(placed, null, at(5))).toEqual({ kind: 'none' });
    expect(waitDisplay(placed, undefined, at(5))).toEqual({ kind: 'none' });
    expect(waitDisplay('garbage', 10, at(5))).toEqual({ kind: 'none' });
  });

  it('reads the database\'s date-time text as UTC', () => {
    expect(waitDisplay('2026-11-08 12:00:00', 15, at(5))).toEqual({ kind: 'remaining', minutes: 10 });
  });
});

describe('stored times (BR11.6)', () => {
  it('reads ISO text and date-time text as the same UTC instant', () => {
    const a = parseStoredTime('2026-11-08T12:00:00.000Z')!;
    const b = parseStoredTime('2026-11-08 12:00:00')!;
    expect(b.getTime()).toBe(a.getTime());
    expect(parseStoredTime('2026-11-08T12:00:00+02:00')!.toISOString()).toBe('2026-11-08T10:00:00.000Z');
    expect(parseStoredTime('2026-11-08 12:00:00.250')!.getTime()).toBe(a.getTime() + 250);
  });

  it('answers null, never an invalid date, for anything that is not a time', () => {
    for (const bad of ['', '   ', 'yesterday', null, undefined, '2026-13-45 99:99:99']) {
      expect(parseStoredTime(bad as string)).toBeNull();
    }
  });

  it('writes ISO 8601 UTC text, and works out the server\'s local day', () => {
    expect(toIso(new Date('2026-11-08T12:00:00Z'))).toBe('2026-11-08T12:00:00.000Z');
    const { start, end } = localDayBounds(local(14, 30));
    expect(start.getTime()).toBe(local(0).getTime());
    expect(end.getTime()).toBe(local(0, 0, 9).getTime());
    expect(minutesBetween(local(10), local(10, 30))).toBe(30);
  });
});
