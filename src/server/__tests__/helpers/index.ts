/**
 * Server-side test helpers (U5 Step 17, contract 9, BR14.3). U6 and U7 test their side with only v1 and
 * U5 in the project by making the other side's effect with these plain functions. None of them is
 * reachable from a route: the app never imports this folder (a test checks it), and they are not routes.
 *
 * Each one writes first and then publishes the live event the real route would publish (BR9.1), so a
 * test that has a stream open sees the same events the app would send.
 */
import { getDb } from '../../db.js';
import { publish } from '../../sse.js';
import { placeOrderAtTable, transitionOrder, getOrdersByVisit, type PlaceOrderInputLine, type PlaceOrderResult, type OrderStatus } from '../../repositories/orderRepo.js';
import {
  launchSpecial as launchSpecialRepo,
  endCurrentSpecial,
  getCurrentSpecial,
  type ChefSpecial,
  type LaunchInput,
} from '../../repositories/specialsRepo.js';
import { openCall as openCallRepo, respondCall as respondCallRepo, type CallKind, type ServiceCall } from '../../repositories/serviceCallRepo.js';
import { saveRatings } from '../../repositories/ratingRepo.js';
import { closeTable } from '../../repositories/billingRepo.js';
import { publishMenuChange, publishSpecialChanged, type MenuChangeReason } from '../../menuEvents.js';
import { setPresenceForTest } from '../../presence.js';
import { resetLoginAttemptsForTest } from '../../staffAccess.js';
import { toIso } from '../../time.js';

export { staffCookie, staffCookie as signInAsStaff, requestAsStaff } from './staff.js';
/** Forgets every wrong-PIN count, so test files that share one client address never lock each other out (BR1.4). */
export const resetLockout = resetLoginAttemptsForTest;
/** Makes a table show `count` present diner pages and publishes TABLE_PRESENCE_CHANGED at once (BR8). */
export const setPresence = setPresenceForTest;
export { publishMenuChange };

let keyCounter = 0;
export function uniqueKey(prefix = 'helper'): string {
  return `${prefix}-${Date.now()}-${++keyCounter}`;
}

/** Places an order the way the diner route does, with options and/or special lines, and publishes ORDER_PLACED. */
export function placeOrderWithOptions(
  tableId: number,
  lines: PlaceOrderInputLine[],
  options: { key?: string; estimateMinutes?: number | null } = {}
): PlaceOrderResult {
  const result = placeOrderAtTable(tableId, options.key ?? uniqueKey(), lines, options.estimateMinutes ?? 15);
  if (!result.isDuplicate) {
    const payload = {
      order_number: result.order_number,
      table_id: tableId,
      visit_id: result.visit_id,
      status: result.status,
      placed_at: result.placed_at,
      estimate_minutes: result.estimate_minutes,
      lines: result.lines.map((l) => ({ ...l })),
      total_cents: result.lines.reduce((sum, l) => sum + l.subtotal_cents, 0),
    };
    publish('staff', 'ORDER_PLACED', payload);
    publish(`table:${tableId}`, 'ORDER_PLACED', payload);
    if (result.special_stock_changed) publishSpecialChanged(getCurrentSpecial());
  }
  return result;
}

/** Moves an order to Preparing or Completed (or Cancelled) as staff, station or diner, and publishes ORDER_STATUS_CHANGED. */
export function moveOrder(orderNumber: number, to: OrderStatus, actor: 'staff' | 'station' | 'diner' = 'staff') {
  const result = transitionOrder(orderNumber, to, actor);
  const payload = {
    order_number: result.order_number,
    table_id: result.table_id,
    status: result.status,
    ...(result.completed_at ? { completed_at: result.completed_at } : {}),
  };
  publish('staff', 'ORDER_STATUS_CHANGED', payload);
  publish(`table:${result.table_id}`, 'ORDER_STATUS_CHANGED', payload);
  return result;
}

