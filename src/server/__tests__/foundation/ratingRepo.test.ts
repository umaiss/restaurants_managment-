// U5 Step 6: dish ratings (BR7.1, BR7.2).
process.env.DB_FILE = ':memory:';

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getDb, resetDb, seedIfEmpty, openVisit } from '../../db.js';
import { saveRatings } from '../../repositories/ratingRepo.js';
import { placeOrder, transitionOrder } from '../../repositories/orderRepo.js';
import { closeTable } from '../../repositories/billingRepo.js';

/** Table 1 orders a burger and a coffee, finishes, and closes. Returns the closed visit's id. */
function closedVisit(tableId = 1): string {
  const visit = openVisit(tableId);
  const o = placeOrder(tableId, visit, `k-${tableId}-${Math.random()}`, [
    { menu_item_id: 'i-04', quantity: 1 },
    { menu_item_id: 'i-12', quantity: 1 },
  ]);
  transitionOrder(o.order_number, 'Preparing', 'staff');
  transitionOrder(o.order_number, 'Completed', 'staff');
  closeTable(tableId);
  return visit;
}
const saved = (visit: string) =>
  getDb().prepare('SELECT item_id, thumb, locked FROM dish_ratings WHERE visit_id = ? ORDER BY item_id').all(visit);

const code = (fn: () => unknown) => {
  try {
    fn();
  } catch (e) {
    return (e as { code?: string }).code;
  }
  return undefined;
};

