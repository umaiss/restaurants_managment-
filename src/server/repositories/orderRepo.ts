import { getDb, openVisit as dbOpenVisit, getCurrentVisit, nextOrderNumber } from '../db.js';

export type OrderStatus = 'Pending' | 'Preparing' | 'Completed' | 'Cancelled';
export type Actor = 'diner' | 'staff';

export interface OrderLine {
  menu_item_id: string;
  name: string;
  quantity: number;
  price_cents_each: number;
  subtotal_cents: number;
}

export interface DroppedLine {
  menu_item_id: string;
  reason: string;
}

export interface PlaceOrderResult {
  order_number: number;
  status: OrderStatus;
  placed_at: string;
  lines: OrderLine[];
  dropped_lines: DroppedLine[];
  visit_id: string;
  table_id: number;
  isDuplicate?: boolean;
}

export interface OrderWithItems {
  order_number: number;
  status: OrderStatus;
  placed_at: string;
  table_id: number;
  visit_id: string;
  lines: OrderLine[];
  subtotal_cents: number;
}

class OrderError extends Error {
  constructor(
    message: string,
    public readonly code: string
  ) {
    // Include the code in the message so toThrow(/CODE/) assertions work
    super(`${code}: ${message}`);
    this.name = 'OrderError';
  }
}

export function placeOrder(
  tableId: number,
  visitId: string,
  placementKey: string,
  inputLines: Array<{ menu_item_id: string; quantity: number }>
): PlaceOrderResult {
  const db = getDb();

  // Check for idempotent duplicate: same (table_id, visit_id, placement_key)
  const existing = db.prepare(
    'SELECT id, order_number, status, placed_at FROM orders WHERE table_id = ? AND visit_id = ? AND placement_key = ?'
  ).get(tableId, visitId, placementKey) as { id: number; order_number: number; status: string; placed_at: string } | undefined;

  if (existing) {
    // Duplicate placement_key — signal to the route handler to return 409
    const existingLines = db.prepare(
      `SELECT oi.item_id as menu_item_id, i.name, oi.quantity, oi.unit_price_cents as price_cents_each
       FROM order_items oi JOIN items i ON i.id = oi.item_id
       WHERE oi.order_id = ?`
    ).all(existing.id) as Array<{ menu_item_id: string; name: string; quantity: number; price_cents_each: number }>;

    return {
      order_number: existing.order_number,
      status: existing.status as OrderStatus,
      placed_at: existing.placed_at,
      visit_id: visitId,
      table_id: tableId,
      lines: existingLines.map((l) => ({
        ...l,
        subtotal_cents: l.quantity * l.price_cents_each,
      })),
      dropped_lines: [],
      isDuplicate: true,
    };
  }

  // Validate quantities and resolve items
  const lines: OrderLine[] = [];
  const droppedLines: DroppedLine[] = [];

  for (const input of inputLines) {
    if (input.quantity < 1 || input.quantity > 20) {
      throw new OrderError(`Invalid quantity ${input.quantity} for item ${input.menu_item_id}`, 'INVALID_QUANTITY');
    }

    const item = db.prepare(
      'SELECT id, name, price_cents, available FROM items WHERE id = ?'
    ).get(input.menu_item_id) as { id: string; name: string; price_cents: number; available: number } | undefined;

    if (!item) {
      throw new OrderError(`Unknown item ${input.menu_item_id}`, 'UNKNOWN_ITEM');
    }

    if (!item.available) {
      droppedLines.push({ menu_item_id: input.menu_item_id, reason: 'SOLD_OUT_AT_SUBMIT' });
      continue;
    }

    lines.push({
      menu_item_id: item.id,
      name: item.name,
      quantity: input.quantity,
      price_cents_each: item.price_cents,
      subtotal_cents: input.quantity * item.price_cents,
    });
  }

  if (lines.length === 0) {
    throw new OrderError('All items were sold out or the order is empty', 'EMPTY_ORDER');
  }

  const orderNum = nextOrderNumber();
  const placedAt = new Date().toISOString();

  const insertOrder = db.prepare(
    `INSERT INTO orders (order_number, visit_id, table_id, status, placed_by, placement_key, placed_at)
     VALUES (?, ?, ?, 'Pending', 'diner', ?, ?)`
  );
  const result = insertOrder.run(orderNum, visitId, tableId, placementKey, placedAt);
  const orderId = result.lastInsertRowid as number;

  const insertItem = db.prepare(
    'INSERT INTO order_items (order_id, item_id, quantity, unit_price_cents) VALUES (?, ?, ?, ?)'
  );
  for (const line of lines) {
    insertItem.run(orderId, line.menu_item_id, line.quantity, line.price_cents_each);
  }

  return {
    order_number: orderNum,
    status: 'Pending',
    placed_at: placedAt,
    visit_id: visitId,
    table_id: tableId,
    lines,
    dropped_lines: droppedLines,
  };
}

