// U5 Step 6: placing orders with options and specials (BR3.1 to BR3.7, BR3.10, BR5.3, BR5.4, BR12.1).
process.env.DB_FILE = ':memory:';

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getDb, resetDb, seedIfEmpty, openVisit, getCurrentVisit } from '../../db.js';
import { placeOrder, placeOrderAtTable, getOrdersByVisit } from '../../repositories/orderRepo.js';
import { launchSpecial } from '../../repositories/specialsRepo.js';

const count = (sql: string) => (getDb().prepare(sql).get() as { n: number }).n;
const stockLeft = (id: string) =>
  (getDb().prepare('SELECT stock_left FROM chef_specials WHERE id = ?').get(id) as { stock_left: number }).stock_left;

describe('placing an order with options', () => {
  beforeEach(() => {
    resetDb();
    seedIfEmpty();
  });
  afterEach(() => {
    resetDb();
  });

  it('prices a line as item price plus the chosen options, and freezes station and options (BR3.2, BR3.3)', () => {
    const visit = openVisit(1);
    const r = placeOrder(
      1,
      visit,
      'k-1',
      [{ menu_item_id: 'i-04', quantity: 2, option_ids: ['oc-04-size-large', 'oc-04-extras-cheese', 'oc-04-leave-onions'] }],
      12
    );
    // $14.50 + $3.00 + $1.00 + $0 = $18.50
    expect(r.lines[0]).toMatchObject({ price_cents_each: 1850, subtotal_cents: 3700, station: 'Grill' });
    expect(r.lines[0].options).toEqual([
      { label: 'Large', price_delta_cents: 300 },
      { label: 'Extra cheese', price_delta_cents: 100 },
      { label: 'No onions', price_delta_cents: 0 },
    ]);
    expect(r.estimate_minutes).toBe(12);

    // Later menu edits change nothing on the order
    getDb().prepare('UPDATE option_choices SET price_delta_cents = 999, label = ? WHERE id = ?').run('Huge', 'oc-04-size-large');
    getDb().prepare('UPDATE items SET price_cents = 1, station = ? WHERE id = ?').run('Bar', 'i-04');
    const [order] = getOrdersByVisit(visit);
    expect(order.lines[0]).toMatchObject({ price_cents_each: 1850, station: 'Grill' });
    expect(order.lines[0].options.map((o) => o.label)).toEqual(['Large', 'Extra cheese', 'No onions']);
    expect(order.estimate_minutes).toBe(12);
  });

  it('a line with no options is priced at the item price with an empty options list', () => {
    const r = placeOrder(1, openVisit(1), 'k-1', [{ menu_item_id: 'i-10', quantity: 1 }]);
    expect(r.lines[0]).toMatchObject({ price_cents_each: 350, station: 'Bar', options: [] });
    expect(r.estimate_minutes).toBeNull();
  });

  it('a required choose-one group with no choice is refused INVALID_OPTIONS (BR3.1 check 7)', () => {
    getDb().prepare("UPDATE option_groups SET required = 1 WHERE id = 'og-04-size'").run();
    const visit = openVisit(1);
    let error: unknown;
    try {
      placeOrder(1, visit, 'k-1', [{ menu_item_id: 'i-04', quantity: 1 }]);
    } catch (e) {
      error = e;
    }
    expect(error).toMatchObject({ code: 'INVALID_OPTIONS', details: { menu_item_id: 'i-04', group: 'Size' } });
    expect(count('SELECT COUNT(*) AS n FROM orders')).toBe(0);
  });

  it('two choices in a choose-one group are refused (check 6)', () => {
    expect(() =>
      placeOrder(1, openVisit(1), 'k-1', [
        { menu_item_id: 'i-04', quantity: 1, option_ids: ['oc-04-size-regular', 'oc-04-size-large'] },
      ])
    ).toThrow(/INVALID_OPTIONS/);
  });

  it('an option of another item is refused, not dropped (check 5)', () => {
    expect(() =>
      placeOrder(1, openVisit(1), 'k-1', [{ menu_item_id: 'i-06', quantity: 1, option_ids: ['oc-04-size-large'] }])
    ).toThrow(/INVALID_OPTIONS/);
  });

  it('the same choice sent twice is refused so it is never charged twice', () => {
    expect(() =>
      placeOrder(1, openVisit(1), 'k-1', [
        { menu_item_id: 'i-04', quantity: 1, option_ids: ['oc-04-extras-cheese', 'oc-04-extras-cheese'] },
      ])
    ).toThrow(/INVALID_OPTIONS/);
  });

  it('a line price that would fall below zero is refused', () => {
    getDb().prepare("UPDATE option_choices SET price_delta_cents = -5000 WHERE id = 'oc-04-leave-onions'").run();
    expect(() =>
      placeOrder(1, openVisit(1), 'k-1', [{ menu_item_id: 'i-04', quantity: 1, option_ids: ['oc-04-leave-onions'] }])
    ).toThrow(/INVALID_OPTIONS/);
  });

  it('an option that was removed drops the whole line with OPTION_UNAVAILABLE and the rest is placed (BR3.4)', () => {
    getDb().prepare("DELETE FROM option_choices WHERE id = 'oc-04-extras-bacon'").run();
    const r = placeOrder(1, openVisit(1), 'k-1', [
      { menu_item_id: 'i-04', quantity: 1, option_ids: ['oc-04-extras-bacon'] },
      { menu_item_id: 'i-10', quantity: 1 },
    ]);
    expect(r.dropped_lines).toEqual([{ menu_item_id: 'i-04', reason: 'OPTION_UNAVAILABLE' }]);
    expect(r.lines.map((l) => l.menu_item_id)).toEqual(['i-10']);
  });

  it('a replaced required group (new ids) drops the line instead of refusing it', () => {
    getDb().prepare("UPDATE option_groups SET required = 1 WHERE id = 'og-04-size'").run();
    getDb().prepare("DELETE FROM option_choices WHERE id = 'oc-04-size-large'").run();
    const r = placeOrder(1, openVisit(1), 'k-1', [
      { menu_item_id: 'i-04', quantity: 1, option_ids: ['oc-04-size-large'] },
      { menu_item_id: 'i-10', quantity: 1 },
    ]);
    expect(r.dropped_lines[0]).toEqual({ menu_item_id: 'i-04', reason: 'OPTION_UNAVAILABLE' });
  });

  it('an item that is hidden, or in a hidden category, is refused UNKNOWN_ITEM (BR2.1)', () => {
    getDb().prepare('UPDATE items SET hidden = 1 WHERE id = ?').run('i-01');
    expect(() => placeOrder(1, openVisit(1), 'k-1', [{ menu_item_id: 'i-01', quantity: 1 }])).toThrow(/UNKNOWN_ITEM/);
    getDb().prepare('UPDATE categories SET hidden = 1 WHERE id = ?').run('c-04');
    expect(() => placeOrder(1, openVisit(2), 'k-2', [{ menu_item_id: 'i-10', quantity: 1 }])).toThrow(/UNKNOWN_ITEM/);
  });

  it('a sold-out line is still dropped as in v1', () => {
    getDb().prepare('UPDATE items SET available = 0 WHERE id = ?').run('i-02');
    const r = placeOrder(1, openVisit(1), 'k-1', [
      { menu_item_id: 'i-02', quantity: 1 },
      { menu_item_id: 'i-01', quantity: 1 },
    ]);
    expect(r.dropped_lines).toEqual([{ menu_item_id: 'i-02', reason: 'SOLD_OUT_AT_SUBMIT' }]);
  });

  it('a repeated placement key returns the same order, drops nothing and reduces no stock (BR3.7)', () => {
    const special = launchSpecial({ item_id: 'i-01', special_price_cents: 400, stock: 5, minutes: 30 });
    const visit = openVisit(1);
    const lines = [{ menu_item_id: 'i-01', quantity: 2, special_id: special.id }];
    const first = placeOrder(1, visit, 'same-key', lines, 9);
    expect(stockLeft(special.id)).toBe(3);

    // The special sells out meanwhile; a replay must not see that as a dropped line
    getDb().prepare('UPDATE chef_specials SET stock_left = 0 WHERE id = ?').run(special.id);
    const again = placeOrder(1, visit, 'same-key', lines, 20);
    expect(again.isDuplicate).toBe(true);
    expect(again.order_number).toBe(first.order_number);
    expect(again.dropped_lines).toEqual([]);
    expect(again.estimate_minutes).toBe(9); // the stored one, not the new one
    expect(again.lines[0]).toMatchObject({ price_cents_each: 400, special_id: special.id });
    expect(stockLeft(special.id)).toBe(0); // untouched by the replay
  });

  it('an order with nothing left is EMPTY_ORDER and rolls back the stock reduction and the order number (BR3.10)', () => {
    const special = launchSpecial({ item_id: 'i-01', special_price_cents: 400, stock: 1, minutes: 30 });
    const visit = openVisit(1);
    expect(() =>
      placeOrder(1, visit, 'k-1', [
        { menu_item_id: 'i-01', quantity: 2, special_id: special.id }, // wants 2, only 1 left: dropped
      ])
    ).toThrow(/EMPTY_ORDER/);
    expect(stockLeft(special.id)).toBe(1);
    expect(count('SELECT COUNT(*) AS n FROM orders')).toBe(0);
    // The order number was not used up by the failed attempt
    expect(placeOrder(1, visit, 'k-2', [{ menu_item_id: 'i-10', quantity: 1 }]).order_number).toBe(1);
  });

  it('a refused order leaves no visit behind when the table had none (BR3.10)', () => {
    expect(() => placeOrderAtTable(3, 'k-1', [{ menu_item_id: 'nope', quantity: 1 }])).toThrow(/UNKNOWN_ITEM/);
    expect(getCurrentVisit(3)).toBeNull();
    expect(count('SELECT COUNT(*) AS n FROM visits')).toBe(0);

    const ok = placeOrderAtTable(3, 'k-2', [{ menu_item_id: 'i-01', quantity: 1 }]);
    expect(getCurrentVisit(3)?.id).toBe(ok.visit_id);
  });
});

