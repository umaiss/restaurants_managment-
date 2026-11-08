/**
 * Kitchen stations (U7 Steps 4 and 6). Rules: BR1.1 (a station's board), BR1.2 (the done mark, in one
 * transaction), BR1.3 (events after the write; published by the route from the result of markStationDone).
 * Order status changes go through U5's transitionOrder with the `station` actor (BR3.8 of U5).
 */
import { getDb } from '../../db.js';
import { AppError } from '../../errors.js';
import { STATIONS, type Station } from '../../config.js';
import { toIso } from '../../time.js';
import { transitionOrder, type LineOption, type OrderStatus } from '../../repositories/orderRepo.js';

export function isStation(value: unknown): value is Station {
  return typeof value === 'string' && (STATIONS as readonly string[]).includes(value);
}

export interface StationLine {
  menu_item_id: string;
  name: string;
  quantity: number;
  options: LineOption[];
}

export interface OtherStation {
  station: Station;
  state: 'done' | 'waiting';
}

export interface StationTicket {
  order_number: number;
  table_id: number;
  status: OrderStatus;
  placed_at: string;
  lines: StationLine[];
  other_stations: OtherStation[];
}

/** BR1.1: open orders with lines for the station and no done mark for it, with only that station's lines. */
export function getStationBoard(station: Station): StationTicket[] {
  const db = getDb();
  const orders = db
    .prepare(
      `SELECT o.id, o.order_number, o.table_id, o.status, o.placed_at
       FROM orders o
       WHERE o.status IN ('Pending', 'Preparing')
         AND EXISTS (SELECT 1 FROM order_items oi WHERE oi.order_id = o.id AND COALESCE(oi.station, 'Grill') = ?)
         AND NOT EXISTS (SELECT 1 FROM station_done d WHERE d.order_number = o.order_number AND d.station = ?)
       ORDER BY o.placed_at, o.order_number`
    )
    .all(station, station) as Array<{ id: number; order_number: number; table_id: number; status: OrderStatus; placed_at: string }>;

  const lineStmt = db.prepare(
    `SELECT oi.id AS line_id, oi.item_id AS menu_item_id, i.name, oi.quantity, COALESCE(oi.station, 'Grill') AS station
     FROM order_items oi JOIN items i ON i.id = oi.item_id
     WHERE oi.order_id = ? ORDER BY oi.id`
  );
  const optionStmt = db.prepare(
    `SELECT label, price_delta_cents FROM order_item_options WHERE order_item_id = ? ORDER BY id`
  );
  const doneStmt = db.prepare('SELECT station FROM station_done WHERE order_number = ?');

  return orders.map((o) => {
    const all = lineStmt.all(o.id) as Array<{ line_id: number; menu_item_id: string; name: string; quantity: number; station: Station }>;
    const done = new Set((doneStmt.all(o.order_number) as Array<{ station: Station }>).map((r) => r.station));
    const others = [...new Set(all.map((l) => l.station))].filter((s) => s !== station);
    return {
      order_number: o.order_number,
      table_id: o.table_id,
      status: o.status,
      placed_at: o.placed_at,
      lines: all
        .filter((l) => l.station === station)
        .map((l) => ({
          menu_item_id: l.menu_item_id,
          name: l.name,
          quantity: l.quantity,
          options: optionStmt.all(l.line_id) as LineOption[],
        })),
      other_stations: others.map((s) => ({ station: s, state: done.has(s) ? ('done' as const) : ('waiting' as const) })),
    };
  });
}

export interface StatusChange {
  status: OrderStatus;
  table_id: number;
  completed_at: string | null;
}

export interface StationDoneResult {
  order_number: number;
  table_id: number;
  status: OrderStatus;
  stations_done: Station[];
  stations_remaining: Station[];
  /** False for a repeated mark: nothing was written and the route publishes nothing (BR1.2, BR1.3). */
  changed: boolean;
  /** The status changes this call made, in order (Preparing, then Completed). */
  changes: StatusChange[];
}

/**
 * BR1.2: in one transaction, in this order: the order exists (UNKNOWN_ORDER); it has lines for the station
 * (NO_LINES_FOR_STATION); a mark that is already there changes nothing and is not an error, even when the
 * order has since been Completed; otherwise the order must be open (ILLEGAL_TRANSITION) and the mark is
 * written. A Pending order moves to Preparing; when every station with lines has a mark the order is Completed.
 */
export function markStationDone(orderNumber: number, station: Station, now: Date = new Date()): StationDoneResult {
  const db = getDb();
  const run = db.transaction((): StationDoneResult => {
    const order = db
      .prepare('SELECT id, order_number, status, table_id FROM orders WHERE order_number = ?')
      .get(orderNumber) as { id: number; order_number: number; status: OrderStatus; table_id: number } | undefined;
    if (!order) throw new AppError('UNKNOWN_ORDER', `Order ${orderNumber} not found`);

    const withLines = (
      db.prepare("SELECT DISTINCT COALESCE(station, 'Grill') AS station FROM order_items WHERE order_id = ?").all(order.id) as Array<{
        station: Station;
      }>
    )
      .map((r) => r.station)
      .sort((a, b) => STATIONS.indexOf(a) - STATIONS.indexOf(b));
    if (!withLines.includes(station)) {
      throw new AppError('NO_LINES_FOR_STATION', `Order ${orderNumber} has no ${station} items`);
    }

    const doneRows = () =>
      (db.prepare('SELECT station FROM station_done WHERE order_number = ?').all(orderNumber) as Array<{ station: Station }>).map((r) => r.station);
    const summarize = (status: OrderStatus, changed: boolean, changes: StatusChange[]): StationDoneResult => {
      const done = doneRows();
      return {
        order_number: order.order_number,
        table_id: order.table_id,
        status,
        stations_done: withLines.filter((s) => done.includes(s)),
        stations_remaining: withLines.filter((s) => !done.includes(s)),
        changed,
        changes,
      };
    };

    if (doneRows().includes(station)) return summarize(order.status, false, []);

    if (order.status !== 'Pending' && order.status !== 'Preparing') {
      throw new AppError('ILLEGAL_TRANSITION', `Order ${orderNumber} is ${order.status}; a station cannot be marked done`);
    }

    db.prepare('INSERT INTO station_done (order_number, station, done_at) VALUES (?, ?, ?)').run(orderNumber, station, toIso(now));

    const changes: StatusChange[] = [];
    let status: OrderStatus = order.status;
    if (status === 'Pending') {
      const r = transitionOrder(orderNumber, 'Preparing', 'station', now);
      status = r.status;
      changes.push({ status: r.status, table_id: r.table_id, completed_at: null });
    }
    if (withLines.every((s) => doneRows().includes(s))) {
      const r = transitionOrder(orderNumber, 'Completed', 'station', now);
      status = r.status;
      changes.push({ status: r.status, table_id: r.table_id, completed_at: r.completed_at });
    }
    return summarize(status, true, changes);
  });
  return run.immediate();
}
