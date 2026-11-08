/**
 * Chef's specials (U5 Step 5). Rules: BR5.1 (launch validation, one live special), BR5.2 (what live
 * means), BR5.3 (guarded stock reduction, used by orderRepo), BR5.4 (priced by the server),
 * BR5.5 (expiry check).
 */
import { getDb } from '../db.js';
import { AppError } from '../errors.js';
import { SPECIAL_MINUTES_MAX, SPECIAL_STOCK_MAX } from '../config.js';
import { toIso } from '../time.js';

export interface ChefSpecial {
  id: string;
  item_id: string;
  name: string;
  special_price_cents: number;
  stock_left: number;
  /** ISO 8601 UTC */
  ends_at: string;
}

export interface LaunchInput {
  item_id: unknown;
  special_price_cents: unknown;
  stock: unknown;
  minutes: unknown;
}

const SPECIAL_SELECT = `SELECT s.id, s.item_id, i.name, s.special_price_cents, s.stock_left, s.ends_at
  FROM chef_specials s JOIN items i ON i.id = s.item_id`;

function isWholeNumber(value: unknown, min: number, max: number): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max;
}

function invalid(field: string, message: string): AppError {
  return new AppError('INVALID_REQUEST', message, { field });
}

/**
 * Launches a special and ends any special that is still live, in one transaction (BR5.1).
 * Throws INVALID_REQUEST with details.field for a bad value.
 */
export function launchSpecial(input: LaunchInput, now: Date = new Date()): ChefSpecial {
  const db = getDb();
  if (typeof input.item_id !== 'string' || input.item_id === '') throw invalid('item_id', 'item_id is required');
  if (!isWholeNumber(input.special_price_cents, 1, Number.MAX_SAFE_INTEGER)) {
    throw invalid('special_price_cents', 'special_price_cents must be a whole number of cents, 1 or more');
  }
  if (!isWholeNumber(input.stock, 1, SPECIAL_STOCK_MAX)) {
    throw invalid('stock', `stock must be a whole number from 1 to ${SPECIAL_STOCK_MAX}`);
  }
  if (!isWholeNumber(input.minutes, 1, SPECIAL_MINUTES_MAX)) {
    throw invalid('minutes', `minutes must be a whole number from 1 to ${SPECIAL_MINUTES_MAX}`);
  }
  const itemId = input.item_id;
  const price = input.special_price_cents;
  const stock = input.stock;
  const minutes = input.minutes;

  const run = db.transaction((): ChefSpecial => {
    // The item must exist, not be hidden (itself or through its category) and be available.
    const item = db
      .prepare(
        `SELECT items.available, items.hidden, categories.hidden AS category_hidden
         FROM items JOIN categories ON categories.id = items.category_id WHERE items.id = ?`
      )
      .get(itemId) as { available: number; hidden: number; category_hidden: number } | undefined;
    if (!item) throw invalid('item_id', `Item ${itemId} not found`);
    if (item.hidden === 1 || item.category_hidden === 1) throw invalid('item_id', `Item ${itemId} is hidden`);
    if (item.available !== 1) throw invalid('item_id', `Item ${itemId} is sold out`);
    // Integration fix: the special price plus the item's cheapest options must not cost less than nothing, or the
    // server would refuse every order that takes the special with its cheapest options (INVALID_OPTIONS).
    const cheapest = price + lowestOptionTotal(itemId);
    if (cheapest < 0) {
      throw invalid(
        'special_price_cents',
        'With the item\'s current options this special price could make the item cost less than $0.00. Raise the special price.'
      );
    }

    const nowIso = toIso(now);
    // At most one special is live: end every special that is not ended yet.
    db.prepare('UPDATE chef_specials SET ended_at = ? WHERE ended_at IS NULL').run(nowIso);

    const id = crypto.randomUUID();
    const endsAt = toIso(new Date(now.getTime() + minutes * 60_000));
    db.prepare(
      `INSERT INTO chef_specials (id, item_id, special_price_cents, stock_total, stock_left, ends_at, ended_at)
       VALUES (?, ?, ?, ?, ?, ?, NULL)`
    ).run(id, itemId, price, stock, stock, endsAt);

    return db.prepare(`${SPECIAL_SELECT} WHERE s.id = ?`).get(id) as ChefSpecial;
  });
  return run.immediate();
}

