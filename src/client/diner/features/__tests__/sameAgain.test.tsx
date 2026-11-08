// U6 Steps 6 and 9: "Same again" (BR8.1, BR8.2; W8).
import React from 'react';
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { buildSameAgain, sameAgainNotice } from '../same-again/buildSameAgain.js';
import SameAgainFeature from '../same-again/index.js';
import type { DinerMenuItem, DinerOrder } from '../menuTypes.js';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});

const burger: DinerMenuItem = {
  id: 'i-04',
  name: 'Classic Burger',
  description: '',
  price_cents: 1500, // dearer than when it was ordered
  category_id: 'c-02',
  available: true,
  options: [
    { id: 'g-size', name: 'Size', kind: 'one', required: false, choices: [{ id: 'c-reg', label: 'Regular', price_delta_cents: 0 }, { id: 'c-lg', label: 'Large', price_delta_cents: 350 }] },
    { id: 'g-x', name: 'Extras', kind: 'any', required: false, choices: [{ id: 'c-ch', label: 'Extra cheese', price_delta_cents: 100 }] },
  ],
};
const water: DinerMenuItem = { id: 'i-10', name: 'Sparkling Water', description: '', price_cents: 300, category_id: 'c-04', available: true };
const menu = [burger, water];

const order = (lines: DinerOrder['lines']): DinerOrder => ({ order_number: 9, status: 'Completed', placed_at: '2026-11-08T12:00:00Z', lines });
const line = (over: Partial<DinerOrder['lines'][number]>): DinerOrder['lines'][number] => ({
  menu_item_id: 'i-04',
  name: 'Classic Burger',
  quantity: 1,
  price_cents_each: 1850,
  subtotal_cents: 1850,
  options: [],
  ...over,
});

describe('buildSameAgain', () => {
  it('matches each option by its label and adds at today\'s prices', () => {
    const r = buildSameAgain(order([line({ options: [{ label: 'Large', price_delta_cents: 300 }, { label: 'Extra cheese', price_delta_cents: 100 }] })]), menu);
    expect(r.skipped).toEqual([]);
    expect(r.adds).toHaveLength(1);
    expect(r.adds[0].optionChoices.map((c) => c.choiceId)).toEqual(['c-lg', 'c-ch']);
    expect(r.adds[0].priceCents).toBe(1500 + 350 + 100); // the menu's price and option changes today
  });

  it('skips an item that is sold out, hidden or gone, and names it', () => {
    const r = buildSameAgain(order([line({ menu_item_id: 'i-99', name: 'Ghost' }), line({})]), [{ ...burger, available: false }]);
    expect(r.adds).toEqual([]);
    expect(r.skipped).toEqual(['Ghost: no longer available', 'Classic Burger: no longer available']);
  });

  it('skips a line whose option label finds no choice', () => {
    const r = buildSameAgain(order([line({ options: [{ label: 'Bacon', price_delta_cents: 150 }] })]), menu);
    expect(r.adds).toEqual([]);
    expect(r.skipped[0]).toContain('"Bacon" is no longer offered');
  });

  it('skips a line whose label matches choices in two groups (it cannot be told which was meant)', () => {
    const twice: DinerMenuItem = {
      ...burger,
      options: [
        { id: 'g-1', name: 'Sauce', kind: 'one', required: false, choices: [{ id: 'a', label: 'Spicy', price_delta_cents: 0 }] },
        { id: 'g-2', name: 'Side', kind: 'one', required: false, choices: [{ id: 'b', label: 'Spicy', price_delta_cents: 0 }] },
      ],
    };
    const r = buildSameAgain(order([line({ options: [{ label: 'Spicy', price_delta_cents: 0 }] })]), [twice]);
    expect(r.adds).toEqual([]);
    expect(r.skipped[0]).toContain('more than one choice');
  });

  it('skips a line with two matched choices in one choose-one group', () => {
    const r = buildSameAgain(order([line({ options: [{ label: 'Regular', price_delta_cents: 0 }, { label: 'Large', price_delta_cents: 300 }] })]), menu);
    expect(r.adds).toEqual([]);
    expect(r.skipped[0]).toContain('two choices in "Size"');
  });

  it('skips a line when a now-required group is left with no choice', () => {
    const required = { ...burger, options: [{ ...burger.options![0], required: true }, burger.options![1]] };
    const r = buildSameAgain(order([line({ options: [] })]), [required]);
    expect(r.adds).toEqual([]);
    expect(r.skipped[0]).toContain('now needs a choice');
  });

  it('skips a line that had options when the item has none now', () => {
    const r = buildSameAgain(order([line({ menu_item_id: 'i-10', name: 'Sparkling Water', options: [{ label: 'Ice', price_delta_cents: 0 }] })]), menu);
    expect(r.skipped[0]).toContain('no longer offered');
  });

  it("caps a line at 20 together with what the cart holds, and names it", () => {
    const r = buildSameAgain(order([line({ menu_item_id: 'i-10', name: 'Sparkling Water', quantity: 5 })]), menu, [{ lineId: 'i-10', quantity: 18 }]);
    expect(r.adds[0].quantity).toBe(2);
    expect(r.capped).toEqual(['Sparkling Water (20)']);
  });

  it("adds a special line at the menu price and says the special price does not apply", () => {
    const r = buildSameAgain(order([line({ menu_item_id: 'i-10', name: 'Sparkling Water', special_id: 'sp-1', price_cents_each: 100 })]), menu);
    expect(r.adds[0].priceCents).toBe(300);
    expect(r.specialPriceNotApplied).toBe(true);
    expect(sameAgainNotice(r)).toContain("Chef's special price does not apply");
  });
});

