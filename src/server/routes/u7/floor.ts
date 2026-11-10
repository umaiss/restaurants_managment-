/**
 * The table list and each table's floor state (U7 Step 4). Rules: BR4.1 (the server lists the tables),
 * BR4.2 (the first of Needs the bill, Waiting, Eating, Browsing, Empty that applies).
 */
import { getDb, getCurrentVisit } from '../../db.js';
import { getPresence } from '../../presence.js';

export type FloorState = 'needs_bill' | 'waiting' | 'eating' | 'browsing' | 'empty';

export interface FloorCall {
  id: string;
  kind: 'waiter' | 'bill';
  opened_at: string;
}

export interface FloorTable {
  id: number;
  label: string;
  state: FloorState;
  /** Diner pages present (U5's five-minute rule). */
  connected: number;
  last_activity_at: string | null;
  open_calls: FloorCall[];
}

/** BR4.2: the first rule that applies wins. */
export function decideFloorState(input: {
  hasOpenBillCall: boolean;
  hasOpenOrder: boolean;
  hasLiveOrder: boolean;
  connected: number;
}): FloorState {
  if (input.hasOpenBillCall) return 'needs_bill';
  if (input.hasOpenOrder) return 'waiting';
  if (input.hasLiveOrder) return 'eating';
  if (input.connected > 0) return 'browsing';
  return 'empty';
}

export function getFloorTables(now: number = Date.now()): FloorTable[] {
  const db = getDb();
  const tables = db.prepare('SELECT id, label FROM tables WHERE removed_at IS NULL ORDER BY id').all() as Array<{ id: number; label: string }>;
  const orderStatuses = db.prepare('SELECT status FROM orders WHERE visit_id = ?');
  const callRows = db.prepare(
    'SELECT id, kind, opened_at FROM service_calls WHERE visit_id = ? AND responded_at IS NULL ORDER BY opened_at, rowid'
  );

  return tables.map((t) => {
    const visit = getCurrentVisit(t.id);
    const statuses = visit ? (orderStatuses.all(visit.id) as Array<{ status: string }>).map((r) => r.status) : [];
    const calls = visit ? (callRows.all(visit.id) as FloorCall[]) : [];
    const presence = getPresence(t.id, now);
    return {
      id: t.id,
      label: t.label,
      state: decideFloorState({
        hasOpenBillCall: calls.some((c) => c.kind === 'bill'),
        hasOpenOrder: statuses.some((s) => s === 'Pending' || s === 'Preparing'),
        hasLiveOrder: statuses.some((s) => s !== 'Cancelled'),
        connected: presence.connected,
      }),
      connected: presence.connected,
      last_activity_at: presence.last_activity_at,
      open_calls: calls,
    };
  });
}
