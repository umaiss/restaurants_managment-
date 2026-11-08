// U7 Step 5: menu management writes (BR5.2 to BR5.4, BR5.6).
process.env.DB_FILE = ':memory:';

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getDb } from '../../db.js';
import { getMenu, getStaffMenu } from '../../repositories/menuRepo.js';
import { createCategory, createItem, replaceOptions, updateCategory, updateItem } from '../../routes/u7/menuAdmin.js';
import { placeOrderWithOptions } from '../helpers/index.js';
import { cleanup, freshApp } from './setup.js';

const newItem = { name: 'Tomato Soup', price_cents: 700, category_id: 'c-01' };
const fail = (fn: () => unknown, field: string) =>
  expect(fn).toThrowError(expect.objectContaining({ code: 'INVALID_REQUEST', details: expect.objectContaining({ field }) }));

describe('items (BR5.2)', () => {
  beforeEach(freshApp);
  afterEach(cleanup);

  it('creates an item with a server-made id, available, not hidden, Grill and allergens not set by default', () => {
    const item = createItem(newItem);
    expect(item.id).toMatch(/^i-[0-9a-f]{12}$/);
    expect(item).toMatchObject({ name: 'Tomato Soup', price_cents: 700, available: true, hidden: false, station: 'Grill', allergens: null, description: '', image: '', options: [] });
    expect(getStaffMenu().items).toHaveLength(13);
  });

  it('creates an item with every field sent', () => {
    const item = createItem({ ...newItem, description: 'Warm', image: '🍅', station: 'Cold', allergens: ['dairy'], hidden: true });
    expect(item).toMatchObject({ description: 'Warm', image: '🍅', station: 'Cold', allergens: ['dairy'], hidden: true });
  });

  it('trims the name', () => {
    expect(createItem({ ...newItem, name: '  Tomato Soup  ' }).name).toBe('Tomato Soup');
  });

  it('a PATCH changes only the fields sent', () => {
    const before = getStaffMenu().items.find((i) => i.id === 'i-02')!;
    const after = updateItem('i-02', { price_cents: 900 });
    expect(after).toEqual({ ...before, price_cents: 900 });
  });

  it('a PATCH can hide an item, set its allergens back to not set, and change its station', () => {
    const after = updateItem('i-01', { hidden: true, allergens: null, station: 'Cold' });
    expect(after).toMatchObject({ hidden: true, allergens: null, station: 'Cold' });
  });

  it('a hidden item is not on the diner menu but still on the staff menu, and keeps its price on past orders (BR5.6)', () => {
    const order = placeOrderWithOptions(2, [{ menu_item_id: 'i-02', quantity: 2 }]);
    updateItem('i-02', { hidden: true, price_cents: 1200 });
    expect(getMenu().items.some((i) => i.id === 'i-02')).toBe(false);
    expect(getStaffMenu().items.some((i) => i.id === 'i-02')).toBe(true);
    expect(getDb().prepare('SELECT unit_price_cents FROM order_items WHERE order_id = (SELECT id FROM orders WHERE order_number = ?)').get(order.order_number)).toEqual({ unit_price_cents: 850 });
  });

  it('an unknown item is UNKNOWN_ITEM', () => {
    expect(() => updateItem('i-nope', { name: 'X' })).toThrowError(expect.objectContaining({ code: 'UNKNOWN_ITEM' }));
  });

  it('names the first invalid field, and saves nothing', () => {
    fail(() => createItem({ ...newItem, name: '' }), 'name');
    fail(() => createItem({ ...newItem, name: 'x'.repeat(61) }), 'name');
    fail(() => createItem({ ...newItem, description: 'x'.repeat(301) }), 'description');
    fail(() => createItem({ ...newItem, price_cents: 0 }), 'price_cents');
    fail(() => createItem({ ...newItem, price_cents: 1_000_001 }), 'price_cents');
    fail(() => createItem({ ...newItem, price_cents: 12.5 }), 'price_cents');
    fail(() => createItem({ ...newItem, image: 'abcdef' }), 'image');
    fail(() => createItem({ ...newItem, category_id: 'c-99' }), 'category_id');
    fail(() => createItem({ ...newItem, station: 'Pantry' }), 'station');
    fail(() => createItem({ ...newItem, allergens: ['gluten', 'gluten'] }), 'allergens');
    fail(() => createItem({ ...newItem, allergens: ['mustard'] }), 'allergens');
    fail(() => createItem({ name: 'No price', category_id: 'c-01' }), 'price_cents');
    expect(getStaffMenu().items).toHaveLength(12);
  });

  it('accepts the limits: 60 characters, 1 cent, 1,000,000 cents, a 500-character web address, an 8-character emoji', () => {
    expect(createItem({ ...newItem, name: 'x'.repeat(60), price_cents: 1 })).toBeTruthy();
    expect(createItem({ ...newItem, price_cents: 1_000_000, image: `https://example.com/${'a'.repeat(480)}` })).toBeTruthy();
    expect(createItem({ ...newItem, image: '🍔🍟🥤🍦🍰🍕🍣🍜' })).toBeTruthy();
  });

  it('refuses control characters, a name of only spaces, and an image with a space', () => {
    fail(() => createItem({ ...newItem, name: 'Tomato\u0007Soup' }), 'name');
    fail(() => createItem({ ...newItem, name: '    ' }), 'name');
    fail(() => createItem({ ...newItem, description: 'line one\nline two' }), 'description');
    fail(() => createItem({ ...newItem, image: '🍅 🍅' }), 'image');
  });

  it('keeps text as text: markup in a name is stored exactly as typed', () => {
    expect(createItem({ ...newItem, name: '<b>Soup</b>' }).name).toBe('<b>Soup</b>');
  });

  it('a lower price that would put an item\'s options below zero is refused', () => {
    replaceOptions('i-04', { groups: [{ name: 'Deal', kind: 'any', choices: [{ label: 'Voucher', price_delta_cents: -1000 }] }] });
    fail(() => updateItem('i-04', { price_cents: 500 }), 'price_cents');
    expect(updateItem('i-04', { price_cents: 1000 }).price_cents).toBe(1000);
  });
});