const LEGAL_TRANSITIONS: Record<OrderStatus, Partial<Record<Actor, OrderStatus[]>>> = {
  Pending: {
    staff: ['Preparing', 'Cancelled'],
    diner: ['Cancelled'],
  },
  Preparing: {
    staff: ['Completed', 'Cancelled'],
    diner: [],
  },
  Completed: {
    staff: [],
    diner: [],
  },
  Cancelled: {
    staff: [],
    diner: [],
  },
};

export function transitionOrder(
  orderNumber: number,
  newStatus: OrderStatus,
  by: string
): { order_number: number; status: OrderStatus; table_id: number } {
  const db = getDb();

  if (by !== 'diner' && by !== 'staff') {
    throw new OrderError(`Invalid actor '${by}'`, 'INVALID_ACTOR');
  }

  const actor = by as Actor;

  const order = db.prepare(
    'SELECT id, order_number, status, table_id FROM orders WHERE order_number = ?'
  ).get(orderNumber) as { id: number; order_number: number; status: string; table_id: number } | undefined;

  if (!order) {
    throw new OrderError(`Order ${orderNumber} not found`, 'UNKNOWN_ORDER');
  }

  const currentStatus = order.status as OrderStatus;
  const allowedTargets = LEGAL_TRANSITIONS[currentStatus]?.[actor] ?? [];

  if (!allowedTargets.includes(newStatus)) {
    throw new OrderError(
      `Transition from ${currentStatus} to ${newStatus} by ${actor} is not allowed`,
      'ILLEGAL_TRANSITION'
    );
  }

  db.prepare('UPDATE orders SET status = ? WHERE id = ?').run(newStatus, order.id);

  return {
    order_number: order.order_number,
    status: newStatus,
    table_id: order.table_id,
  };
}

export function getOrdersByVisit(visitId: string): OrderWithItems[] {
  const db = getDb();

  const orders = db.prepare(
    'SELECT id, order_number, status, placed_at, table_id, visit_id FROM orders WHERE visit_id = ? ORDER BY placed_at'
  ).all(visitId) as Array<{ id: number; order_number: number; status: string; placed_at: string; table_id: number; visit_id: string }>;

  return orders.map((order) => {
    const lines = db.prepare(
      `SELECT oi.item_id as menu_item_id, i.name, oi.quantity, oi.unit_price_cents as price_cents_each
       FROM order_items oi JOIN items i ON i.id = oi.item_id
       WHERE oi.order_id = ?`
    ).all(order.id) as Array<{ menu_item_id: string; name: string; quantity: number; price_cents_each: number }>;

    const enrichedLines: OrderLine[] = lines.map((l) => ({
      ...l,
      subtotal_cents: l.quantity * l.price_cents_each,
    }));

    const subtotal_cents = enrichedLines.reduce((sum, l) => sum + l.subtotal_cents, 0);

    return {
      order_number: order.order_number,
      status: order.status as OrderStatus,
      placed_at: order.placed_at,
      table_id: order.table_id,
      visit_id: order.visit_id,
      lines: enrichedLines,
      subtotal_cents,
    };
  });
}

export function getOrderByNumber(orderNumber: number): {
  order_number: number;
  status: OrderStatus;
  table_id: number;
  visit_id: string;
} | null {
  const db = getDb();
  const row = db.prepare(
    'SELECT order_number, status, table_id, visit_id FROM orders WHERE order_number = ?'
  ).get(orderNumber) as { order_number: number; status: string; table_id: number; visit_id: string } | undefined;

  if (!row) return null;
  return { ...row, status: row.status as OrderStatus };
}

export function getOrOpenVisit(tableId: number): string {
  const existing = getCurrentVisit(tableId);
  if (existing) return existing.id;
  return dbOpenVisit(tableId);
}
