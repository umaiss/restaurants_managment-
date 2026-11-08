// U6 Step 6: the cart line model and the cart refresh (BR1.1, BR1.2, BR1.4; D1 to D3).
import { describe, it, expect } from 'vitest';
import {
  computeRefresh,
  linePrice,
  lineLimit,
  makeLineId,
  normalizeCart,
  refreshNotice,
  type CartItem,
  type RefreshMenuItem,
} from '../cartModel.js';

const choice = (id: string, label: string, delta: number, group = 'Size') => ({ choiceId: id, group, label, priceDeltaCents: delta });

function line(over: Partial<CartItem> = {}): CartItem {
  return {
    lineId: 'i-04',
    menuItemId: 'i-04',
    name: 'Classic Burger',
    basePriceCents: 1450,
    priceCents: 1450,
    quantity: 1,
    optionChoices: [],
    ...over,
  };
}

const burger: RefreshMenuItem = {
  id: 'i-04',
  name: 'Classic Burger',
  price_cents: 1450,
  available: true,
  options: [
    { id: 'g-size', name: 'Size', kind: 'one', required: false, choices: [{ id: 'c-reg', label: 'Regular', price_delta_cents: 0 }, { id: 'c-lg', label: 'Large', price_delta_cents: 300 }] },
    { id: 'g-x', name: 'Extras', kind: 'any', required: false, choices: [{ id: 'c-ch', label: 'Extra cheese', price_delta_cents: 100 }] },
  ],
};

describe('line identity (BR1.1, D1)', () => {
  it('a plain item is identified by its item id, as v1 did', () => {
    expect(makeLineId('i-01', [])).toBe('i-01');
  });

  it('choices are sorted and joined, and a special id follows an @', () => {
    expect(makeLineId('i-04', ['c-ch', 'c-lg'])).toBe('i-04#c-ch+c-lg');
    expect(makeLineId('i-04', ['c-lg', 'c-ch'])).toBe('i-04#c-ch+c-lg');
    expect(makeLineId('i-04', ['c-lg'], 'sp-1')).toBe('i-04#c-lg@sp-1');
    expect(makeLineId('i-04', [], 'sp-1')).toBe('i-04@sp-1');
  });

  it('a cart saved by v1 loads as plain lines with the new fields filled in', () => {
    const loaded = normalizeCart([{ menuItemId: 'i-01', name: 'Garlic Bread', priceCents: 650, quantity: 2 }]);
    expect(loaded).toEqual([
      { lineId: 'i-01', menuItemId: 'i-01', name: 'Garlic Bread', basePriceCents: 650, priceCents: 650, quantity: 2, optionChoices: [] },
    ]);
  });

  it('unusable entries and a non-list are dropped instead of breaking the cart', () => {
    expect(normalizeCart('nope')).toEqual([]);
    expect(normalizeCart([null, { name: 'x' }, { menuItemId: 'i-01', name: 'A', priceCents: 1, quantity: 1 }])).toHaveLength(1);
  });
});

describe('price (BR1.2, D2)', () => {
  it('is the base plus the chosen changes', () => {
    expect(linePrice(1450, [{ priceDeltaCents: 300 }, { priceDeltaCents: 100 }])).toBe(1850);
  });

  it('never goes below zero', () => {
    expect(linePrice(100, [{ priceDeltaCents: -500 }])).toBe(0);
  });
});

describe('the line limit', () => {
  it('is 20, and a special line also its stock left', () => {
    expect(lineLimit({})).toBe(20);
    expect(lineLimit({ maxQuantity: 3 })).toBe(3);
    expect(lineLimit({ maxQuantity: 50 })).toBe(20);
  });
});

