/**
 * Shared set-up for U7's server tests (not a test file itself). Each test file sets DB_FILE=':memory:'
 * before its imports, as the other server tests do, then calls freshApp() in beforeEach.
 */
import { getDb, nextOrderNumber, openVisit, resetDb, seedIfEmpty } from '../../db.js';
import { _resetForTest } from '../../sse.js';
import { resetStaffAccessForTest, resetLoginAttemptsForTest } from '../../staffAccess.js';
import { resetPresenceForTest } from '../../presence.js';
import { toIso } from '../../time.js';

/** A clean seeded database, no streams, no sessions, no presence. */
export function freshApp(): void {
  resetDb();
  seedIfEmpty();
  _resetForTest();
  resetStaffAccessForTest();
  resetPresenceForTest();
  resetLoginAttemptsForTest();
}

export function cleanup(): void {
  resetDb();
  resetStaffAccessForTest();
}

export interface ClosedOrderInput {
  status?: 'Completed' | 'Cancelled' | 'Pending' | 'Preparing';
  placedAt: string;
  completedAt?: string | null;
  lines: Array<{ item_id: string; quantity: number; unit_price_cents: number }>;
}

/**
 * Writes a closed visit with known times and prices straight into the database, so sales tests can use both
 * stored time formats ("2026-11-07 23:59:00" from v1, ISO from v2) and exact totals. Returns the visit id.
 */
export function makeClosedVisit(tableId: number, closedAt: string, orders: ClosedOrderInput[]): string {
  const db = getDb();
  const visitId = openVisit(tableId);
  orders.forEach((o, i) => {
    const number = nextOrderNumber();
    const id = db
      .prepare(
        `INSERT INTO orders (order_number, visit_id, table_id, status, placed_by, placement_key, placed_at, completed_at)
         VALUES (?, ?, ?, ?, 'diner', ?, ?, ?)`
      )
      .run(number, visitId, tableId, o.status ?? 'Completed', `closed-${visitId}-${i}`, o.placedAt, o.completedAt ?? null).lastInsertRowid;
    for (const l of o.lines) {
      db.prepare('INSERT INTO order_items (order_id, item_id, quantity, unit_price_cents, station) VALUES (?, ?, ?, ?, ?)').run(
        id,
        l.item_id,
        l.quantity,
        l.unit_price_cents,
        'Grill'
      );
    }
  });
  db.prepare('UPDATE visits SET closed_at = ? WHERE id = ?').run(closedAt, visitId);
  return visitId;
}

/** A local time on a given local day, as ISO text (so tests do not depend on the machine's time zone). */
export function localIso(year: number, month: number, day: number, hour: number, minute = 0): string {
  return toIso(new Date(year, month - 1, day, hour, minute, 0, 0));
}

/** The same local time in v1's database text form (UTC, no zone marker): "YYYY-MM-DD HH:MM:SS". */
export function localSqlite(year: number, month: number, day: number, hour: number, minute = 0): string {
  return toIso(new Date(year, month - 1, day, hour, minute, 0, 0)).replace('T', ' ').slice(0, 19);
}

export function addRating(visitId: string, itemId: string, thumb: 'up' | 'down', ratedAt: string): void {
  getDb().prepare('INSERT INTO dish_ratings (visit_id, item_id, thumb, rated_at, locked) VALUES (?, ?, ?, ?, 1)').run(visitId, itemId, thumb, ratedAt);
}
