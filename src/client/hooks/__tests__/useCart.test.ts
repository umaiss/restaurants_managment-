/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useCart } from '../useCart.js';

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
});
