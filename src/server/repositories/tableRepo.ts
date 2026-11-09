import { getDb, openVisit as dbOpenVisit, getCurrentVisit } from '../db.js';
import { AppError } from '../errors.js';
import { parseStoredTime, toIso } from '../time.js';

export interface TableStatus {
  id: number;
  visit_id: string | null;
  has_open_orders: boolean;
  has_any_orders: boolean;
  state: 'active' | 'closed';
  /** Id of the table's most recently closed visit; null if the table was never closed. */
  last_closed_visit_id: string | null;
}

/** True when a table with this id exists. */
export function tableExists(tableId: number): boolean {
  return getDb().prepare('SELECT 1 FROM tables WHERE id = ?').get(tableId) !== undefined;
}

/** The table's most recently closed visit (BR7.1 uses it for ratings), or null. */
export function getLastClosedVisitId(tableId: number): string | null {
  // Chosen by parsed time, not by comparing the text: v1 wrote "2026-11-05 12:00:00" and v2 writes ISO
  // "2026-11-05T12:00:00.000Z", and the two do not sort correctly against each other as text (BR11.6).
  // The row number breaks a tie.
  const rows = getDb()
    .prepare('SELECT id, closed_at, rowid AS rid FROM visits WHERE table_id = ? AND closed_at IS NOT NULL')
    .all(tableId) as Array<{ id: string; closed_at: string; rid: number }>;
  let best: { id: string; time: number; rid: number } | null = null;
  for (const row of rows) {
    const time = parseStoredTime(row.closed_at)?.getTime() ?? -Infinity;
    if (!best || time > best.time || (time === best.time && row.rid > best.rid)) best = { id: row.id, time, rid: row.rid };
  }
  return best?.id ?? null;
}

export function getTableStatus(tableId: number): TableStatus {
  const db = getDb();

  const table = db.prepare('SELECT id, status FROM tables WHERE id = ?').get(tableId) as
    | { id: number; status: string }
    | undefined;

  if (!table) {
    throw new Error(`Table ${tableId} not found`);
  }

  const visit = getCurrentVisit(tableId);

  if (!visit) {
    return {
      id: tableId,
      visit_id: null,
      has_open_orders: false,
      has_any_orders: false,
      state: 'closed',
      last_closed_visit_id: getLastClosedVisitId(tableId),
    };
  }

  const hasOpenOrders =
    (
      db.prepare(
        "SELECT COUNT(*) as cnt FROM orders WHERE visit_id = ? AND status IN ('Pending', 'Preparing')"
      ).get(visit.id) as { cnt: number }
    ).cnt > 0;

  const hasAnyOrders =
    (
      db.prepare('SELECT COUNT(*) as cnt FROM orders WHERE visit_id = ?').get(visit.id) as { cnt: number }
    ).cnt > 0;

  return {
    id: tableId,
    visit_id: visit.id,
    has_open_orders: hasOpenOrders,
    has_any_orders: hasAnyOrders,
    state: 'active',
    last_closed_visit_id: getLastClosedVisitId(tableId),
  };
}

export function openVisit(tableId: number): string {
  return dbOpenVisit(tableId);
}

/**
 * Archives the table's open visit (sets closed_at) and returns its id.
 * Returns null when the table has no open visit. The orders stay in the database.
 */
export function closeCurrentVisit(tableId: number): string | null {
  const db = getDb();
  const visit = getCurrentVisit(tableId);
  if (!visit) return null;
  // BR11.6: times v2 writes are ISO 8601 UTC text.
  db.prepare('UPDATE visits SET closed_at = ? WHERE id = ? AND table_id = ? AND closed_at IS NULL').run(
    toIso(),
    visit.id,
    tableId
  );
  return visit.id;
}

/** True when the table has at least one archived (closed) visit. */
export function hasClosedVisit(tableId: number): boolean {
  const db = getDb();
  const row = db.prepare('SELECT COUNT(*) as cnt FROM visits WHERE table_id = ? AND closed_at IS NOT NULL').get(tableId) as {
    cnt: number;
  };
  return row.cnt > 0;
}

export function closeVisit(visitId: string, tableId: number): void {
  const db = getDb();
  db.prepare('UPDATE visits SET closed_at = ? WHERE id = ? AND table_id = ?').run(toIso(), visitId, tableId);
}

/** The most tables the restaurant can have: a guard against a runaway button, far above any real floor. */
export const MAX_TABLES = 50;
/** The longest label a table can be given. */
export const MAX_TABLE_LABEL = 30;

/**
 * Adds the next table (its number is one more than the highest) with its label, "Table <n>" when none is given.
 * Its QR code is the page's address plus /table/<n>, so nothing else needs setting up.
 */
export function addTable(label?: string): { id: number; label: string } {
  const db = getDb();
  const run = db.transaction((): { id: number; label: string } => {
    const row = db.prepare('SELECT COUNT(*) AS n, COALESCE(MAX(id), 0) AS top FROM tables').get() as { n: number; top: number };
    if (row.n >= MAX_TABLES) throw new AppError('TOO_MANY_TABLES', `A restaurant can have at most ${MAX_TABLES} tables`);
    const id = row.top + 1;
    const name = label && label.trim() !== '' ? label.trim() : `Table ${id}`;
    db.prepare("INSERT INTO tables (id, label, status) VALUES (?, ?, 'open')").run(id, name);
    return { id, label: name };
  });
  return run.immediate();
}
