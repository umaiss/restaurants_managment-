import { getDb, getCurrentVisit } from '../db.js';
import { getOrdersByVisit, type OrderLine, type OrderStatus } from './orderRepo.js';
import { closeCurrentVisit, hasClosedVisit } from './tableRepo.js';
import { clearOpenCalls, getBillRequest, type PaymentMethod } from './serviceCallRepo.js';

export type BillingErrorCode =
  | 'UNKNOWN_TABLE'
  | 'CLOSE_BLOCKED'
  | 'TABLE_EMPTY'
  | 'TABLE_ALREADY_CLOSED'
  | 'UNKNOWN_VISIT'
  | 'VISIT_NOT_CLOSED';

export class BillingError extends Error {
  constructor(
    message: string,
    public readonly code: BillingErrorCode,
    public readonly details?: { blocking_orders: number[] }
  ) {
    super(`${code}: ${message}`);
    this.name = 'BillingError';
  }
}

export interface BillLine extends OrderLine {
  /** Emoji tile of the menu item, when it still exists on the menu. */
  image?: string;
}

export interface BillOrder {
  order_number: number;
  status: OrderStatus;
  placed_at: string;
  lines: BillLine[];
  subtotal_cents: number;
}

export interface Bill {
  table_id: number;
  orders: BillOrder[];
  combined_total_cents: number;
  close_available: boolean;
  blocking_orders: number[];
  /** How the table said it will pay when it asked for the bill, if it did. */
  payment_method: PaymentMethod | null;
  /** True when the table asked for a receipt along with the bill. */
  receipt_requested: boolean;
}

export interface Receipt {
  visit_id: string;
  table_id: number;
  table_label: string;
  opened_at: string;
  closed_at: string;
  orders: BillOrder[];
  total_cents: number;
  payment_method: PaymentMethod | null;
  /** True when the table asked for a receipt along with the bill. */
  receipt_requested: boolean;
}

function assertTableExists(tableId: number): void {
  const row = getDb().prepare('SELECT id FROM tables WHERE id = ? AND removed_at IS NULL').get(tableId);
  if (!row) {
    throw new BillingError(`Table ${tableId} not found`, 'UNKNOWN_TABLE');
  }
}

function isOpen(status: OrderStatus): boolean {
  return status === 'Pending' || status === 'Preparing';
}

/**
 * Builds the bill for the table's current visit from live data (BR4.1). Read only: it never
 * writes to Ordering (BR4.2). Prices are the stored per-line prices, never the menu's (BR1.4).
 */
export function buildBill(tableId: number): Bill {
  assertTableExists(tableId);

  const visit = getCurrentVisit(tableId);
  if (!visit) {
    return {
      table_id: tableId,
      orders: [],
      combined_total_cents: 0,
      close_available: false,
      blocking_orders: [],
      payment_method: null,
      receipt_requested: false,
    };
  }

  const all = getOrdersByVisit(visit.id);
  const images = new Map<string, string>(
    (getDb().prepare('SELECT id, image FROM items').all() as Array<{ id: string; image: string }>).map((r) => [r.id, r.image])
  );

  // Placement order; the order number breaks a tie between orders placed in the same millisecond.
  const included = all
    .filter((o) => o.status !== 'Cancelled')
    .sort((a, b) => a.placed_at.localeCompare(b.placed_at) || a.order_number - b.order_number);
  const orders: BillOrder[] = included.map((o) => ({
    order_number: o.order_number,
    status: o.status,
    placed_at: o.placed_at,
    lines: o.lines.map((l) => ({ ...l, image: images.get(l.menu_item_id) || undefined })),
    subtotal_cents: o.lines.reduce((sum, l) => sum + l.subtotal_cents, 0),
  }));

  const blocking = all.filter((o) => isOpen(o.status)).map((o) => o.order_number);
  const request = getBillRequest(visit.id);

  return {
    table_id: tableId,
    orders,
    combined_total_cents: orders.reduce((sum, o) => sum + o.subtotal_cents, 0),
    // Cancelled orders count as "has orders" here so a visit where everything was cancelled can still be closed.
    close_available: all.length > 0 && blocking.length === 0,
    blocking_orders: blocking,
    payment_method: request.payment_method,
    receipt_requested: request.wants_receipt,
  };
}

