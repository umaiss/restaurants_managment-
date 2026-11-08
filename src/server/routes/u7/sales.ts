/**
 * Sales and ratings reports (U7 Step 4). Rules: BR7.1 (closed visits grouped by local day of closed_at,
 * either stored time format), BR7.2 (best sellers), BR7.3 (average minutes to Completed, null when none),
 * BR7.4 (cancelled orders count nowhere), BR7.6 (best and worst rated, with a stated tie rule).
 */
import { getDb } from '../../db.js';
import { parseStoredTime } from '../../time.js';
import { BEST_SELLERS_TOP, DAY_PATTERN, RATED_TOP, RATING_TIE_RULE } from './constants.js';
import { invalid } from './errors.js';

/** The server's local calendar day of an instant, as YYYY-MM-DD. */
export function localDay(date: Date): string {
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${m}-${d}`;
}

/** Reads YYYY-MM-DD; returns the same text when it is a real date, else null. */
export function readDay(text: unknown): string | null {
  if (typeof text !== 'string' || !DAY_PATTERN.test(text)) return null;
  const [y, m, d] = text.split('-').map(Number);
  const probe = new Date(y, m - 1, d);
  return probe.getFullYear() === y && probe.getMonth() === m - 1 && probe.getDate() === d ? text : null;
}

export interface BestSeller {
  item_id: string;
  name: string;
  quantity: number;
}

export interface SalesDay {
  day: string;
  visits: number;
  orders: number;
  total_cents: number;
  /** null when no order of the day has completed (BR7.3): the page says "No completed orders". */
  average_minutes: number | null;
  /** total / visits, rounded to whole cents (the mockup's "Average per visit"). */
  average_per_visit_cents: number;
  best_sellers: BestSeller[];
}

export interface SalesQuery {
  from?: unknown;
  to?: unknown;
}

export function getSales(query: SalesQuery = {}): SalesDay[] {
  let from: string | null = null;
  let to: string | null = null;
  if (query.from !== undefined) {
    from = readDay(query.from);
    if (from === null) throw invalid('from', 'from must be a date written YYYY-MM-DD.');
  }
  if (query.to !== undefined) {
    to = readDay(query.to);
    if (to === null) throw invalid('to', 'to must be a date written YYYY-MM-DD.');
  }

  const db = getDb();
  const visits = db.prepare('SELECT id, closed_at FROM visits WHERE closed_at IS NOT NULL').all() as Array<{ id: string; closed_at: string }>;

  const dayOfVisit = new Map<string, string>();
  for (const v of visits) {
    const closed = parseStoredTime(v.closed_at);
    if (closed) dayOfVisit.set(v.id, localDay(closed));
  }

  interface Acc {
    visits: number;
    orders: Set<number>;
    total: number;
    minutes: number[];
    sold: Map<string, BestSeller>;
  }
  const days = new Map<string, Acc>();
  const acc = (day: string): Acc => {
    let a = days.get(day);
    if (!a) {
      a = { visits: 0, orders: new Set(), total: 0, minutes: [], sold: new Map() };
      days.set(day, a);
    }
    return a;
  };
  for (const day of dayOfVisit.values()) acc(day).visits++;

  // Every line of every non-cancelled order of a closed visit (BR7.4), at the frozen line price (BR9.2).
  const lines = db
    .prepare(
      `SELECT o.order_number, o.visit_id, o.status, o.placed_at, o.completed_at,
              oi.item_id, i.name, oi.quantity, oi.unit_price_cents
       FROM orders o
       JOIN visits v ON v.id = o.visit_id AND v.closed_at IS NOT NULL
       JOIN order_items oi ON oi.order_id = o.id
       JOIN items i ON i.id = oi.item_id
       WHERE o.status != 'Cancelled'`
    )
    .all() as Array<{
    order_number: number;
    visit_id: string;
    status: string;
    placed_at: string;
    completed_at: string | null;
    item_id: string;
    name: string;
    quantity: number;
    unit_price_cents: number;
  }>;
  const timed = new Set<number>();
  for (const l of lines) {
    const day = dayOfVisit.get(l.visit_id);
    if (!day) continue;
    const a = acc(day);
    a.orders.add(l.order_number);
    a.total += l.quantity * l.unit_price_cents;
    const seen = a.sold.get(l.item_id);
    if (seen) seen.quantity += l.quantity;
    else a.sold.set(l.item_id, { item_id: l.item_id, name: l.name, quantity: l.quantity });
    if (l.status === 'Completed' && l.completed_at && !timed.has(l.order_number)) {
      timed.add(l.order_number);
      const placed = parseStoredTime(l.placed_at);
      const completed = parseStoredTime(l.completed_at);
      if (placed && completed) a.minutes.push((completed.getTime() - placed.getTime()) / 60_000);
    }
  }
  // An order with no lines still counts as an order of its day (it has a subtotal of 0).
  const bare = db
    .prepare(
      `SELECT o.order_number, o.visit_id FROM orders o JOIN visits v ON v.id = o.visit_id AND v.closed_at IS NOT NULL
       WHERE o.status != 'Cancelled' AND NOT EXISTS (SELECT 1 FROM order_items oi WHERE oi.order_id = o.id)`
    )
    .all() as Array<{ order_number: number; visit_id: string }>;
  for (const o of bare) {
    const day = dayOfVisit.get(o.visit_id);
    if (day) acc(day).orders.add(o.order_number);
  }

  return [...days.entries()]
    .filter(([day]) => (from === null || day >= from) && (to === null || day <= to))
    .sort(([a], [b]) => (a < b ? 1 : a > b ? -1 : 0))
    .map(([day, a]) => ({
      day,
      visits: a.visits,
      orders: a.orders.size,
      total_cents: a.total,
      average_minutes: a.minutes.length === 0 ? null : Math.round((a.minutes.reduce((s, m) => s + m, 0) / a.minutes.length) * 10) / 10,
      average_per_visit_cents: a.visits === 0 ? 0 : Math.round(a.total / a.visits),
      best_sellers: [...a.sold.values()]
        .sort((x, y) => y.quantity - x.quantity || x.name.localeCompare(y.name))
        .slice(0, BEST_SELLERS_TOP),
    }));
}

export interface RatedDish {
  item_id: string;
  name: string;
  up: number;
  total: number;
  /** up / total, from 0 to 1. */
  share: number;
}

export interface RatingsReport {
  day: string;
  best: RatedDish[];
  worst: RatedDish[];
  tie_rule: string;
}

/** BR7.6: the day's ratings by the local day each was made (rated_at). */
export function getRatings(dayInput: unknown, now: Date = new Date()): RatingsReport {
  let day = localDay(now);
  if (dayInput !== undefined) {
    const read = readDay(dayInput);
    if (read === null) throw invalid('day', 'day must be a date written YYYY-MM-DD.');
    day = read;
  }
  const rows = getDb()
    .prepare(
      `SELECT r.item_id, i.name, r.thumb, r.rated_at FROM dish_ratings r JOIN items i ON i.id = r.item_id`
    )
    .all() as Array<{ item_id: string; name: string; thumb: 'up' | 'down'; rated_at: string }>;

  const byDish = new Map<string, RatedDish>();
  for (const r of rows) {
    const at = parseStoredTime(r.rated_at);
    if (!at || localDay(at) !== day) continue;
    const d = byDish.get(r.item_id) ?? { item_id: r.item_id, name: r.name, up: 0, total: 0, share: 0 };
    d.total++;
    if (r.thumb === 'up') d.up++;
    byDish.set(r.item_id, d);
  }
  const dishes = [...byDish.values()].map((d) => ({ ...d, share: d.up / d.total }));
  const byName = (a: RatedDish, b: RatedDish) => a.name.localeCompare(b.name);
  return {
    day,
    best: [...dishes].sort((a, b) => b.share - a.share || b.total - a.total || byName(a, b)).slice(0, RATED_TOP),
    worst: [...dishes].sort((a, b) => a.share - b.share || b.total - a.total || byName(a, b)).slice(0, RATED_TOP),
    tie_rule: RATING_TIE_RULE,
  };
}