describe('sameAgainNotice (BR8.2)', () => {
  it('says what was added and skipped in one text', () => {
    const t = sameAgainNotice({ adds: [{ menuItemId: 'a', name: 'A', priceCents: 1, basePriceCents: 1, quantity: 3, optionChoices: [] }], skipped: ['B: no longer available'], capped: [], specialPriceNotApplied: false });
    expect(t).toContain('Added 3 items');
    expect(t).toContain('Skipped: B: no longer available');
  });

  it('says why nothing was added when every item was skipped', () => {
    const t = sameAgainNotice({ adds: [], skipped: ['B: no longer available'], capped: [], specialPriceNotApplied: false });
    expect(t).toContain('Nothing was added');
    expect(t).toContain('B: no longer available');
  });
});

describe('SameAgainFeature button', () => {
  function stubMenu() {
    const fetchMock = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ items: menu, categories: [] }) }));
    vi.stubGlobal('fetch', fetchMock);
    return fetchMock;
  }

  it('shows only on a Completed order', () => {
    const { container } = render(<SameAgainFeature tableId="5" order={{ ...order([line({})]), status: 'Preparing' }} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('adds the matched items to the cart and hands one notice to onDone', async () => {
    stubMenu();
    const onDone = vi.fn();
    render(<SameAgainFeature tableId="5" order={order([line({ options: [{ label: 'Large', price_delta_cents: 300 }] }), line({ menu_item_id: 'i-10', name: 'Sparkling Water', quantity: 2 })])} onDone={onDone} />);
    fireEvent.click(screen.getByTestId('same-again-9'));
    await waitFor(() => expect(onDone).toHaveBeenCalledTimes(1));
    expect(onDone.mock.calls[0][0]).toContain('Added 3 items');
    const stored = JSON.parse(localStorage.getItem('cart:table:5')!);
    expect(stored.map((l: { lineId: string; quantity: number }) => [l.lineId, l.quantity])).toEqual([['i-04#c-lg', 1], ['i-10', 2]]);
  });

  it('a double tap adds the items once', async () => {
    stubMenu();
    const onDone = vi.fn();
    render(<SameAgainFeature tableId="5" order={order([line({ menu_item_id: 'i-10', name: 'Sparkling Water', quantity: 2 })])} onDone={onDone} />);
    const button = screen.getByTestId('same-again-9');
    fireEvent.click(button);
    fireEvent.click(button);
    await waitFor(() => expect(onDone).toHaveBeenCalled());
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(JSON.parse(localStorage.getItem('cart:table:5')!)[0].quantity).toBe(2);
  });

  it('adds nothing and says so when the menu cannot be read', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('offline'); }));
    const onDone = vi.fn();
    render(<SameAgainFeature tableId="5" order={order([line({})])} onDone={onDone} />);
    fireEvent.click(screen.getByTestId('same-again-9'));
    await waitFor(() => expect(onDone).toHaveBeenCalled());
    expect(onDone.mock.calls[0][0]).toContain('nothing was added');
    expect(localStorage.getItem('cart:table:5')).toBeNull();
    // the button is usable again
    await waitFor(() => expect(screen.getByTestId('same-again-9')).not.toBeDisabled());
  });
});