/**
 * The receipt of a closed visit: what was ordered (cancelled orders left out), the total and how the table
 * said it would pay. Read only; staff print it from the receipt page.
 */
export function buildReceipt(visitId: string): Receipt {
  const db = getDb();
  const visit = db
    .prepare('SELECT v.id, v.table_id, v.opened_at, v.closed_at, t.label FROM visits v JOIN tables t ON t.id = v.table_id WHERE v.id = ?')
    .get(visitId) as { id: string; table_id: number; opened_at: string; closed_at: string | null; label: string } | undefined;
  if (!visit) throw new BillingError(`Visit ${visitId} not found`, 'UNKNOWN_VISIT');
  if (visit.closed_at === null) throw new BillingError(`Visit ${visitId} is not closed yet`, 'VISIT_NOT_CLOSED');

  const images = new Map<string, string>(
    (db.prepare('SELECT id, image FROM items').all() as Array<{ id: string; image: string }>).map((r) => [r.id, r.image])
  );
  const request = getBillRequest(visit.id);
  const orders: BillOrder[] = getOrdersByVisit(visit.id)
    .filter((o) => o.status !== 'Cancelled')
    .sort((a, b) => a.placed_at.localeCompare(b.placed_at) || a.order_number - b.order_number)
    .map((o) => ({
      order_number: o.order_number,
      status: o.status,
      placed_at: o.placed_at,
      lines: o.lines.map((l) => ({ ...l, image: images.get(l.menu_item_id) || undefined })),
      subtotal_cents: o.lines.reduce((sum, l) => sum + l.subtotal_cents, 0),
    }));

  return {
    visit_id: visit.id,
    table_id: visit.table_id,
    table_label: visit.label,
    opened_at: visit.opened_at,
    closed_at: visit.closed_at,
    orders,
    total_cents: orders.reduce((sum, o) => sum + o.subtotal_cents, 0),
    payment_method: request.payment_method,
    receipt_requested: request.wants_receipt,
  };
}

/**
 * Closes the table. The checks and the close run in one transaction so an order's status
 * cannot change between them.
 */
export function closeTable(tableId: number): { closed: true; archived_visit_id: string } {
  const db = getDb();
  const run = db.transaction((): { closed: true; archived_visit_id: string } => {
    assertTableExists(tableId);

    const visit = getCurrentVisit(tableId);
    if (!visit) {
      if (hasClosedVisit(tableId)) {
        throw new BillingError(`Table ${tableId} is already closed`, 'TABLE_ALREADY_CLOSED');
      }
      throw new BillingError(`Table ${tableId} has no orders to close`, 'TABLE_EMPTY');
    }

    const all = getOrdersByVisit(visit.id);
    if (all.length === 0) {
      throw new BillingError(`Table ${tableId} has no orders to close`, 'TABLE_EMPTY');
    }

    const blocking = all.filter((o) => isOpen(o.status)).map((o) => o.order_number);
    if (blocking.length > 0) {
      throw new BillingError('Orders are still open', 'CLOSE_BLOCKED', { blocking_orders: blocking });
    }

    const archived = closeCurrentVisit(tableId);
    if (!archived) {
      throw new BillingError(`Table ${tableId} is already closed`, 'TABLE_ALREADY_CLOSED');
    }
    // BR6.3: closing clears the visit's open service calls in the same transaction. No per-call event:
    // TABLE_CLOSED already tells every screen to reset.
    clearOpenCalls(archived);
    return { closed: true, archived_visit_id: archived };
  });
  return run.immediate();
}
