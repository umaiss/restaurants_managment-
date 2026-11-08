/**
 * Service calls: "Call the waiter" and "Ask for the bill" (U5 Step 5).
 * Rules: BR6.1 (one open request per kind and visit, only with an open visit),
 * BR6.2 (staff respond), BR6.3 (closing a table clears its open requests).
 */
import { getDb, getCurrentVisit } from '../db.js';
import { AppError } from '../errors.js';
import { toIso } from '../time.js';

export type CallKind = 'waiter' | 'bill';

export interface ServiceCall {
  id: string;
  table_id: number;
  kind: CallKind;
  status: 'open' | 'responded';
  opened_at: string;
  responded_at: string | null;
}

interface Row {
  id: string;
  table_id: number;
  kind: CallKind;
  opened_at: string;
  responded_at: string | null;
}

const COLUMNS = 'id, table_id, kind, opened_at, responded_at';

function toCall(row: Row): ServiceCall {
  return { ...row, status: row.responded_at === null ? 'open' : 'responded' };
}

export function isCallKind(value: unknown): value is CallKind {
  return value === 'waiter' || value === 'bill';
}

function findOpen(visitId: string, kind: CallKind): Row | undefined {
  return getDb()
    .prepare(`SELECT ${COLUMNS} FROM service_calls WHERE visit_id = ? AND kind = ? AND responded_at IS NULL`)
    .get(visitId, kind) as Row | undefined;
}

/**
 * Opens a request. `created` is false when an open request of that kind already existed, which is
 * also the answer to two presses at the same moment: the unique index lets only one row in, and the
 * loser is given the existing request, never an error (BR6.1).
 */
export function openCall(tableId: number, kind: CallKind, now: Date = new Date()): { call: ServiceCall; created: boolean } {
  const db = getDb();
  const table = db.prepare('SELECT id FROM tables WHERE id = ?').get(tableId);
  if (!table) throw new AppError('UNKNOWN_TABLE', `Table ${tableId} not found`);

  const visit = getCurrentVisit(tableId);
  if (!visit) throw new AppError('NO_OPEN_VISIT', `Table ${tableId} has no open visit`);

  const existing = findOpen(visit.id, kind);
  if (existing) return { call: toCall(existing), created: false };

  const id = crypto.randomUUID();
  try {
    db.prepare(
      'INSERT INTO service_calls (id, visit_id, table_id, kind, opened_at, responded_at) VALUES (?, ?, ?, ?, ?, NULL)'
    ).run(id, visit.id, tableId, kind, toIso(now));
  } catch (err) {
    // The one-open-call index refused a second row: another press got in first.
    const winner = findOpen(visit.id, kind);
    if (winner && String((err as Error).message).includes('UNIQUE')) return { call: toCall(winner), created: false };
    throw err;
  }
  const row = db.prepare(`SELECT ${COLUMNS} FROM service_calls WHERE id = ?`).get(id) as Row;
  return { call: toCall(row), created: true };
}

/**
 * Staff respond (BR6.2). `changed` is false when the request was already answered: the answer is the
 * same and the caller publishes nothing. Throws UNKNOWN_CALL for an id that does not exist.
 */
export function respondCall(id: string, now: Date = new Date()): { call: ServiceCall; changed: boolean } {
  const db = getDb();
  const row = db.prepare(`SELECT ${COLUMNS} FROM service_calls WHERE id = ?`).get(id) as Row | undefined;
  if (!row) throw new AppError('UNKNOWN_CALL', `Call ${id} not found`);
  if (row.responded_at !== null) return { call: toCall(row), changed: false };

  const result = db
    .prepare('UPDATE service_calls SET responded_at = ? WHERE id = ? AND responded_at IS NULL')
    .run(toIso(now), id);
  const updated = db.prepare(`SELECT ${COLUMNS} FROM service_calls WHERE id = ?`).get(id) as Row;
  return { call: toCall(updated), changed: result.changes === 1 };
}

/** Open and answered requests of the table's current visit, oldest first. No open visit means none. */
export function listCalls(tableId: number): ServiceCall[] {
  const db = getDb();
  const table = db.prepare('SELECT id FROM tables WHERE id = ?').get(tableId);
  if (!table) throw new AppError('UNKNOWN_TABLE', `Table ${tableId} not found`);
  const visit = getCurrentVisit(tableId);
  if (!visit) return [];
  const rows = db
    .prepare(`SELECT ${COLUMNS} FROM service_calls WHERE visit_id = ? ORDER BY opened_at, rowid`)
    .all(visit.id) as Row[];
  return rows.map(toCall);
}

/** Marks every open request of a visit responded (BR6.3). Called inside the close transaction. */
export function clearOpenCalls(visitId: string, now: Date = new Date()): number {
  return getDb()
    .prepare('UPDATE service_calls SET responded_at = ? WHERE visit_id = ? AND responded_at IS NULL')
    .run(toIso(now), visitId).changes;
}