/** Launches a special (ends the live one) and publishes SPECIAL_CHANGED. */
export function launchSpecial(input: LaunchInput, now: Date = new Date()): ChefSpecial {
  const special = launchSpecialRepo(input, now);
  publishSpecialChanged(special);
  return special;
}

/** Changes the live special's price, stock or end time directly and publishes SPECIAL_CHANGED. Returns it, or null when none is live. */
export function changeSpecial(change: { special_price_cents?: number; stock_left?: number; ends_at?: string }): ChefSpecial | null {
  const live = getCurrentSpecial();
  if (!live) return null;
  const db = getDb();
  if (change.special_price_cents !== undefined) db.prepare('UPDATE chef_specials SET special_price_cents = ? WHERE id = ?').run(change.special_price_cents, live.id);
  if (change.stock_left !== undefined) db.prepare('UPDATE chef_specials SET stock_left = ? WHERE id = ?').run(change.stock_left, live.id);
  if (change.ends_at !== undefined) db.prepare('UPDATE chef_specials SET ends_at = ? WHERE id = ?').run(change.ends_at, live.id);
  const now = getCurrentSpecial();
  publishSpecialChanged(now);
  return now;
}

/** Ends the live special now and publishes SPECIAL_CHANGED with null. Returns whether there was one. */
export function endSpecial(now: Date = new Date()): boolean {
  const ended = endCurrentSpecial(now);
  if (ended) publishSpecialChanged(null);
  return ended;
}

/** A diner presses a call button; publishes SERVICE_CALL_OPENED when a new request was made. */
export function openCall(tableId: number, kind: CallKind): { call: ServiceCall; created: boolean } {
  const result = openCallRepo(tableId, kind);
  if (result.created) {
    const payload = { call_id: result.call.id, table_id: tableId, kind, opened_at: result.call.opened_at };
    publish('staff', 'SERVICE_CALL_OPENED', payload);
    publish(`table:${tableId}`, 'SERVICE_CALL_OPENED', payload);
  }
  return result;
}

/** Staff respond; publishes SERVICE_CALL_RESPONDED when the request changed. */
export function respondCall(callId: string) {
  const result = respondCallRepo(callId);
  if (result.changed) {
    const payload = { call_id: callId, table_id: result.call.table_id, kind: result.call.kind, responded_at: result.call.responded_at };
    publish('staff', 'SERVICE_CALL_RESPONDED', payload);
    publish(`table:${result.call.table_id}`, 'SERVICE_CALL_RESPONDED', payload);
  }
  return result;
}

/**
 * Finishes the table's open orders, closes it (publishing TABLE_CLOSED) and rates dishes of that visit.
 * Returns the closed visit's id. `done` locks the ratings.
 */
export function closeTableAndRate(tableId: number, ratings: Array<{ item_id: string; thumb: 'up' | 'down' }> = [], done = false): string {
  const visit = getDb().prepare('SELECT id FROM visits WHERE table_id = ? AND closed_at IS NULL').get(tableId) as { id: string } | undefined;
  if (visit) {
    for (const o of getOrdersByVisit(visit.id)) {
      if (o.status === 'Pending') moveOrder(o.order_number, 'Preparing');
      if (o.status === 'Pending' || o.status === 'Preparing') moveOrder(o.order_number, 'Completed');
    }
  }
  const { archived_visit_id } = closeTable(tableId);
  const payload = { table_id: tableId, archived_visit_id };
  publish('staff', 'TABLE_CLOSED', payload);
  publish(`table:${tableId}`, 'TABLE_CLOSED', payload);
  if (ratings.length > 0 || done) saveRatings(tableId, archived_visit_id, ratings, done);
  return archived_visit_id;
}