describe('placing an order with a Chef\'s special (BR5.3, BR5.4)', () => {
  beforeEach(() => {
    resetDb();
    seedIfEmpty();
  });
  afterEach(() => {
    resetDb();
  });

  it('prices the line from the special, adds the options, and reduces the stock', () => {
    const special = launchSpecial({ item_id: 'i-04', special_price_cents: 1000, stock: 5, minutes: 30 });
    const r = placeOrder(1, openVisit(1), 'k-1', [
      { menu_item_id: 'i-04', quantity: 2, special_id: special.id, option_ids: ['oc-04-extras-cheese'] },
    ]);
    expect(r.lines[0]).toMatchObject({ price_cents_each: 1100, special_id: special.id });
    expect(r.special_stock_changed).toBe(true);
    expect(stockLeft(special.id)).toBe(3);
  });

  it('two orders for the last one: one wins, the other line is dropped SPECIAL_SOLD_OUT and the rest is placed', () => {
    const special = launchSpecial({ item_id: 'i-01', special_price_cents: 400, stock: 1, minutes: 30 });
    const a = placeOrder(1, openVisit(1), 'k-a', [{ menu_item_id: 'i-01', quantity: 1, special_id: special.id }]);
    const b = placeOrder(2, openVisit(2), 'k-b', [
      { menu_item_id: 'i-01', quantity: 1, special_id: special.id },
      { menu_item_id: 'i-10', quantity: 1 },
    ]);
    expect(a.dropped_lines).toEqual([]);
    expect(b.dropped_lines).toEqual([{ menu_item_id: 'i-01', reason: 'SPECIAL_SOLD_OUT' }]);
    expect(b.lines.map((l) => l.menu_item_id)).toEqual(['i-10']);
    expect(stockLeft(special.id)).toBe(0);
  });

  it('the stock never goes below zero when a quantity is larger than what is left', () => {
    const special = launchSpecial({ item_id: 'i-01', special_price_cents: 400, stock: 2, minutes: 30 });
    const r = placeOrder(1, openVisit(1), 'k-1', [
      { menu_item_id: 'i-01', quantity: 3, special_id: special.id },
      { menu_item_id: 'i-10', quantity: 1 },
    ]);
    expect(r.dropped_lines[0].reason).toBe('SPECIAL_SOLD_OUT');
    expect(stockLeft(special.id)).toBe(2);
  });

  it('several special lines add up their quantities against one stock', () => {
    const special = launchSpecial({ item_id: 'i-01', special_price_cents: 400, stock: 3, minutes: 30 });
    const r = placeOrder(1, openVisit(1), 'k-1', [
      { menu_item_id: 'i-01', quantity: 2, special_id: special.id },
      { menu_item_id: 'i-01', quantity: 2, special_id: special.id },
    ]);
    expect(r.lines).toHaveLength(1);
    expect(r.dropped_lines).toEqual([{ menu_item_id: 'i-01', reason: 'SPECIAL_SOLD_OUT' }]);
    expect(stockLeft(special.id)).toBe(1);
  });

  it('a special that has ended, a made-up special id, or a special of another item is dropped', () => {
    const special = launchSpecial({ item_id: 'i-01', special_price_cents: 400, stock: 5, minutes: 30 });
    const r = placeOrder(1, openVisit(1), 'k-1', [
      { menu_item_id: 'i-02', quantity: 1, special_id: special.id }, // wrong item
      { menu_item_id: 'i-01', quantity: 1, special_id: 'made-up' },
      { menu_item_id: 'i-10', quantity: 1 },
    ]);
    expect(r.dropped_lines.map((d) => d.reason)).toEqual(['SPECIAL_SOLD_OUT', 'SPECIAL_SOLD_OUT']);
    expect(stockLeft(special.id)).toBe(5);

    getDb().prepare("UPDATE chef_specials SET ended_at = '2020-01-01T00:00:00.000Z' WHERE id = ?").run(special.id);
    const later = placeOrder(1, openVisit(2), 'k-2', [
      { menu_item_id: 'i-01', quantity: 1, special_id: special.id },
      { menu_item_id: 'i-10', quantity: 1 },
    ]);
    expect(later.dropped_lines).toEqual([{ menu_item_id: 'i-01', reason: 'SPECIAL_SOLD_OUT' }]);
  });

  it('a special line with a removed option is dropped and leaves the special\'s stock unchanged (BR3.1)', () => {
    const special = launchSpecial({ item_id: 'i-04', special_price_cents: 1000, stock: 5, minutes: 30 });
    getDb().prepare("DELETE FROM option_choices WHERE id = 'oc-04-extras-bacon'").run();
    const r = placeOrder(1, openVisit(1), 'k-1', [
      { menu_item_id: 'i-04', quantity: 2, special_id: special.id, option_ids: ['oc-04-extras-bacon'] },
      { menu_item_id: 'i-10', quantity: 1 },
    ]);
    expect(r.dropped_lines).toEqual([{ menu_item_id: 'i-04', reason: 'OPTION_UNAVAILABLE' }]);
    expect(stockLeft(special.id)).toBe(5);
    expect(r.special_stock_changed).toBe(false);
  });

  it('a refused order (bad options) never uses up special stock', () => {
    const special = launchSpecial({ item_id: 'i-04', special_price_cents: 1000, stock: 5, minutes: 30 });
    expect(() =>
      placeOrder(1, openVisit(1), 'k-1', [
        { menu_item_id: 'i-04', quantity: 1, special_id: special.id },
        { menu_item_id: 'i-06', quantity: 1, option_ids: ['oc-04-size-large'] }, // another item's option: refused
      ])
    ).toThrow(/INVALID_OPTIONS/);
    expect(stockLeft(special.id)).toBe(5);
  });

  it('taking the last of the stock ends the special in the same transaction', () => {
    const special = launchSpecial({ item_id: 'i-01', special_price_cents: 400, stock: 1, minutes: 30 });
    placeOrder(1, openVisit(1), 'k-1', [{ menu_item_id: 'i-01', quantity: 1, special_id: special.id }]);
    const row = getDb().prepare('SELECT stock_left, ended_at FROM chef_specials WHERE id = ?').get(special.id) as {
      stock_left: number;
      ended_at: string | null;
    };
    expect(row.stock_left).toBe(0);
    expect(row.ended_at).not.toBeNull();
  });
});