describe('option groups (BR5.4)', () => {
  beforeEach(freshApp);
  afterEach(cleanup);

  const burger = () => getStaffMenu().items.find((i) => i.id === 'i-04')!;

  it('replaces the groups as a whole: ids listed are kept, new ones are made, one left out is removed', () => {
    const before = burger().options;
    const size = before.find((g) => g.id === 'og-04-size')!;
    const result = replaceOptions('i-04', {
      groups: [
        { id: 'og-04-size', name: 'Size', kind: 'one', required: true, choices: [{ id: 'oc-04-size-regular', label: 'Regular', price_delta_cents: 0 }, { label: 'Huge', price_delta_cents: 500 }] },
        { name: 'Sauce', kind: 'any', choices: [{ label: 'BBQ', price_delta_cents: 50 }] },
      ],
    });
    expect(result.map((g) => g.name)).toEqual(['Size', 'Sauce']);
    expect(result[0].id).toBe('og-04-size');
    expect(result[0].required).toBe(true);
    expect(result[0].choices.map((c) => c.label)).toEqual(['Regular', 'Huge']);
    expect(result[0].choices[0].id).toBe('oc-04-size-regular');
    expect(result[0].choices[1].id).toMatch(/^oc-/);
    expect(result[1].id).toMatch(/^og-/);
    // 'Large' was left out; Extras and Leave out were removed
    expect(getDb().prepare("SELECT COUNT(*) AS n FROM option_choices WHERE id = 'oc-04-size-large'").get()).toEqual({ n: 0 });
    expect(getDb().prepare("SELECT COUNT(*) AS n FROM option_groups WHERE id IN ('og-04-extras', 'og-04-leave-out')").get()).toEqual({ n: 0 });
    expect(size.choices).toHaveLength(2);
  });

  it('an id that does not belong to this item is not kept: a new id is made', () => {
    const result = replaceOptions('i-04', { groups: [{ id: 'og-06-size', name: 'Mine', kind: 'one', choices: [{ id: 'oc-06-size-large', label: 'Big', price_delta_cents: 1 }] }] });
    expect(result[0].id).not.toBe('og-06-size');
    expect(result[0].choices[0].id).not.toBe('oc-06-size-large');
    // item i-06's own groups are untouched
    expect(getStaffMenu().items.find((i) => i.id === 'i-06')!.options.map((g) => g.id)).toEqual(['og-06-size']);
  });

  it('an empty list removes every group', () => {
    expect(replaceOptions('i-04', { groups: [] })).toEqual([]);
    expect(burger().options).toEqual([]);
  });

  it('keeps option order as listed', () => {
    const result = replaceOptions('i-04', { groups: [
      { name: 'B', kind: 'any', choices: [{ label: 'two' }, { label: 'one' }] },
      { name: 'A', kind: 'any', choices: [{ label: 'x' }] },
    ] });
    expect(result.map((g) => g.name)).toEqual(['B', 'A']);
    expect(result[0].choices.map((c) => c.label)).toEqual(['two', 'one']);
  });

  it('names the field of a bad group or choice, and a refused save changes nothing', () => {
    const snapshot = JSON.stringify(burger().options);
    fail(() => replaceOptions('i-04', { groups: [{ name: '', kind: 'one', choices: [{ label: 'a' }] }] }), 'groups[0].name');
    fail(() => replaceOptions('i-04', { groups: [{ name: 'G', kind: 'many', choices: [{ label: 'a' }] }] }), 'groups[0].kind');
    fail(() => replaceOptions('i-04', { groups: [{ name: 'G', kind: 'any', required: true, choices: [{ label: 'a' }] }] }), 'groups[0].required');
    fail(() => replaceOptions('i-04', { groups: [{ name: 'G', kind: 'any', choices: [] }] }), 'groups[0].choices');
    fail(() => replaceOptions('i-04', { groups: [{ name: 'G', kind: 'any', choices: [{ label: '' }] }] }), 'groups[0].choices[0].label');
    fail(() => replaceOptions('i-04', { groups: [{ name: 'G', kind: 'any', choices: [{ label: 'a' }, { label: 'b', price_delta_cents: 100_001 }] }] }), 'groups[0].choices[1].price_delta_cents');
    fail(() => replaceOptions('i-04', { groups: [{ name: 'G', kind: 'any', choices: [{ label: 'a', price_delta_cents: 1.5 }] }] }), 'groups[0].choices[0].price_delta_cents');
    fail(() => replaceOptions('i-04', { groups: 'nope' }), 'groups');
    expect(JSON.stringify(burger().options)).toBe(snapshot);
  });

  it('allows 6 groups and 12 choices, and refuses 7 groups and 13 choices', () => {
    const group = (n: number) => ({ name: `G${n}`, kind: 'any' as const, choices: [{ label: 'a' }] });
    expect(replaceOptions('i-04', { groups: [1, 2, 3, 4, 5, 6].map(group) })).toHaveLength(6);
    fail(() => replaceOptions('i-04', { groups: [1, 2, 3, 4, 5, 6, 7].map(group) }), 'groups');
    const choices = (n: number) => Array.from({ length: n }, (_, i) => ({ label: `c${i}` }));
    expect(replaceOptions('i-04', { groups: [{ name: 'G', kind: 'any', choices: choices(12) }] })[0].choices).toHaveLength(12);
    fail(() => replaceOptions('i-04', { groups: [{ name: 'G', kind: 'any', choices: choices(13) }] }), 'groups[0].choices');
  });

  it('the cheapest possible line price may not go below zero: required choose-one counts its cheapest choice, optional ones count 0 or less', () => {
    // item i-10 Sparkling Water, 350 cents
    fail(() => replaceOptions('i-10', { groups: [{ name: 'Size', kind: 'one', required: true, choices: [{ label: 'Tiny', price_delta_cents: -400 }, { label: 'Big', price_delta_cents: 100 }] }] }), 'groups[0].choices[0].price_delta_cents');
    // not required: the cheapest is 0 (nothing picked) or -400 when picked: still below zero
    fail(() => replaceOptions('i-10', { groups: [{ name: 'Size', kind: 'one', choices: [{ label: 'Tiny', price_delta_cents: -400 }] }] }), 'groups[0].choices[0].price_delta_cents');
    // two choose-any discounts add up
    fail(() => replaceOptions('i-10', { groups: [{ name: 'Deals', kind: 'any', choices: [{ label: 'A', price_delta_cents: -200 }, { label: 'B', price_delta_cents: -200 }] }] }), 'groups[0].choices[0].price_delta_cents');
    // exactly zero is allowed
    expect(replaceOptions('i-10', { groups: [{ name: 'Deals', kind: 'any', choices: [{ label: 'A', price_delta_cents: -350 }] }] })).toHaveLength(1);
  });

  it('an unknown item is UNKNOWN_ITEM', () => {
    expect(() => replaceOptions('i-nope', { groups: [] })).toThrowError(expect.objectContaining({ code: 'UNKNOWN_ITEM' }));
  });

  it('an order placed with an option id of the old list is dropped as OPTION_UNAVAILABLE after the replace (the diner side follows MENU_CHANGED)', () => {
    replaceOptions('i-04', { groups: [] });
    expect(() => placeOrderWithOptions(1, [{ menu_item_id: 'i-04', quantity: 1, option_ids: ['oc-04-size-large'] }])).toThrow(/EMPTY_ORDER/);
  });
});