export interface MenuChange {
  /** Item fields to set. */
  item?: { id: string; name?: string; price_cents?: number; hidden?: boolean; available?: boolean; station?: string; allergens?: string[] | null };
  /** Category fields to set. */
  category?: { id: string; name?: string; hidden?: boolean };
  /** Replace an item's option groups (ids are kept as given). */
  options?: { item_id: string; groups: Array<{ id: string; name: string; kind: 'one' | 'any' | 'leave_out'; required?: boolean; choices: Array<{ id: string; label: string; price_delta_cents?: number }> }> };
}

/**
 * Changes a menu item, category, hidden flag or option groups directly in the database and publishes
 * MENU_CHANGED (and MENU_AVAILABILITY_CHANGED for the sold-out switch), so a Unit can test a live menu
 * change and the cart's "no longer on the menu" notice without U7's Menu management.
 */
export function changeMenuDirectly(change: MenuChange, publishEvent = true): void {
  const db = getDb();
  const reasons = new Set<MenuChangeReason>();
  const ids: string[] = [];
  if (change.item) {
    const { id, ...fields } = change.item;
    const columns: Record<string, unknown> = {
      name: fields.name,
      price_cents: fields.price_cents,
      hidden: fields.hidden === undefined ? undefined : fields.hidden ? 1 : 0,
      available: fields.available === undefined ? undefined : fields.available ? 1 : 0,
      station: fields.station,
      allergens: fields.allergens === undefined ? undefined : fields.allergens === null ? null : JSON.stringify(fields.allergens),
    };
    for (const [column, value] of Object.entries(columns)) {
      if (value !== undefined) db.prepare(`UPDATE items SET ${column} = ? WHERE id = ?`).run(value as string | number | null, id);
    }
    reasons.add('item');
    ids.push(id);
    if (fields.available !== undefined && publishEvent) {
      const tables = db.prepare('SELECT id FROM tables').all() as Array<{ id: number }>;
      for (const t of tables) publish(`table:${t.id}`, 'MENU_AVAILABILITY_CHANGED', { menu_item_id: id, available: fields.available });
      publish('staff', 'MENU_AVAILABILITY_CHANGED', { menu_item_id: id, available: fields.available });
    }
  }
  if (change.category) {
    const { id, name, hidden } = change.category;
    if (name !== undefined) db.prepare('UPDATE categories SET name = ? WHERE id = ?').run(name, id);
    if (hidden !== undefined) db.prepare('UPDATE categories SET hidden = ? WHERE id = ?').run(hidden ? 1 : 0, id);
    reasons.add('category');
    ids.push(id);
  }
  if (change.options) {
    const { item_id, groups } = change.options;
    db.transaction(() => {
      db.prepare('DELETE FROM option_choices WHERE group_id IN (SELECT id FROM option_groups WHERE item_id = ?)').run(item_id);
      db.prepare('DELETE FROM option_groups WHERE item_id = ?').run(item_id);
      groups.forEach((g, gi) => {
        db.prepare('INSERT INTO option_groups (id, item_id, name, kind, required, sort_order) VALUES (?, ?, ?, ?, ?, ?)').run(g.id, item_id, g.name, g.kind, g.required ? 1 : 0, gi + 1);
        g.choices.forEach((c, ci) => db.prepare('INSERT INTO option_choices (id, group_id, label, price_delta_cents, sort_order) VALUES (?, ?, ?, ?, ?)').run(c.id, g.id, c.label, c.price_delta_cents ?? 0, ci + 1));
      });
    })();
    reasons.add('options');
    ids.push(item_id);
  }
  if (publishEvent && reasons.size > 0) {
    // One event per reason, as U7's routes would send it.
    for (const reason of reasons) publishMenuChange(reason, ids);
  }
}

/** Marks an order's time, for tests of the estimate: sets placed_at and completed_at directly. */
export function setOrderTimes(orderNumber: number, placedAt: Date, completedAt: Date | null): void {
  getDb().prepare('UPDATE orders SET placed_at = ?, completed_at = ? WHERE order_number = ?').run(toIso(placedAt), completedAt ? toIso(completedAt) : null, orderNumber);
}
