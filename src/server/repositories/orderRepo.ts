/**
 * Orders (v1, extended by U5 Steps 5 and 7).
 * Rules: BR3.1 (option checks in a fixed order), BR3.2 (frozen price), BR3.3 (frozen station and
 * options), BR3.4 (dropped lines), BR3.5 (stored estimate), BR3.6 (completed_at), BR3.7 (repeated
 * placement key), BR3.8 (one function makes every status change), BR3.9 (cancelled orders stay out),
 * BR3.10 (all or nothing), BR5.3 and BR5.4 (special lines), BR12.1 (a station on every line).
 */
import { getDb, openVisit as dbOpenVisit, getCurrentVisit, nextOrderNumber } from '../db.js';
import { toIso } from '../time.js';
import type { Station } from '../config.js';
import { endIfSoldOut, getSpecialById, isLive, reduceSpecialStock } from './specialsRepo.js';

export type OrderStatus = 'Pending' | 'Preparing' | 'Completed' | 'Cancelled';
/** `station` is the kitchen-station logic of U7 (BR3.8). */
export type Actor = 'diner' | 'staff' | 'station';

export interface LineOption {
  label: string;
  price_delta_cents: number;
}

export interface OrderLine {
  menu_item_id: string;
  name: string;
  quantity: number;
  price_cents_each: number;
  subtotal_cents: number;
  /** Frozen at placement; v1-era lines count as Grill (BR3.3). */
  station: Station;
  /** Frozen chosen options (BR3.3). */
  options: LineOption[];
  /** Present on a Chef's special line. */
  special_id?: string;
}

export interface DroppedLine {
  menu_item_id: string;
  reason: string;
}

export interface PlaceOrderInputLine {
  menu_item_id: string;
  quantity: number;
  option_ids?: string[];
  special_id?: string;
}

export interface PlaceOrderResult {
  order_number: number;
  status: OrderStatus;
  placed_at: string;
  estimate_minutes: number | null;
  lines: OrderLine[];
  dropped_lines: DroppedLine[];
  visit_id: string;
  table_id: number;
  isDuplicate?: boolean;
  /** True when a special's stock was reduced, so the route publishes SPECIAL_CHANGED (BR5.5). */
  special_stock_changed?: boolean;
}

export interface OrderWithItems {
  order_number: number;
  status: OrderStatus;
  placed_at: string;
  table_id: number;
  visit_id: string;
  estimate_minutes: number | null;
  completed_at: string | null;
  lines: OrderLine[];
  subtotal_cents: number;
}

export class OrderError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly details?: Record<string, unknown>
  ) {
    // Include the code in the message so toThrow(/CODE/) assertions work
    super(`${code}: ${message}`);
    this.name = 'OrderError';
  }
}

interface ChoiceRow {
  id: string;
  label: string;
  price_delta_cents: number;
  group_id: string;
  group_name: string;
  kind: 'one' | 'any' | 'leave_out';
  item_id: string;
}

/** Marker for a line that is dropped (not failed) and why. */
class LineDropped extends Error {
  constructor(public readonly reason: string) {
    super(reason);
  }
}

