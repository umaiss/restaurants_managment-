// U5 Step 6: menu data (BR2.1, BR2.2, BR2.3, BR2.7).
process.env.DB_FILE = ':memory:';

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getDb, resetDb, seedIfEmpty, openVisit } from '../../db.js';
import { getMenu, getStaffMenu, updateItemAvailability } from '../../repositories/menuRepo.js';
import { placeOrder, getOrdersByVisit } from '../../repositories/orderRepo.js';

describe('menuRepo (U5)', () => {
  beforeEach(() => {
    resetDb();
    seedIfEmpty();
  });
  afterEach(() => {
    resetDb();
  });

  it('the diner menu carries station, allergens and option groups for every item', () => {
    const menu = getMenu();
    expect(menu.items).toHaveLength(12);
    const burger = menu.items.find((i) => i.id === 'i-04')!;
    expect(burger.station).toBe('Grill');
    expect(burger.allergens).toEqual(['gluten', 'dairy', 'sesame']);
    expect(burger.options.map((g) => [g.name, g.kind])).toEqual([
      ['Size', 'one'],
      ['Extras', 'any'],
      ['Leave out', 'leave_out'],
    ]);
    const size = burger.options[0];
    expect(size.choices).toEqual([
      { id: 'oc-04-size-regular', label: 'Regular', price_delta_cents: 0 },
      { id: 'oc-04-size-large', label: 'Large', price_delta_cents: 300 },
    ]);
    // The staff-only flag is not part of the diner's item
    expect(burger).not.toHaveProperty('hidden');
  });

  it('allergens: not set is null and is never the same as an empty list (BR2.3)', () => {
    const items = getMenu().items;
    expect(items.find((i) => i.name === 'Grilled Salmon')!.allergens).toBeNull();
    expect(items.find((i) => i.name === 'Sparkling Water')!.allergens).toEqual([]);
  });

  it('a hidden item is left out of the diner menu but still in the staff menu (BR2.1, BR2.7)', () => {
    getDb().prepare('UPDATE items SET hidden = 1 WHERE id = ?').run('i-02');
    expect(getMenu().items.find((i) => i.id === 'i-02')).toBeUndefined();
    expect(getMenu().items).toHaveLength(11);

    const staff = getStaffMenu();
    const hidden = staff.items.find((i) => i.id === 'i-02')!;
    expect(hidden.hidden).toBe(true);
    expect(staff.items).toHaveLength(12);
    expect(staff.items.find((i) => i.id === 'i-01')!.hidden).toBe(false);
  });

  it('a hidden category takes its items off the diner menu and is flagged for staff', () => {
    getDb().prepare('UPDATE categories SET hidden = 1 WHERE id = ?').run('c-03');
    const menu = getMenu();
    expect(menu.categories.map((c) => c.id)).toEqual(['c-01', 'c-02', 'c-04']);
    expect(menu.items.some((i) => i.category_id === 'c-03')).toBe(false);

    const staff = getStaffMenu();
    expect(staff.categories).toHaveLength(4);
    expect(staff.categories.find((c) => c.id === 'c-03')!.hidden).toBe(true);
    expect(staff.items.filter((i) => i.category_id === 'c-03')).toHaveLength(2);
  });

  it('a hidden item stays on an old order by its frozen price (BR2.1)', () => {
    const visit = openVisit(1);
    placeOrder(1, visit, 'k-1', [{ menu_item_id: 'i-01', quantity: 2 }]);
    getDb().prepare('UPDATE items SET hidden = 1, price_cents = 9999 WHERE id = ?').run('i-01');

    const orders = getOrdersByVisit(visit);
    expect(orders[0].lines[0]).toMatchObject({ menu_item_id: 'i-01', price_cents_each: 650, subtotal_cents: 1300 });
    expect(getMenu().items.some((i) => i.id === 'i-01')).toBe(false);
  });

  it('an item with no station set counts as Grill (BR2.2)', () => {
    getDb().prepare("INSERT INTO items (id, category_id, name, price_cents) VALUES ('i-new', 'c-01', 'New', 100)").run();
    const item = getMenu().items.find((i) => i.id === 'i-new')!;
    expect(item.station).toBe('Grill');
    expect(item.allergens).toBeNull();
    expect(item.options).toEqual([]);
  });

  it('options come back in sort order, and a removed choice is gone from the menu', () => {
    getDb().prepare("DELETE FROM option_choices WHERE id = 'oc-04-extras-bacon'").run();
    const extras = getMenu().items.find((i) => i.id === 'i-04')!.options.find((g) => g.name === 'Extras')!;
    expect(extras.choices.map((c) => c.label)).toEqual(['Extra cheese']);
  });

  it('updateItemAvailability still works for hidden items and answers null for an unknown id', () => {
    getDb().prepare('UPDATE items SET hidden = 1 WHERE id = ?').run('i-02');
    expect(updateItemAvailability('i-02', false)?.available).toBe(false);
    expect(updateItemAvailability('nope', true)).toBeNull();
  });
});