describe('categories (BR5.3)', () => {
  beforeEach(freshApp);
  afterEach(cleanup);

  const names = () => getStaffMenu().categories.map((c) => c.name);

  it('creates a category last, with a server-made id', () => {
    const c = createCategory({ name: 'Specials of the week' });
    expect(c).toMatchObject({ name: 'Specials of the week', order: 5, hidden: false });
    expect(c.id).toMatch(/^c-[0-9a-f]{12}$/);
    expect(names().at(-1)).toBe('Specials of the week');
  });

  it('the name is unique ignoring case, for a new category and for a rename', () => {
    fail(() => createCategory({ name: 'mains' }), 'name');
    fail(() => updateCategory('c-01', { name: 'DESSERTS' }), 'name');
    expect(updateCategory('c-01', { name: 'STARTERS' }).name).toBe('STARTERS');
  });

  it('refuses an empty or 61-character name', () => {
    fail(() => createCategory({ name: '  ' }), 'name');
    fail(() => createCategory({ name: 'x'.repeat(61) }), 'name');
    fail(() => createCategory(null), 'name');
  });

  it('renames and hides a category, and a hidden category hides its items from the diner menu', () => {
    updateCategory('c-02', { name: 'Big plates', hidden: true });
    expect(getStaffMenu().categories.find((c) => c.id === 'c-02')).toMatchObject({ name: 'Big plates', hidden: true });
    const diner = getMenu();
    expect(diner.categories.map((c) => c.id)).not.toContain('c-02');
    expect(diner.items.some((i) => i.category_id === 'c-02')).toBe(false);
    expect(getStaffMenu().items.some((i) => i.category_id === 'c-02')).toBe(true);
  });

  it('moves a category up or down by swapping with its neighbour', () => {
    updateCategory('c-02', { move: 'up' });
    expect(names()).toEqual(['Mains', 'Starters', 'Desserts', 'Drinks']);
    updateCategory('c-02', { move: 'down' });
    updateCategory('c-02', { move: 'down' });
    expect(names()).toEqual(['Starters', 'Desserts', 'Mains', 'Drinks']);
  });

  it('moving the first up or the last down changes nothing', () => {
    updateCategory('c-01', { move: 'up' });
    updateCategory('c-04', { move: 'down' });
    expect(names()).toEqual(['Starters', 'Mains', 'Desserts', 'Drinks']);
  });

  it('an unknown category is UNKNOWN_CATEGORY, and a bad move or hidden value is refused', () => {
    expect(() => updateCategory('c-nope', { name: 'x' })).toThrowError(expect.objectContaining({ code: 'UNKNOWN_CATEGORY' }));
    fail(() => updateCategory('c-01', { move: 'sideways' }), 'move');
    fail(() => updateCategory('c-01', { hidden: 'yes' }), 'hidden');
  });
});
