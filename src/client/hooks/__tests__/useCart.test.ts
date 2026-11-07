/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useCart, readClosedMarker, writeClosedMarker, hasStoredCart } from '../useCart.js';

const TABLE_ID = 'table-42';
const ITEM_A = { menuItemId: 'i-01', name: 'Burger', priceCents: 1050 };
const ITEM_B = { menuItemId: 'i-02', name: 'Fries', priceCents: 450 };

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});

describe('useCart', () => {
  it('starts empty when no stored cart exists', () => {
    const { result } = renderHook(() => useCart(TABLE_ID));
    expect(result.current.items).toHaveLength(0);
    expect(result.current.totalCents).toBe(0);
    expect(result.current.placementKey).toBeNull();
  });

  it('addItem adds an item and persists it to localStorage', () => {
    const { result } = renderHook(() => useCart(TABLE_ID));

    act(() => {
      result.current.addItem(ITEM_A.menuItemId, ITEM_A.name, ITEM_A.priceCents);
    });

    expect(result.current.items).toHaveLength(1);
    expect(result.current.items[0]).toMatchObject({ menuItemId: ITEM_A.menuItemId, quantity: 1 });
    expect(result.current.totalCents).toBe(1050);

    // Verify localStorage was written
    const stored = JSON.parse(localStorage.getItem(`cart:table:${TABLE_ID}`) ?? '[]');
    expect(stored).toHaveLength(1);
    expect(stored[0].menuItemId).toBe(ITEM_A.menuItemId);
  });

  it('addItem increments quantity when item already in cart', () => {
    const { result } = renderHook(() => useCart(TABLE_ID));

    act(() => { result.current.addItem(ITEM_A.menuItemId, ITEM_A.name, ITEM_A.priceCents); });
    act(() => { result.current.addItem(ITEM_A.menuItemId, ITEM_A.name, ITEM_A.priceCents); });

    expect(result.current.items).toHaveLength(1);
    expect(result.current.items[0].quantity).toBe(2);
    expect(result.current.totalCents).toBe(2100);
  });

  it('placementKey is null before first add and generated on first addItem call', () => {
    const { result } = renderHook(() => useCart(TABLE_ID));
    expect(result.current.placementKey).toBeNull();

    act(() => {
      result.current.addItem(ITEM_A.menuItemId, ITEM_A.name, ITEM_A.priceCents);
    });

    expect(result.current.placementKey).not.toBeNull();
    expect(typeof result.current.placementKey).toBe('string');
    expect(result.current.placementKey!.length).toBeGreaterThan(0);

    // Verify it was stored in sessionStorage
    const stored = sessionStorage.getItem(`cart-placement-key:${TABLE_ID}`);
    expect(stored).toBe(result.current.placementKey);
  });

  it('placementKey is reused on subsequent addItem calls (not regenerated)', () => {
    const { result } = renderHook(() => useCart(TABLE_ID));

    act(() => { result.current.addItem(ITEM_A.menuItemId, ITEM_A.name, ITEM_A.priceCents); });
    const keyAfterFirst = result.current.placementKey;

    act(() => { result.current.addItem(ITEM_B.menuItemId, ITEM_B.name, ITEM_B.priceCents); });
    const keyAfterSecond = result.current.placementKey;

    expect(keyAfterFirst).toBe(keyAfterSecond);
  });

  it('removeItem removes the item and updates state and localStorage', () => {
    const { result } = renderHook(() => useCart(TABLE_ID));

    act(() => { result.current.addItem(ITEM_A.menuItemId, ITEM_A.name, ITEM_A.priceCents); });
    act(() => { result.current.addItem(ITEM_B.menuItemId, ITEM_B.name, ITEM_B.priceCents); });
    act(() => { result.current.removeItem(ITEM_A.menuItemId); });

    expect(result.current.items).toHaveLength(1);
    expect(result.current.items[0].menuItemId).toBe(ITEM_B.menuItemId);

    const stored = JSON.parse(localStorage.getItem(`cart:table:${TABLE_ID}`) ?? '[]');
    expect(stored).toHaveLength(1);
    expect(stored[0].menuItemId).toBe(ITEM_B.menuItemId);
  });

  it('updateQuantity updates quantity', () => {
    const { result } = renderHook(() => useCart(TABLE_ID));

    act(() => { result.current.addItem(ITEM_A.menuItemId, ITEM_A.name, ITEM_A.priceCents); });
    act(() => { result.current.updateQuantity(ITEM_A.menuItemId, 3); });

    expect(result.current.items[0].quantity).toBe(3);
    expect(result.current.totalCents).toBe(3150);
  });

  it('updateQuantity with 0 removes the item', () => {
    const { result } = renderHook(() => useCart(TABLE_ID));

    act(() => { result.current.addItem(ITEM_A.menuItemId, ITEM_A.name, ITEM_A.priceCents); });
    act(() => { result.current.updateQuantity(ITEM_A.menuItemId, 0); });

    expect(result.current.items).toHaveLength(0);
  });

  it('clearCart removes all items and resets placementKey', () => {
    const { result } = renderHook(() => useCart(TABLE_ID));

    act(() => { result.current.addItem(ITEM_A.menuItemId, ITEM_A.name, ITEM_A.priceCents); });
    act(() => { result.current.addItem(ITEM_B.menuItemId, ITEM_B.name, ITEM_B.priceCents); });

    const keyBeforeClear = result.current.placementKey;
    expect(keyBeforeClear).not.toBeNull();

    act(() => { result.current.clearCart(); });

    expect(result.current.items).toHaveLength(0);
    expect(result.current.totalCents).toBe(0);
    expect(result.current.placementKey).toBeNull();

    const stored = JSON.parse(localStorage.getItem(`cart:table:${TABLE_ID}`) ?? '[]');
    expect(stored).toHaveLength(0);

    expect(sessionStorage.getItem(`cart-placement-key:${TABLE_ID}`)).toBeNull();
  });

  it('loads existing cart from localStorage on mount', () => {
    // Seed localStorage before mounting
    const seededItems = [
      { menuItemId: ITEM_A.menuItemId, name: ITEM_A.name, priceCents: ITEM_A.priceCents, quantity: 2 },
    ];
    localStorage.setItem(`cart:table:${TABLE_ID}`, JSON.stringify(seededItems));

    const { result } = renderHook(() => useCart(TABLE_ID));

    expect(result.current.items).toHaveLength(1);
    expect(result.current.items[0].quantity).toBe(2);
    expect(result.current.totalCents).toBe(2100);
  });

  describe('removeLines', () => {
    it('removes only the named lines from the cart as it is now, and keeps a line added since', () => {
      localStorage.setItem(
        `cart:table:${TABLE_ID}`,
        JSON.stringify([
          { menuItemId: 'i-01', name: 'Burger', priceCents: 1050, quantity: 2 },
          { menuItemId: 'i-02', name: 'Fries', priceCents: 450, quantity: 1 },
        ])
      );
      const { result } = renderHook(() => useCart(TABLE_ID));
      act(() => result.current.removeLines(['i-01']));
      expect(result.current.items.map((i) => i.menuItemId)).toEqual(['i-02']);
      expect(JSON.parse(localStorage.getItem(`cart:table:${TABLE_ID}`)!)).toHaveLength(1);
    });

    it('an emptied cart starts over with no placement key; an unknown id changes nothing', () => {
      localStorage.setItem(`cart:table:${TABLE_ID}`, JSON.stringify([{ menuItemId: 'i-01', name: 'Burger', priceCents: 1050, quantity: 1 }]));
      sessionStorage.setItem(`cart-placement-key:${TABLE_ID}`, 'pk-old');
      const { result } = renderHook(() => useCart(TABLE_ID));
      act(() => result.current.removeLines(['i-99']));
      expect(result.current.items).toHaveLength(1);
      expect(sessionStorage.getItem(`cart-placement-key:${TABLE_ID}`)).toBe('pk-old');
      act(() => result.current.removeLines(['i-01']));
      expect(result.current.items).toHaveLength(0);
      expect(sessionStorage.getItem(`cart-placement-key:${TABLE_ID}`)).toBeNull();
    });
  });

  describe('refreshPrices', () => {
    function seed() {
      localStorage.setItem(
        `cart:table:${TABLE_ID}`,
        JSON.stringify([
          { menuItemId: 'i-01', name: 'Burger', priceCents: 1050, quantity: 2 },
          { menuItemId: 'i-02', name: 'Fries', priceCents: 450, quantity: 1 },
        ])
      );
    }

    it('updates a changed price, recomputes the total and saves it', () => {
      seed();
      const { result } = renderHook(() => useCart(TABLE_ID));
      let outcome: ReturnType<typeof result.current.refreshPrices> | undefined;
      act(() => {
        outcome = result.current.refreshPrices([
          { id: 'i-01', price_cents: 1100 },
          { id: 'i-02', price_cents: 450 },
        ]);
      });
      expect(outcome).toEqual({ removed: [], repriced: true });
      expect(result.current.totalCents).toBe(2 * 1100 + 450);
      expect(JSON.parse(localStorage.getItem(`cart:table:${TABLE_ID}`)!)[0].priceCents).toBe(1100);
    });

    it('drops a line whose item is no longer on the menu and reports its name', () => {
      seed();
      const { result } = renderHook(() => useCart(TABLE_ID));
      let outcome: ReturnType<typeof result.current.refreshPrices> | undefined;
      act(() => {
        outcome = result.current.refreshPrices([{ id: 'i-01', price_cents: 1050 }]);
      });
      expect(outcome).toEqual({ removed: ['Fries'], repriced: false });
      expect(result.current.items.map((i) => i.menuItemId)).toEqual(['i-01']);
    });

    it('changes nothing, and writes nothing, when the menu matches the cart', () => {
      seed();
      const before = localStorage.getItem(`cart:table:${TABLE_ID}`);
      const { result } = renderHook(() => useCart(TABLE_ID));
      act(() => {
        result.current.refreshPrices([
          { id: 'i-01', price_cents: 1050 },
          { id: 'i-02', price_cents: 450 },
        ]);
      });
      expect(localStorage.getItem(`cart:table:${TABLE_ID}`)).toBe(before);
    });
  });
});

describe('closed-table marker helpers', () => {
  it('reads undefined before anything was recorded, then returns what was written, null included', () => {
    expect(readClosedMarker('5')).toBeUndefined();
    writeClosedMarker('5', 'visit-1');
    expect(readClosedMarker('5')).toBe('visit-1');
    writeClosedMarker('5', null);
    expect(readClosedMarker('5')).toBeNull();
  });

  it('hasStoredCart is true only for a non-empty saved cart', () => {
    expect(hasStoredCart('5')).toBe(false);
    localStorage.setItem('cart:table:5', '[]');
    expect(hasStoredCart('5')).toBe(false);
    localStorage.setItem('cart:table:5', JSON.stringify([{ menuItemId: 'i-01', name: 'x', priceCents: 1, quantity: 1 }]));
    expect(hasStoredCart('5')).toBe(true);
  });
});