describe('cart refresh (BR1.4, D3)', () => {
  it('removes a line whose item is gone and names it', () => {
    const { lines, result, changed } = computeRefresh([line()], [], null);
    expect(lines).toEqual([]);
    expect(result.removed).toEqual(['Classic Burger']);
    expect(changed).toBe(true);
  });

  it('removes a line whose item is sold out', () => {
    const { lines, result } = computeRefresh([line()], [{ ...burger, available: false }], null);
    expect(lines).toEqual([]);
    expect(result.removed).toEqual(['Classic Burger']);
  });

  it('removes a line whose chosen option no longer exists', () => {
    const l = line({ lineId: 'i-04#c-gone', optionChoices: [choice('c-gone', 'Huge', 500)], priceCents: 1950 });
    const { lines, result } = computeRefresh([l], [burger], null);
    expect(lines).toEqual([]);
    expect(result.removed).toEqual(['Classic Burger']);
  });

  it('removes a line when a group became required and has no choice', () => {
    const required = { ...burger, options: [{ ...burger.options![0], required: true }, burger.options![1]] };
    const { lines, result } = computeRefresh([line()], [required], null);
    expect(lines).toEqual([]);
    expect(result.removed).toEqual(['Classic Burger']);
  });

  it('reprices a line when the price or an option change changed, and says so', () => {
    const l = line({ lineId: 'i-04#c-lg', optionChoices: [choice('c-lg', 'Large', 200)], priceCents: 1650 });
    const { lines, result } = computeRefresh([l], [burger], null);
    expect(lines[0].priceCents).toBe(1750); // 1450 + 300 today
    expect(lines[0].optionChoices[0].priceDeltaCents).toBe(300);
    expect(result.repriced).toBe(true);
  });

  it('changes nothing and says nothing when nothing changed', () => {
    const l = line({ lineId: 'i-04#c-lg', optionChoices: [choice('c-lg', 'Large', 300)], priceCents: 1750 });
    const { changed, result } = computeRefresh([l], [burger], null);
    expect(changed).toBe(false);
    expect(refreshNotice(result)).toBeNull();
  });

  it('leaves option checks alone for a menu that carries no options (a v1 menu)', () => {
    const l = line({ lineId: 'i-04#c-x', optionChoices: [choice('c-x', 'Whatever', 100)], priceCents: 1550, basePriceCents: 1450 });
    const { lines } = computeRefresh([l], [{ id: 'i-04', name: 'Classic Burger', price_cents: 1450 }], null);
    expect(lines).toHaveLength(1);
  });

  describe("a Chef's special line", () => {
    const special = { id: 'sp-1', item_id: 'i-04', special_price_cents: 1000, stock_left: 5 };
    const spLine = line({ lineId: 'i-04@sp-1', specialId: 'sp-1', basePriceCents: 1000, priceCents: 1000, quantity: 2, maxQuantity: 5 });

    it('keeps its special price while the special is live', () => {
      const { lines, changed } = computeRefresh([spLine], [burger], special);
      expect(lines[0].priceCents).toBe(1000);
      expect(changed).toBe(false);
    });

    it('falls back to the regular price when the special ended, and names it', () => {
      const { lines, result } = computeRefresh([spLine], [burger], null);
      expect(lines[0]).toMatchObject({ lineId: 'i-04', priceCents: 1450, quantity: 2 });
      expect(lines[0].specialId).toBeUndefined();
      expect(result.reset).toEqual(['Classic Burger']);
      expect(result.repriced).toBe(true);
    });

    it('also falls back when another special replaced it or it ran out of stock', () => {
      expect(computeRefresh([spLine], [burger], { ...special, id: 'sp-2' }).result.reset).toHaveLength(1);
      expect(computeRefresh([spLine], [burger], { ...special, stock_left: 0 }).result.reset).toHaveLength(1);
    });

    it('merges with a regular line of the same item and choices, at most 20', () => {
      const regular = line({ quantity: 19 });
      const { lines } = computeRefresh([regular, spLine], [burger], null);
      expect(lines).toHaveLength(1);
      expect(lines[0].quantity).toBe(20);
    });

    it('caps a quantity above the stock left and names it', () => {
      const big = { ...spLine, quantity: 8, maxQuantity: 8 };
      const { lines, result } = computeRefresh([big], [burger], special);
      expect(lines[0].quantity).toBe(5);
      expect(lines[0].maxQuantity).toBe(5);
      expect(result.capped).toEqual(['Classic Burger (5)']);
    });

    it('is left as it is when the special is not known', () => {
      const { lines, changed } = computeRefresh([spLine], [burger], undefined);
      expect(lines[0].specialId).toBe('sp-1');
      expect(lines[0].priceCents).toBe(1000);
      expect(changed).toBe(false);
    });
  });
});

describe('the refresh notice', () => {
  it('is one text naming everything that changed', () => {
    const text = refreshNotice({ removed: ['Fries'], repriced: true, reset: ['Burger'], capped: ['Salmon (2)'] });
    expect(text).toContain('Fries');
    expect(text).toContain('Burger');
    expect(text).toContain('Salmon (2)');
    expect(text).toContain('prices changed');
  });
});
