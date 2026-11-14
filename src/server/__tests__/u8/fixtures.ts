/**
 * Test data builders for U8's server tests (not a test file itself). Each test file sets DB_FILE=':memory:'
 * before its imports, then calls freshApp() in beforeEach. Times can be written in both stored formats:
 * v1's "YYYY-MM-DD HH:MM:SS" (UTC, no zone marker) and v2's ISO text, through localSqlite and localIso.
 */
import { getDb, nextOrderNumber, openVisit } from '../../db.js';

export { cleanup, freshApp, localIso, localSqlite, makeClosedVisit } from '../u7/setup.js';

export type FixtureStatus = 'Pending' | 'Preparing' | 'Completed' | 'Cancelled';

export interface FixtureLine {
  item_id: string;
  quantity: number;
  unit_price_cents: number;
}

export const line = (item_id: string, quantity: number, unit_price_cents: number): FixtureLine => ({ item_id, quantity, unit_price_cents });

let keyCounter = 0;

/** Writes one order with the given status, time and lines into a visit. Returns its order number. */
export function addOrder(
  visitId: string,
  tableId: number,
  order: { status?: FixtureStatus; placedAt: string; completedAt?: string | null; lines: FixtureLine[] }
): number {
  const db = getDb();
  const number = nextOrderNumber();
  const id = db
    .prepare(
      `INSERT INTO orders (order_number, visit_id, table_id, status, placed_by, placement_key, placed_at, completed_at)
       VALUES (?, ?, ?, ?, 'diner', ?, ?, ?)`
    )
    .run(number, visitId, tableId, order.status ?? 'Pending', `u8-${++keyCounter}`, order.placedAt, order.completedAt ?? null).lastInsertRowid;
  const insertLine = db.prepare('INSERT INTO order_items (order_id, item_id, quantity, unit_price_cents, station) VALUES (?, ?, ?, ?, ?)');
  for (const l of order.lines) insertLine.run(id, l.item_id, l.quantity, l.unit_price_cents, 'Grill');
  return number;
}

/** Opens a visit at the table (it stays open). Returns its id. */
export function openTable(tableId: number): string {
  return openVisit(tableId);
}

/** Writes a service call; `respondedAt` null keeps it open. Returns its id. */
export function addCall(visitId: string, tableId: number, kind: 'waiter' | 'bill', openedAt: string, respondedAt: string | null = null): string {
  const id = `call-${++keyCounter}`;
  getDb()
    .prepare('INSERT INTO service_calls (id, visit_id, table_id, kind, opened_at, responded_at) VALUES (?, ?, ?, ?, ?, ?)')
    .run(id, visitId, tableId, kind, openedAt, respondedAt);
  return id;
}
