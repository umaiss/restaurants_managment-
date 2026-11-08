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
  const row = getDb()
    .prepare(`${SPECIAL_SELECT} WHERE s.ended_at IS NULL AND s.ends_at > ? AND s.stock_left > 0 ORDER BY s.ends_at DESC LIMIT 1`)
    .get(toIso(now)) as ChefSpecial | undefined;
  return row ?? null;
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
