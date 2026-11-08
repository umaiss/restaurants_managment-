// U7 Step 7: the validation functions (BR5.2 to BR5.4).
import { describe, it, expect } from 'vitest';
import {
  checkAllergens, checkCategoryNameUnique, checkDescription, checkImage, checkName, checkPrice, checkStation,
  cheapestLinePrice, hasControlChars, lowestContribution, validateItemBody, validateOptionGroups, type GroupInput,
} from '../../routes/u7/validation.js';

const field = (fn: () => unknown) => {
  try {
    fn();
  } catch (e) {
    return (e as { details?: { field?: string } }).details?.field;
  }
  return undefined;
};

describe('single-field checks', () => {
  it('a name is required, trimmed, 1 to 60 characters and free of control characters', () => {
    expect(checkName('  Soup  ', 'name', 'Name')).toBe('Soup');
    expect(field(() => checkName(undefined, 'name', 'Name'))).toBe('name');
    expect(field(() => checkName('a'.repeat(61), 'name', 'Name'))).toBe('name');
    expect(field(() => checkName('a\u0000b', 'name', 'Name'))).toBe('name');
    expect(checkName('😀'.repeat(60), 'name', 'Name')).toHaveLength(120); // 60 characters, each two code units
  });

  it('a description may be empty and is at most 300 characters', () => {
    expect(checkDescription('')).toBe('');
    expect(checkDescription('d'.repeat(300))).toHaveLength(300);
    expect(field(() => checkDescription('d'.repeat(301)))).toBe('description');
    expect(field(() => checkDescription(5))).toBe('description');
  });

  it('a price is a whole number of cents from 1 to 1,000,000', () => {
    expect([checkPrice(1), checkPrice(1_000_000)]).toEqual([1, 1_000_000]);
    for (const bad of [0, -5, 1_000_001, 2.5, '300', null, NaN]) expect(field(() => checkPrice(bad))).toBe('price_cents');
  });

  it('an image is empty, a short emoji, or an http(s) address', () => {
    expect(checkImage('')).toBe('');
    expect(checkImage('🍔')).toBe('🍔');
    expect(checkImage('https://example.com/a.png')).toBe('https://example.com/a.png');
    expect(checkImage('http://example.com')).toBe('http://example.com');
    for (const bad of ['burger', 'ftp://x.com/a.png', '🍔🍟🥤🍦🍰🍕🍣🍜🍙', 'https://', `https://x.com/${'a'.repeat(500)}`, 'https://x.com/a b', 7]) {
      expect(field(() => checkImage(bad)), String(bad)).toBe('image');
    }
  });

  it('a station is one of the four', () => {
    expect(checkStation('Bar')).toBe('Bar');
    expect(field(() => checkStation('bar'))).toBe('station');
  });

  it('allergens are not set (null) or a list of the nine with no repeats; the empty list is a real answer', () => {
    expect(checkAllergens(null)).toBeNull();
    expect(checkAllergens([])).toEqual([]);
    expect(checkAllergens(['gluten', 'tree_nuts'])).toEqual(['gluten', 'tree_nuts']);
    expect(field(() => checkAllergens('gluten'))).toBe('allergens');
    expect(field(() => checkAllergens(['gluten', 'gluten']))).toBe('allergens');
    expect(field(() => checkAllergens(['mustard']))).toBe('allergens');
  });

  it('hasControlChars sees tabs, newlines and DEL but not ordinary text', () => {
    expect(hasControlChars('a\tb')).toBe(true);
    expect(hasControlChars('a\nb')).toBe(true);
    expect(hasControlChars('a\u007fb')).toBe(true);
    expect(hasControlChars('Crème Brûlée 🍮')).toBe(false);
  });

  it('category names are unique ignoring case, except against the category itself', () => {
    const existing = [{ id: 'c-1', name: 'Mains' }, { id: 'c-2', name: 'Drinks' }];
    expect(() => checkCategoryNameUnique('mains', existing)).toThrow();
    expect(() => checkCategoryNameUnique('MAINS', existing, 'c-1')).not.toThrow();
    expect(() => checkCategoryNameUnique('Sides', existing)).not.toThrow();
  });
});

