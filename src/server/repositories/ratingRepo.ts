/**
 * Dish ratings (U5 Step 5). Rules: BR7.1 (a rating is for a dish of the table's last closed visit,
 * checks in a fixed order), BR7.2 (one per dish and visit; changeable until Done locks it).
 */
import { getDb } from '../db.js';
import { AppError } from '../errors.js';
import { toIso } from '../time.js';
import { getLastClosedVisitId } from './tableRepo.js';

export type Thumb = 'up' | 'down';

export interface RatingInput {
  item_id: unknown;
  thumb: unknown;
}

/**
 * Saves ratings for the table's last closed visit. The checks run in this order and nothing is saved
 * unless all pass: (1) the visit is the table's most recent closed visit, else VISIT_NOT_CLOSED;
 * (2) every thumb is up or down, else INVALID_RATING; (3) every dish is on a non-cancelled order of
 * that visit, else ITEM_NOT_IN_VISIT; (4) no rating being changed is locked, else RATING_LOCKED.
 * `done` locks every rating the visit has (only ratings that exist; a dish never rated stays open).
 */
export function saveRatings(
  tableId: number,
  visitId: string,
  ratings: unknown,
  done: boolean,
  now: Date = new Date()
): { saved: number } {
  const db = getDb();

  const run = db.transaction((): { saved: number } => {
    // (1) the visit
    const table = db.prepare('SELECT id FROM tables WHERE id = ?').get(tableId);
    if (!table) throw new AppError('UNKNOWN_TABLE', `Table ${tableId} not found`);
    if (getLastClosedVisitId(tableId) !== visitId) {
      throw new AppError('VISIT_NOT_CLOSED', 'visit_id is not the table\'s most recent closed visit');
    }

    // (2) the thumbs
    if (!Array.isArray(ratings)) throw new AppError('INVALID_RATING', 'ratings must be a list');
    const wanted = new Map<string, Thumb>();
    for (const raw of ratings as unknown[]) {
      const r = (raw ?? {}) as RatingInput;
      if (typeof raw !== 'object' || raw === null || typeof r.item_id !== 'string' || r.item_id === '') {
        throw new AppError('INVALID_RATING', 'each rating needs an item_id and a thumb');
      }
      if (r.thumb !== 'up' && r.thumb !== 'down') {
        throw new AppError('INVALID_RATING', `thumb for ${r.item_id} must be "up" or "down"`);
      }
      wanted.set(r.item_id, r.thumb); // a later entry for the same dish replaces the earlier one
    }

    // (3) the dishes
    const onVisit = db.prepare(
      `SELECT 1 FROM order_items oi JOIN orders o ON o.id = oi.order_id
       WHERE o.visit_id = ? AND o.status != 'Cancelled' AND oi.item_id = ? LIMIT 1`
    );
    for (const itemId of wanted.keys()) {
      if (!onVisit.get(visitId, itemId)) {
        throw new AppError('ITEM_NOT_IN_VISIT', `Item ${itemId} is not on an order of this visit`, { item_id: itemId });
      }
    }

    // (4) the lock: only a rating that would change is refused
    const existing = db.prepare('SELECT thumb, locked FROM dish_ratings WHERE visit_id = ? AND item_id = ?');
    for (const [itemId, thumb] of wanted) {
      const row = existing.get(visitId, itemId) as { thumb: Thumb; locked: number } | undefined;
      if (row && row.locked === 1 && row.thumb !== thumb) {
        throw new AppError('RATING_LOCKED', `The rating for ${itemId} is locked`, { item_id: itemId });
      }
    }

    const nowIso = toIso(now);
    const upsert = db.prepare(
      `INSERT INTO dish_ratings (visit_id, item_id, thumb, rated_at, locked) VALUES (?, ?, ?, ?, 0)
       ON CONFLICT (visit_id, item_id) DO UPDATE SET thumb = excluded.thumb, rated_at = excluded.rated_at
       WHERE dish_ratings.locked = 0`
    );
    for (const [itemId, thumb] of wanted) upsert.run(visitId, itemId, thumb, nowIso);

    if (done) db.prepare('UPDATE dish_ratings SET locked = 1 WHERE visit_id = ?').run(visitId);
    return { saved: wanted.size };
  });
  return run.immediate();
}