/** The live special, or null: not ended, its time not passed and stock left (BR5.2). */
export function getCurrentSpecial(now: Date = new Date()): ChefSpecial | null {
  // Integration fix: a special whose item is hidden, whose category is hidden, or whose item is sold out is not
  // live (the diner cannot order it), whatever its time and stock say. It is live again when the item is back.
  const row = getDb()
    .prepare(
      `${SPECIAL_SELECT} JOIN categories c ON c.id = i.category_id
       WHERE s.ended_at IS NULL AND s.ends_at > ? AND s.stock_left > 0
         AND i.hidden = 0 AND c.hidden = 0 AND i.available = 1
       ORDER BY s.ends_at DESC LIMIT 1`
    )
    .get(toIso(now)) as ChefSpecial | undefined;
  return row ?? null;
}

/**
 * The lowest the options of an item can add to a line: a required choose-one group adds its cheapest choice, an
 * optional one its cheapest or 0, choose-any and leave-out groups the sum of their negative changes (same rule as BR5.4).
 */
export function lowestOptionTotal(itemId: string): number {
  const db = getDb();
  const groups = db.prepare('SELECT id, kind, required FROM option_groups WHERE item_id = ?').all(itemId) as Array<{ id: string; kind: string; required: number }>;
  let total = 0;
  for (const g of groups) {
    const deltas = (db.prepare('SELECT price_delta_cents AS d FROM option_choices WHERE group_id = ?').all(g.id) as Array<{ d: number }>).map((r) => r.d);
    if (deltas.length === 0) continue;
    if (g.kind === 'one') {
      const cheapest = Math.min(...deltas);
      total += g.required ? cheapest : Math.min(0, cheapest);
    } else {
      total += deltas.filter((d) => d < 0).reduce((s, d) => s + d, 0);
    }
  }
  return total;
}

/** A special by id, live or not (used to price and check a special line). */
export function getSpecialById(id: string): (ChefSpecial & { ended_at: string | null }) | null {
  const row = getDb()
    .prepare(
      `SELECT s.id, s.item_id, i.name, s.special_price_cents, s.stock_left, s.ends_at, s.ended_at
       FROM chef_specials s JOIN items i ON i.id = s.item_id WHERE s.id = ?`
    )
    .get(id) as (ChefSpecial & { ended_at: string | null }) | undefined;
  return row ?? null;
}

/** True when a special passes BR5.2 right now. */
export function isLive(special: { ended_at: string | null; ends_at: string; stock_left: number }, now: Date): boolean {
  return special.ended_at === null && special.ends_at > toIso(now) && special.stock_left > 0;
}

/** Ends the live special at once. Returns true when there was one to end. Ending twice is harmless. */
export function endCurrentSpecial(now: Date = new Date()): boolean {
  const result = getDb().prepare('UPDATE chef_specials SET ended_at = ? WHERE ended_at IS NULL').run(toIso(now));
  return result.changes > 0;
}

/**
 * The 5-second check (BR5.5): ends every special whose time has passed. Returns true when one was
 * ended just now, so the caller publishes SPECIAL_CHANGED with null once.
 */
export function expireSpecials(now: Date = new Date()): boolean {
  const nowIso = toIso(now);
  const result = getDb()
    .prepare('UPDATE chef_specials SET ended_at = ? WHERE ended_at IS NULL AND ends_at <= ?')
    .run(nowIso, nowIso);
  return result.changes > 0;
}

/**
 * The guarded stock reduction of BR5.3: one statement, true only when the special is live and has
 * at least `qty` left. Called inside the order's transaction, after every other check has passed.
 */
export function reduceSpecialStock(specialId: string, qty: number, now: Date): boolean {
  const result = getDb()
    .prepare(
      `UPDATE chef_specials SET stock_left = stock_left - :qty
       WHERE id = :id AND ended_at IS NULL AND ends_at > :now AND stock_left >= :qty`
    )
    .run({ qty, id: specialId, now: toIso(now) });
  return result.changes === 1;
}

/** When a sell-out empties the stock, the special ends in the same transaction (so the timer does not repeat it). */
export function endIfSoldOut(specialId: string, now: Date): void {
  getDb()
    .prepare('UPDATE chef_specials SET ended_at = ? WHERE id = ? AND ended_at IS NULL AND stock_left <= 0')
    .run(toIso(now), specialId);
}