/** The lines of one order, with their frozen station and options, read back from the database. */
function readLines(orderId: number): OrderLine[] {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT oi.id AS line_id, oi.item_id AS menu_item_id, i.name, oi.quantity,
              oi.unit_price_cents AS price_cents_each, oi.station, oi.special_id
       FROM order_items oi JOIN items i ON i.id = oi.item_id
       WHERE oi.order_id = ? ORDER BY oi.id`
    )
    .all(orderId) as Array<{
    line_id: number;
    menu_item_id: string;
    name: string;
    quantity: number;
    price_cents_each: number;
    station: Station;
    special_id: string | null;
  }>;
  const optionRows = db
    .prepare(
      `SELECT oio.order_item_id AS line_id, oio.label, oio.price_delta_cents
       FROM order_item_options oio JOIN order_items oi ON oi.id = oio.order_item_id
       WHERE oi.order_id = ? ORDER BY oio.id`
    )
    .all(orderId) as Array<{ line_id: number; label: string; price_delta_cents: number }>;

  return rows.map((r) => {
    const line: OrderLine = {
      menu_item_id: r.menu_item_id,
      name: r.name,
      quantity: r.quantity,
      price_cents_each: r.price_cents_each,
      subtotal_cents: r.quantity * r.price_cents_each,
      station: r.station,
      options: optionRows
        .filter((o) => o.line_id === r.line_id)
        .map((o) => ({ label: o.label, price_delta_cents: o.price_delta_cents })),
    };
    if (r.special_id) line.special_id = r.special_id;
    return line;
  });
}

/**
 * Places an order in one transaction (BR3.10). `estimateMinutes` is the number WaitEstimation gave
 * just before placing; the order keeps it (BR3.5). Throws OrderError for a refused order.
 */
export function placeOrder(
  tableId: number,
  visitId: string,
  placementKey: string,
  inputLines: PlaceOrderInputLine[],
  estimateMinutes: number | null = null,
  now: Date = new Date()
): PlaceOrderResult {
  const db = getDb();
  const run = db.transaction((): PlaceOrderResult => placeOrderInTransaction(tableId, visitId, placementKey, inputLines, estimateMinutes, now));
  return run.immediate();
}

/**
 * Opens the table's visit if needed and places the order, all in one transaction (BR3.10): an order
 * that ends up refused leaves no visit behind either.
 */
export function placeOrderAtTable(
  tableId: number,
  placementKey: string,
  inputLines: PlaceOrderInputLine[],
  estimateMinutes: number | null = null,
  now: Date = new Date()
): PlaceOrderResult {
  const db = getDb();
  const run = db.transaction((): PlaceOrderResult => {
    const visitId = getOrOpenVisit(tableId);
    return placeOrderInTransaction(tableId, visitId, placementKey, inputLines, estimateMinutes, now);
  });
  return run.immediate();
}

function placeOrderInTransaction(
  tableId: number,
  visitId: string,
  placementKey: string,
  inputLines: PlaceOrderInputLine[],
  estimateMinutes: number | null,
  now: Date
): PlaceOrderResult {
  const db = getDb();

  // BR3.7: a repeated placement key returns the same order and drops nothing.
  const existing = db
    .prepare(
      'SELECT id, order_number, status, placed_at, estimate_minutes FROM orders WHERE table_id = ? AND visit_id = ? AND placement_key = ?'
    )
    .get(tableId, visitId, placementKey) as
    | { id: number; order_number: number; status: string; placed_at: string; estimate_minutes: number | null }
    | undefined;
  if (existing) {
    return {
      order_number: existing.order_number,
      status: existing.status as OrderStatus,
      placed_at: existing.placed_at,
      estimate_minutes: existing.estimate_minutes,
      visit_id: visitId,
      table_id: tableId,
      lines: readLines(existing.id),
      dropped_lines: [],
      isDuplicate: true,
    };
  }

  interface PlannedLine {
    menu_item_id: string;
    name: string;
    quantity: number;
    price_cents_each: number;
    station: Station;
    special_id: string | null;
    options: Array<{ label: string; price_delta_cents: number }>;
  }
  const planned: PlannedLine[] = [];
  const dropped: DroppedLine[] = [];

  const findItem = db.prepare(
    `SELECT items.id, items.name, items.price_cents, items.available, items.hidden, items.station,
            categories.hidden AS category_hidden
     FROM items JOIN categories ON categories.id = items.category_id WHERE items.id = ?`
  );
  const findChoice = db.prepare(
    `SELECT c.id, c.label, c.price_delta_cents, c.group_id, g.name AS group_name, g.kind, g.item_id
     FROM option_choices c JOIN option_groups g ON g.id = c.group_id WHERE c.id = ?`
  );
  const requiredGroups = db.prepare("SELECT id, name FROM option_groups WHERE item_id = ? AND kind = 'one' AND required = 1");

  for (const input of inputLines) {
    if (input.quantity < 1 || input.quantity > 20) {
      throw new OrderError(`Invalid quantity ${input.quantity} for item ${input.menu_item_id}`, 'INVALID_QUANTITY');
    }

    try {
      // (1) the item is known and not hidden (itself or through its category), else the whole order is refused.
      const item = findItem.get(input.menu_item_id) as
        | { id: string; name: string; price_cents: number; available: number; hidden: number; station: Station; category_hidden: number }
        | undefined;
      if (!item || item.hidden === 1 || item.category_hidden === 1) {
        throw new OrderError(`Unknown item ${input.menu_item_id}`, 'UNKNOWN_ITEM');
      }

      // (2) not sold out, else the line is dropped.
      if (!item.available) throw new LineDropped('SOLD_OUT_AT_SUBMIT');

      // (3) the special is only checked here: live and for this item (BR5.4). Its stock is not touched yet.
      let basePrice = item.price_cents;
      let specialId: string | null = null;
      if (input.special_id !== undefined) {
        const special = getSpecialById(input.special_id);
        if (!special || special.item_id !== item.id || !isLive(special, now)) throw new LineDropped('SPECIAL_SOLD_OUT');
        basePrice = special.special_price_cents;
        specialId = special.id;
      }

      // (4) to (7) the chosen options.
      const optionIds = input.option_ids ?? [];
      const choices: ChoiceRow[] = [];
      for (const optionId of optionIds) {
        const choice = findChoice.get(optionId) as ChoiceRow | undefined;
        // (4) an id that exists nowhere (removed, or never existed) drops the whole line.
        if (!choice) throw new LineDropped('OPTION_UNAVAILABLE');
        choices.push(choice);
      }
      // (5) an id that exists must belong to this line's item: an id of another item is a mistake, not a removal.
      for (const choice of choices) {
        if (choice.item_id !== item.id) {
          throw new OrderError(`Option ${choice.id} does not belong to item ${item.id}`, 'INVALID_OPTIONS', {
            menu_item_id: item.id,
            option_id: choice.id,
          });
        }
      }
      // The same choice twice would be charged twice: refused as a mistake.
      if (new Set(optionIds).size !== optionIds.length) {
        throw new OrderError(`The same option was chosen twice for item ${item.id}`, 'INVALID_OPTIONS', {
          menu_item_id: item.id,
        });
      }
      // (6) two choices of a choose-one group are refused.
      const picksPerGroup = new Map<string, number>();
      for (const choice of choices) picksPerGroup.set(choice.group_id, (picksPerGroup.get(choice.group_id) ?? 0) + 1);
      for (const choice of choices) {
        if (choice.kind === 'one' && (picksPerGroup.get(choice.group_id) ?? 0) > 1) {
          throw new OrderError(`Group ${choice.group_name} allows one choice`, 'INVALID_OPTIONS', {
            menu_item_id: item.id,
            group: choice.group_name,
          });
        }
      }
      // (7) a required choose-one group with no choice is refused.
      for (const group of requiredGroups.all(item.id) as Array<{ id: string; name: string }>) {
        if (!picksPerGroup.has(group.id)) {
          throw new OrderError(`Group ${group.name} needs a choice`, 'INVALID_OPTIONS', {
            menu_item_id: item.id,
            group: group.name,
          });
        }
      }

      // BR3.2: item (or special) price plus the chosen options; never below zero (BR2.4).
      const priceEach = basePrice + choices.reduce((sum, c) => sum + c.price_delta_cents, 0);
      if (priceEach < 0) {
        throw new OrderError(`The price of ${item.name} cannot be below zero`, 'INVALID_OPTIONS', { menu_item_id: item.id });
      }

      planned.push({
        menu_item_id: item.id,
        name: item.name,
        quantity: input.quantity,
        price_cents_each: priceEach,
        station: item.station,
        special_id: specialId,
        options: choices.map((c) => ({ label: c.label, price_delta_cents: c.price_delta_cents })),
      });
    } catch (err) {
      if (err instanceof LineDropped) {
        dropped.push({ menu_item_id: input.menu_item_id, reason: err.reason });
        continue;
      }
      throw err;
    }
  }

  // BR5.3: the guarded stock reduction runs last, only for special lines that passed every check.
  let specialStockChanged = false;
  const kept: PlannedLine[] = [];
  for (const line of planned) {
    if (line.special_id !== null) {
      if (!reduceSpecialStock(line.special_id, line.quantity, now)) {
        dropped.push({ menu_item_id: line.menu_item_id, reason: 'SPECIAL_SOLD_OUT' });
        continue;
      }
      specialStockChanged = true;
      endIfSoldOut(line.special_id, now);
    }
    kept.push(line);
  }

  // BR3.10: an order with nothing left rolls everything back, stock reductions included.
  if (kept.length === 0) {
    throw new OrderError('All items were sold out or the order is empty', 'EMPTY_ORDER');
  }

  const orderNum = nextOrderNumber();
  const placedAt = toIso(now);
  const orderId = db
    .prepare(
      `INSERT INTO orders (order_number, visit_id, table_id, status, placed_by, placement_key, placed_at, estimate_minutes)
       VALUES (?, ?, ?, 'Pending', 'diner', ?, ?, ?)`
    )
    .run(orderNum, visitId, tableId, placementKey, placedAt, estimateMinutes).lastInsertRowid as number;

  const insertLine = db.prepare(
    'INSERT INTO order_items (order_id, item_id, quantity, unit_price_cents, station, special_id) VALUES (?, ?, ?, ?, ?, ?)'
  );
  const insertOption = db.prepare(
    'INSERT INTO order_item_options (order_item_id, label, price_delta_cents) VALUES (?, ?, ?)'
  );
  const lines: OrderLine[] = kept.map((l) => {
    const lineId = insertLine.run(orderId, l.menu_item_id, l.quantity, l.price_cents_each, l.station, l.special_id)
      .lastInsertRowid as number;
    for (const o of l.options) insertOption.run(lineId, o.label, o.price_delta_cents);
    const line: OrderLine = {
      menu_item_id: l.menu_item_id,
      name: l.name,
      quantity: l.quantity,
      price_cents_each: l.price_cents_each,
      subtotal_cents: l.quantity * l.price_cents_each,
      station: l.station,
      options: l.options,
    };
    if (l.special_id) line.special_id = l.special_id;
    return line;
  });

  return {
    order_number: orderNum,
    status: 'Pending',
    placed_at: placedAt,
    estimate_minutes: estimateMinutes,
    visit_id: visitId,
    table_id: tableId,
    lines,
    dropped_lines: dropped,
    special_stock_changed: specialStockChanged,
  };
}

/**
 * Who may make which status change (BR3.8). Completed and Cancelled are final. The station actor
 * (U7's kitchen stations) may only move Pending to Preparing and Preparing to Completed.
 */
const LEGAL_TRANSITIONS: Record<OrderStatus, Partial<Record<Actor, OrderStatus[]>>> = {
  Pending: {
    staff: ['Preparing', 'Cancelled'],
    station: ['Preparing'],
    diner: ['Cancelled'],
  },
  Preparing: {
    staff: ['Completed', 'Cancelled'],
    station: ['Completed'],
    diner: [],
  },
  Completed: {
    staff: [],
    station: [],
    diner: [],
  },
  Cancelled: {
    staff: [],
    station: [],
    diner: [],
  },
};

/**
 * The one place an order's status changes (BR3.8). It applies the rule and sets completed_at on
 * Completed (BR3.6); the caller publishes the event. Throws INVALID_ACTOR, UNKNOWN_ORDER or
 * ILLEGAL_TRANSITION.
 */
export function transitionOrder(
  orderNumber: number,
  newStatus: OrderStatus,
  by: string,
  now: Date = new Date()
): { order_number: number; status: OrderStatus; table_id: number; completed_at: string | null } {
  const db = getDb();

  if (by !== 'diner' && by !== 'staff' && by !== 'station') {
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

  const completedAt = newStatus === 'Completed' ? toIso(now) : null;
  // The status check in the WHERE keeps a second, simultaneous change from overwriting the first.
  const result = db
    .prepare('UPDATE orders SET status = ?, completed_at = COALESCE(?, completed_at) WHERE id = ? AND status = ?')
    .run(newStatus, completedAt, order.id, currentStatus);
  if (result.changes !== 1) {
    throw new OrderError(`Order ${orderNumber} changed while it was being updated`, 'ILLEGAL_TRANSITION');
  }

  return {
    order_number: order.order_number,
    status: newStatus,
    table_id: order.table_id,
    completed_at: completedAt,
  };
}

export function getOrdersByVisit(visitId: string): OrderWithItems[] {
  const db = getDb();

  const orders = db
    .prepare(
      `SELECT id, order_number, status, placed_at, table_id, visit_id, estimate_minutes, completed_at
       FROM orders WHERE visit_id = ? ORDER BY placed_at, order_number`
    )
    .all(visitId) as Array<{
    id: number;
    order_number: number;
    status: string;
    placed_at: string;
    table_id: number;
    visit_id: string;
    estimate_minutes: number | null;
    completed_at: string | null;
  }>;

  return orders.map((order) => {
    const lines = readLines(order.id);
    const subtotal_cents = lines.reduce((sum, l) => sum + l.subtotal_cents, 0);

    return {
      order_number: order.order_number,
      status: order.status as OrderStatus,
      placed_at: order.placed_at,
      table_id: order.table_id,
      visit_id: order.visit_id,
      estimate_minutes: order.estimate_minutes,
      completed_at: order.completed_at,
      lines,
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