describe('ratingRepo', () => {
  beforeEach(() => {
    resetDb();
    seedIfEmpty();
  });
  afterEach(() => {
    resetDb();
  });

  it('saves thumbs for dishes of the last closed visit', () => {
    const visit = closedVisit();
    const r = saveRatings(1, visit, [{ item_id: 'i-04', thumb: 'up' }, { item_id: 'i-12', thumb: 'down' }], false);
    expect(r).toEqual({ saved: 2 });
    expect(saved(visit)).toEqual([
      { item_id: 'i-04', thumb: 'up', locked: 0 },
      { item_id: 'i-12', thumb: 'down', locked: 0 },
    ]);
  });

  it('a later post replaces the thumb until Done (BR7.2)', () => {
    const visit = closedVisit();
    saveRatings(1, visit, [{ item_id: 'i-04', thumb: 'up' }], false);
    saveRatings(1, visit, [{ item_id: 'i-04', thumb: 'down' }], false);
    expect(saved(visit)).toEqual([{ item_id: 'i-04', thumb: 'down', locked: 0 }]);
  });

  it('Done locks the ratings that exist; changing one is RATING_LOCKED, a dish never rated stays open', () => {
    const visit = closedVisit();
    saveRatings(1, visit, [{ item_id: 'i-04', thumb: 'up' }], true);
    expect(saved(visit)).toEqual([{ item_id: 'i-04', thumb: 'up', locked: 1 }]);

    expect(code(() => saveRatings(1, visit, [{ item_id: 'i-04', thumb: 'down' }], false))).toBe('RATING_LOCKED');
    expect(saved(visit)).toEqual([{ item_id: 'i-04', thumb: 'up', locked: 1 }]); // unchanged

    // The same thumb again is not a change
    expect(() => saveRatings(1, visit, [{ item_id: 'i-04', thumb: 'up' }], false)).not.toThrow();
    // The dish that was never rated can still be rated
    expect(() => saveRatings(1, visit, [{ item_id: 'i-12', thumb: 'up' }], false)).not.toThrow();
  });

  it('Done with no ratings locks nothing and saves nothing', () => {
    const visit = closedVisit();
    expect(saveRatings(1, visit, [], true)).toEqual({ saved: 0 });
    expect(saved(visit)).toEqual([]);
    expect(() => saveRatings(1, visit, [{ item_id: 'i-04', thumb: 'up' }], false)).not.toThrow();
  });

  it('a visit that is not the table\'s most recent closed visit is VISIT_NOT_CLOSED (check 1)', () => {
    const closed = closedVisit();
    const open = openVisit(2); // an open visit
    expect(code(() => saveRatings(2, open, [], false))).toBe('VISIT_NOT_CLOSED');
    expect(code(() => saveRatings(1, 'made-up', [], false))).toBe('VISIT_NOT_CLOSED');
    expect(code(() => saveRatings(2, closed, [], false))).toBe('VISIT_NOT_CLOSED'); // another table's visit

    // After a newer visit closes, the older one is no longer rateable
    const newer = openVisit(1);
    const o = placeOrder(1, newer, 'k-newer', [{ menu_item_id: 'i-01', quantity: 1 }]);
    transitionOrder(o.order_number, 'Preparing', 'staff');
    transitionOrder(o.order_number, 'Completed', 'staff');
    closeTable(1);
    expect(code(() => saveRatings(1, closed, [], false))).toBe('VISIT_NOT_CLOSED');
  });

  it('a thumb that is not up or down, or a malformed rating, is INVALID_RATING (check 2)', () => {
    const visit = closedVisit();
    expect(code(() => saveRatings(1, visit, [{ item_id: 'i-04', thumb: 'sideways' }], false))).toBe('INVALID_RATING');
    expect(code(() => saveRatings(1, visit, [{ item_id: 'i-04' }], false))).toBe('INVALID_RATING');
    expect(code(() => saveRatings(1, visit, [null], false))).toBe('INVALID_RATING');
    expect(code(() => saveRatings(1, visit, 'up', false))).toBe('INVALID_RATING');
  });

  it('a dish that is not on a non-cancelled order of the visit is ITEM_NOT_IN_VISIT (check 3)', () => {
    const visit = closedVisit();
    expect(code(() => saveRatings(1, visit, [{ item_id: 'i-10', thumb: 'up' }], false))).toBe('ITEM_NOT_IN_VISIT');
  });

  it('a dish only on a cancelled order cannot be rated', () => {
    const visit = openVisit(3);
    const done = placeOrder(3, visit, 'k-a', [{ menu_item_id: 'i-01', quantity: 1 }]);
    transitionOrder(done.order_number, 'Preparing', 'staff');
    transitionOrder(done.order_number, 'Completed', 'staff');
    const cancelled = placeOrder(3, visit, 'k-b', [{ menu_item_id: 'i-02', quantity: 1 }]);
    transitionOrder(cancelled.order_number, 'Cancelled', 'diner');
    closeTable(3);
    expect(code(() => saveRatings(3, visit, [{ item_id: 'i-02', thumb: 'up' }], false))).toBe('ITEM_NOT_IN_VISIT');
    expect(() => saveRatings(3, visit, [{ item_id: 'i-01', thumb: 'up' }], false)).not.toThrow();
  });

  it('nothing is saved unless every check passes', () => {
    const visit = closedVisit();
    expect(code(() => saveRatings(1, visit, [{ item_id: 'i-04', thumb: 'up' }, { item_id: 'i-10', thumb: 'up' }], false))).toBe(
      'ITEM_NOT_IN_VISIT'
    );
    expect(saved(visit)).toEqual([]);
  });

  it('the checks run in the order visit, thumb, dish, lock', () => {
    const visit = closedVisit();
    // Bad visit and bad thumb together: the visit is reported first
    expect(code(() => saveRatings(1, 'made-up', [{ item_id: 'i-04', thumb: 'x' }], false))).toBe('VISIT_NOT_CLOSED');
    // Bad thumb and a dish not on the visit together: the thumb is reported first
    expect(code(() => saveRatings(1, visit, [{ item_id: 'i-10', thumb: 'x' }], false))).toBe('INVALID_RATING');
    // Locked change and a dish not on the visit together: the dish is reported first
    saveRatings(1, visit, [{ item_id: 'i-04', thumb: 'up' }], true);
    expect(
      code(() => saveRatings(1, visit, [{ item_id: 'i-04', thumb: 'down' }, { item_id: 'i-10', thumb: 'up' }], false))
    ).toBe('ITEM_NOT_IN_VISIT');
  });

  it('an unknown table is UNKNOWN_TABLE', () => {
    expect(code(() => saveRatings(99, 'v', [], false))).toBe('UNKNOWN_TABLE');
  });
});