describe('an item body (BR5.2)', () => {
  const ok = { name: 'Soup', price_cents: 500, category_id: 'c-01' };

  it('a POST needs a name, a price and a category', () => {
    expect(validateItemBody(ok, false)).toEqual({ name: 'Soup', price_cents: 500, category_id: 'c-01' });
    expect(field(() => validateItemBody({ price_cents: 500, category_id: 'c-01' }, false))).toBe('name');
    expect(field(() => validateItemBody({ name: 'Soup', category_id: 'c-01' }, false))).toBe('price_cents');
    expect(field(() => validateItemBody({ name: 'Soup', price_cents: 500 }, false))).toBe('category_id');
  });

  it('a PATCH checks only the fields sent', () => {
    expect(validateItemBody({}, true)).toEqual({});
    expect(validateItemBody({ station: 'Bar' }, true)).toEqual({ station: 'Bar' });
    expect(field(() => validateItemBody({ price_cents: 0 }, true))).toBe('price_cents');
  });

  it('names the FIRST invalid field in a fixed order when several are wrong', () => {
    expect(field(() => validateItemBody({ name: '', price_cents: 0, category_id: '' }, false))).toBe('name');
    expect(field(() => validateItemBody({ name: 'Soup', price_cents: 0, station: 'Nope', category_id: 'c-01' }, false))).toBe('price_cents');
  });

  it('refuses a body that is not an object, and a hidden flag that is not a boolean', () => {
    for (const bad of [null, 'text', [], 5]) expect(field(() => validateItemBody(bad, false))).toBe('body');
    expect(field(() => validateItemBody({ hidden: 'yes' }, true))).toBe('hidden');
  });
});

describe('option groups (BR5.4)', () => {
  const group = (over: Partial<GroupInput> = {}): GroupInput => ({ name: 'G', kind: 'any', required: false, choices: [{ label: 'a', price_delta_cents: 0 }], ...over });

  it('works out the lowest each kind of group can add to a line', () => {
    const one = (required: boolean) => group({ kind: 'one', required, choices: [{ label: 'a', price_delta_cents: -50 }, { label: 'b', price_delta_cents: 200 }] });
    expect(lowestContribution(one(true))).toBe(-50);
    expect(lowestContribution(one(false))).toBe(-50);
    expect(lowestContribution(group({ kind: 'one', required: true, choices: [{ label: 'a', price_delta_cents: 100 }, { label: 'b', price_delta_cents: 300 }] }))).toBe(100);
    expect(lowestContribution(group({ kind: 'one', required: false, choices: [{ label: 'a', price_delta_cents: 100 }] }))).toBe(0);
    expect(lowestContribution(group({ kind: 'any', choices: [{ label: 'a', price_delta_cents: -30 }, { label: 'b', price_delta_cents: -20 }, { label: 'c', price_delta_cents: 90 }] }))).toBe(-50);
    expect(lowestContribution(group({ kind: 'leave_out', choices: [{ label: 'a', price_delta_cents: 0 }] }))).toBeCloseTo(0);
  });

  it('the cheapest line price is the price plus every group\'s lowest', () => {
    const groups = [group({ kind: 'one', required: true, choices: [{ label: 'S', price_delta_cents: 100 }] }), group({ choices: [{ label: 'd', price_delta_cents: -40 }] })];
    expect(cheapestLinePrice(1000, groups)).toBe(1060);
  });

  it('refuses a body with no groups list and more than 6 groups', () => {
    expect(field(() => validateOptionGroups({}, 500))).toBe('groups');
    expect(field(() => validateOptionGroups({ groups: Array(7).fill(group()) }, 500))).toBe('groups');
  });

  it('a missing price change counts as 0, and an optional id is carried', () => {
    const [g] = validateOptionGroups({ groups: [{ id: 'og-1', name: ' Size ', kind: 'one', choices: [{ id: 'oc-1', label: 'S' }] }] }, 500);
    expect(g).toEqual({ id: 'og-1', name: 'Size', kind: 'one', required: false, choices: [{ id: 'oc-1', label: 'S', price_delta_cents: 0 }] });
  });

  it('a required flag is only for choose-one groups, and must be a boolean', () => {
    expect(field(() => validateOptionGroups({ groups: [{ name: 'G', kind: 'leave_out', required: true, choices: [{ label: 'a' }] }] }, 500))).toBe('groups[0].required');
    expect(field(() => validateOptionGroups({ groups: [{ name: 'G', kind: 'one', required: 'yes', choices: [{ label: 'a' }] }] }, 500))).toBe('groups[0].required');
  });

  it('refuses a price that can go below zero and names the choice that does it', () => {
    const body = { groups: [group({ name: 'Fine' }), { name: 'Deals', kind: 'any', choices: [{ label: 'x', price_delta_cents: 0 }, { label: 'y', price_delta_cents: -600 }] }] };
    expect(field(() => validateOptionGroups(body, 500))).toBe('groups[1].choices[1].price_delta_cents');
    expect(validateOptionGroups(body, 600)).toHaveLength(2);
  });
});
