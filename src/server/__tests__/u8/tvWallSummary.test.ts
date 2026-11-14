// U8 Step 6: the show-takings setting and the TV wall summary (BR1.1, BR1.3, BR2.1 to BR2.5, BR3.1 to BR3.3,
// BR4.1, BR4.2, AC3.1.2, NFR6, plan R-02).
process.env.DB_FILE = ':memory:';

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getDb } from '../../db.js';
import { getSales } from '../../routes/u7/sales.js';
import { getShowTakings, getTvSettings, setShowTakings } from '../../tvSettings.js';
import { buildTvSummary } from '../../tvWallSummary.js';
import { addCall, addOrder, cleanup, freshApp, line, localIso, localSqlite, makeClosedVisit, openTable } from './fixtures.js';

/** "Now" is 14:00 local on 10 November 2026, so day-boundary cases are exact on any machine. */
const NOW = new Date(2026, 10, 10, 14, 0, 0, 0);
const TODAY = '2026-11-10';

describe('the show-takings setting (BR1.1, BR1.3)', () => {
  beforeEach(freshApp);
  afterEach(cleanup);

  it('reads hidden with no row, saves a change with its time, and keeps it', () => {
    expect(getTvSettings()).toEqual({ show_takings: false, updated_at: null });
    expect(getShowTakings()).toBe(false);
    const first = setShowTakings(true, NOW);
    expect(first).toEqual({ changed: true, settings: { show_takings: true, updated_at: NOW.toISOString() } });
    expect(getTvSettings()).toEqual({ show_takings: true, updated_at: NOW.toISOString() });
    const later = new Date(NOW.getTime() + 60_000);
    expect(setShowTakings(false, later)).toEqual({ changed: true, settings: { show_takings: false, updated_at: later.toISOString() } });
    expect(getDb().prepare('SELECT COUNT(*) AS n FROM tv_settings').get()).toEqual({ n: 1 }); // one row at most
  });

  it('the same value again saves nothing and keeps updated_at', () => {
    setShowTakings(true, NOW);
    expect(setShowTakings(true, new Date(NOW.getTime() + 5_000))).toEqual({ changed: false, settings: { show_takings: true, updated_at: NOW.toISOString() } });
    // false while there is no row is also "unchanged": nothing is written
    getDb().exec('DELETE FROM tv_settings');
    expect(setShowTakings(false, NOW)).toEqual({ changed: false, settings: { show_takings: false, updated_at: null } });
    expect(getDb().prepare('SELECT COUNT(*) AS n FROM tv_settings').get()).toEqual({ n: 0 });
  });
});

