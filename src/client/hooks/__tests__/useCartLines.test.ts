// U6 Step 6: useCart with option lines and special lines (BR1.1, BR1.2, BR1.4).
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useCart } from '../useCart.js';

const KEY = 'cart:table:7';
const large = { choiceId: 'c-lg', group: 'Size', label: 'Large', priceDeltaCents: 300 };
const cheese = { choiceId: 'c-ch', group: 'Extras', label: 'Extra cheese', priceDeltaCents: 100 };

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});

describe('useCart: lines with options', () => {
  it('adds an item with options as its own line with the option price included', () => {
    const { result } = renderHook(() => useCart('7'));
    act(() => result.current.addItem('i-04', 'Classic Burger', 1450, 1, { optionChoices: [large, cheese], basePriceCents: 1450 }));
    expect(result.current.items).toHaveLength(1);
    expect(result.current.items[0]).toMatchObject({ lineId: 'i-04#c-ch+c-lg', priceCents: 1850, basePriceCents: 1450, quantity: 1 });
    expect(result.current.totalCents).toBe(1850);
  });

  it('the same item with the same choices adds to one line; other choices make a second line', () => {
    const { result } = renderHook(() => useCart('7'));
    act(() => result.current.addItem('i-04', 'Classic Burger', 1750, 1, { optionChoices: [large], basePriceCents: 1450 }));
    act(() => result.current.addItem('i-04', 'Classic Burger', 1750, 1, { optionChoices: [large], basePriceCents: 1450 }));
    act(() => result.current.addItem('i-04', 'Classic Burger', 1450));
    expect(result.current.items.map((i) => [i.lineId, i.quantity])).toEqual([
      ['i-04#c-lg', 2],
      ['i-04', 1],
    ]);
  });

  it('a plain add joins a plain line a v1 cart already holds (BR1.1)', () => {
    localStorage.setItem(KEY, JSON.stringify([{ menuItemId: 'i-01', name: 'Garlic Bread', priceCents: 650, quantity: 1 }]));
    const { result } = renderHook(() => useCart('7'));
    expect(result.current.items[0].lineId).toBe('i-01');
    act(() => result.current.addItem('i-01', 'Garlic Bread', 650));
    expect(result.current.items).toHaveLength(1);
    expect(result.current.items[0].quantity).toBe(2);
  });

  it('quantity changes and removal work on the line id, from 1 to 20', () => {
    const { result } = renderHook(() => useCart('7'));
    act(() => result.current.addItem('i-04', 'Classic Burger', 1750, 1, { optionChoices: [large], basePriceCents: 1450 }));
    const id = result.current.items[0].lineId;
    act(() => result.current.updateQuantity(id, 99));
    expect(result.current.items[0].quantity).toBe(20);
    act(() => result.current.updateQuantity(id, 0));
    expect(result.current.items).toHaveLength(0);
  });

  it("a special line is also limited to the special's stock left", () => {
    const { result } = renderHook(() => useCart('7'));
    act(() => result.current.addItem('i-05', 'Salmon', 1000, 1, { basePriceCents: 1000, specialId: 'sp-1', maxQuantity: 2 }));
    act(() => result.current.addItem('i-05', 'Salmon', 1000, 1, { basePriceCents: 1000, specialId: 'sp-1', maxQuantity: 2 }));
    act(() => result.current.addItem('i-05', 'Salmon', 1000, 1, { basePriceCents: 1000, specialId: 'sp-1', maxQuantity: 2 }));
    expect(result.current.items[0]).toMatchObject({ lineId: 'i-05@sp-1', quantity: 2 });
    act(() => result.current.updateQuantity('i-05@sp-1', 10));
    expect(result.current.items[0].quantity).toBe(2);
  });

  it('refreshCart saves what the refresh did and returns the result', () => {
    const { result } = renderHook(() => useCart('7'));
    act(() => result.current.addItem('i-04', 'Classic Burger', 1750, 1, { optionChoices: [large], basePriceCents: 1450 }));
    let outcome: ReturnType<typeof result.current.refreshCart> | undefined;
    act(() => {
      outcome = result.current.refreshCart(
        [{ id: 'i-04', name: 'Classic Burger', price_cents: 1500, options: [{ id: 'g', name: 'Size', kind: 'one', required: false, choices: [{ id: 'c-lg', label: 'Large', price_delta_cents: 300 }] }] }],
        null
      );
    });
    expect(outcome!.repriced).toBe(true);
    expect(JSON.parse(localStorage.getItem(KEY)!)[0].priceCents).toBe(1800);
  });

  describe('regression: with browser storage blocked the cart works from the in-memory copy', () => {
    function blockStorage() {
      const get = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
        throw new Error('blocked');
      });
      const set = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new Error('blocked');
      });
      return () => {
        get.mockRestore();
        set.mockRestore();
      };
    }

    it('refreshCart still removes and reprices lines', () => {
      const restore = blockStorage();
      try {
        const { result } = renderHook(() => useCart('blocked-1'));
        act(() => result.current.addItem('i-01', 'Garlic Bread', 650));
        act(() => result.current.addItem('i-02', 'House Salad', 850));
        let outcome: ReturnType<typeof result.current.refreshCart> | undefined;
        act(() => {
          outcome = result.current.refreshCart([{ id: 'i-01', name: 'Garlic Bread', price_cents: 700 }], null);
        });
        expect(outcome!.removed).toEqual(['House Salad']);
        expect(outcome!.repriced).toBe(true);
        expect(result.current.items.map((i) => [i.lineId, i.priceCents])).toEqual([['i-01', 700]]);
      } finally {
        restore();
      }
    });

    it('removeLines still removes, and another hook instance (a screen opened next) sees the cart', () => {
      const restore = blockStorage();
      try {
        const adder = renderHook(() => useCart('blocked-2'));
        act(() => adder.result.current.addItem('i-01', 'Garlic Bread', 650));
        act(() => adder.result.current.addItem('i-02', 'House Salad', 850));
        const cartScreen = renderHook(() => useCart('blocked-2')); // "Same again" adds, then the Cart tab opens
        expect(cartScreen.result.current.items.map((i) => i.lineId)).toEqual(['i-01', 'i-02']);
        act(() => cartScreen.result.current.removeLines(['i-01']));
        expect(cartScreen.result.current.items.map((i) => i.lineId)).toEqual(['i-02']);
        expect(adder.result.current.items.map((i) => i.lineId)).toEqual(['i-02']);
      } finally {
        restore();
      }
    });
  });

  it('removeLines takes line ids', () => {
    const { result } = renderHook(() => useCart('7'));
    act(() => result.current.addItem('i-04', 'Classic Burger', 1750, 1, { optionChoices: [large], basePriceCents: 1450 }));
    act(() => result.current.addItem('i-01', 'Garlic Bread', 650));
    act(() => result.current.removeLines(['i-04#c-lg']));
    expect(result.current.items.map((i) => i.lineId)).toEqual(['i-01']);
  });
});
