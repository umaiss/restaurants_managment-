import { getDb, openVisit as dbOpenVisit, getCurrentVisit } from '../db.js';

export interface TableStatus {
  id: number;
  visit_id: string | null;
  has_open_orders: boolean;
  has_any_orders: boolean;
  state: 'active' | 'closed';
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
  db.prepare("UPDATE visits SET closed_at = datetime('now') WHERE id = ? AND table_id = ? AND closed_at IS NULL").run(
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
  db.prepare("UPDATE visits SET closed_at = datetime('now') WHERE id = ? AND table_id = ?").run(
    visitId,
    tableId
  );
}