describe('the TV wall summary (C1)', () => {
  beforeEach(freshApp);
  afterEach(cleanup);

  it('while takings are hidden the answer has no takings key at all (BR3.3)', () => {
    makeClosedVisit(1, localIso(2026, 11, 10, 12), [{ placedAt: localIso(2026, 11, 10, 11), lines: [line('i-04', 1, 1450)] }]);
    const summary = buildTvSummary(NOW);
    expect(summary.show_takings).toBe(false);
    expect('takings' in summary).toBe(false);
    expect(JSON.stringify(summary)).not.toMatch(/cents/);
  });

  it("today's takings equal the Sales page's total for today: one table closed today, one yesterday, both formats near midnight (AC3.1.2)", () => {
    setShowTakings(true, NOW);
    makeClosedVisit(1, localSqlite(2026, 11, 10, 0, 5), [{ placedAt: localSqlite(2026, 11, 9, 23, 40), lines: [line('i-04', 2, 1450)] }]); // today, v1 text
    makeClosedVisit(2, localIso(2026, 11, 10, 12, 30), [
      { placedAt: localIso(2026, 11, 10, 12), lines: [line('i-10', 3, 350)] },
      { status: 'Cancelled', placedAt: localIso(2026, 11, 10, 12, 5), lines: [line('i-05', 1, 1850)] },
      { placedAt: localIso(2026, 11, 10, 12, 10), lines: [] },
    ]); // today, ISO
    makeClosedVisit(3, localSqlite(2026, 11, 9, 23, 55), [{ placedAt: localSqlite(2026, 11, 9, 23, 30), lines: [line('i-08', 4, 950)] }]); // yesterday
    makeClosedVisit(4, localIso(2026, 11, 9, 23, 59), [{ placedAt: localIso(2026, 11, 9, 23, 0), lines: [line('i-08', 1, 950)] }]); // yesterday
    const t5 = openTable(5);
    addOrder(t5, 5, { placedAt: localIso(2026, 11, 10, 13), lines: [line('i-02', 2, 850)] }); // still open

    const salesToday = getSales({ from: TODAY, to: TODAY })[0];
    const summary = buildTvSummary(NOW);
    expect(salesToday.total_cents).toBe(2900 + 1050);
    expect(summary.takings).toEqual({ closed_cents: salesToday.total_cents, open_cents: 1700 });
  });

  it('zero amounts are 0, not missing, and empty parts read null or []', () => {
    setShowTakings(true, NOW);
    const summary = buildTvSummary(NOW);
    expect(summary).toEqual({
      server_time: NOW.toISOString(),
      day: TODAY,
      day_ends_at: new Date(2026, 10, 11, 0, 0, 0, 0).toISOString(),
      show_takings: true,
      orders: [],
      takings: { closed_cents: 0, open_cents: 0 },
      busiest_table: null,
      top_dish: null,
      requests: [],
    });
  });

  it('lists open orders oldest first with their portions, any day, with placed_at as ISO whatever the stored format', () => {
    const t2 = openTable(2);
    const old = addOrder(t2, 2, { status: 'Preparing', placedAt: localSqlite(2026, 11, 9, 22, 0), lines: [line('i-04', 1, 1450), line('i-10', 2, 350)] });
    const fresh = addOrder(t2, 2, { placedAt: localIso(2026, 11, 10, 13, 50), lines: [] });
    expect(buildTvSummary(NOW).orders).toEqual([
      { order_number: old, table_id: 2, status: 'Preparing', placed_at: new Date(2026, 10, 9, 22, 0).toISOString(), portions: 3 },
      { order_number: fresh, table_id: 2, status: 'Pending', placed_at: new Date(2026, 10, 10, 13, 50).toISOString(), portions: 0 },
    ]);
  });

  it('the busiest table and the top dish follow their tie-breaks, and open requests are listed oldest first', () => {
    const t7 = openTable(7);
    const t3 = openTable(3);
    addOrder(t7, 7, { placedAt: localIso(2026, 11, 10, 10), lines: [line('i-12', 2, 400)] });
    addOrder(t3, 3, { placedAt: localIso(2026, 11, 10, 10, 5), lines: [line('i-08', 2, 950)] });
    addOrder(t3, 3, { status: 'Cancelled', placedAt: localIso(2026, 11, 10, 10, 6), lines: [line('i-12', 9, 400)] });
    makeClosedVisit(4, localIso(2026, 11, 9, 21), [{ placedAt: localIso(2026, 11, 9, 20), lines: [line('i-12', 9, 400)] }, { placedAt: localIso(2026, 11, 9, 20, 5), lines: [] }]); // yesterday
    const second = addCall(t7, 7, 'bill', '2026-11-10T13:10:00.000Z');
    const first = addCall(t3, 3, 'waiter', '2026-11-10T13:00:00.000Z');

    const summary = buildTvSummary(NOW);
    expect(summary.busiest_table).toEqual({ table_id: 3, orders: 1 }); // 1 each: the lower table_id wins
    expect(summary.top_dish).toEqual({ item_id: 'i-08', name: 'Chocolate Fondant', portions: 2 }); // 2 each: the name first in the alphabet
    expect(summary.requests.map((r) => r.call_id)).toEqual([first, second]);
  });

  it('day_ends_at is the server\'s next local midnight, also late in the evening and at the end of a month', () => {
    expect(buildTvSummary(new Date(2026, 10, 10, 23, 59, 30)).day_ends_at).toBe(new Date(2026, 10, 11).toISOString());
    const endOfMonth = buildTvSummary(new Date(2026, 10, 30, 8, 0));
    expect(endOfMonth.day).toBe('2026-11-30');
    expect(endOfMonth.day_ends_at).toBe(new Date(2026, 11, 1).toISOString());
  });

  it('NFR6: with 10,000 past closed visits it still answers in under 300 ms', () => {
    setShowTakings(true, NOW);
    const db = getDb();
    const insertVisit = db.prepare('INSERT INTO visits (id, table_id, opened_at, closed_at) VALUES (?, ?, ?, ?)');
    const insertOrder = db.prepare(
      "INSERT INTO orders (order_number, visit_id, table_id, status, placed_by, placement_key, placed_at, completed_at) VALUES (?, ?, ?, 'Completed', 'diner', ?, ?, ?)"
    );
    const insertLine = db.prepare("INSERT INTO order_items (order_id, item_id, quantity, unit_price_cents, station) VALUES (?, ?, 2, 1450, 'Grill')");
    db.transaction(() => {
      for (let i = 0; i < 10_000; i++) {
        // Spread over the 400 days before yesterday, half in each stored format.
        const at = new Date(2026, 10, 8 - (i % 400), 12, i % 60);
        const text = i % 2 === 0 ? at.toISOString() : at.toISOString().replace('T', ' ').slice(0, 19);
        const table = (i % 10) + 1;
        insertVisit.run(`past-${i}`, table, text, text);
        const orderId = insertOrder.run(100_000 + i, `past-${i}`, table, `past-${i}`, text, text).lastInsertRowid;
        insertLine.run(orderId, 'i-04');
      }
    })();
    makeClosedVisit(1, localIso(2026, 11, 10, 12), [{ placedAt: localIso(2026, 11, 10, 11), lines: [line('i-04', 1, 1450)] }]);

    const started = performance.now();
    const summary = buildTvSummary(NOW);
    const elapsed = performance.now() - started;
    console.log(`NFR6: buildTvSummary with 10,000 past closed visits took ${elapsed.toFixed(1)} ms`);
    expect(summary.takings?.closed_cents).toBe(1450); // only today's visit counts
    expect(summary.busiest_table).toEqual({ table_id: 1, orders: 1 });
    expect(elapsed).toBeLessThan(300);
  });
});
