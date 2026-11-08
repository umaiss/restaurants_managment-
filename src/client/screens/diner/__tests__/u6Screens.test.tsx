/**
 * @vitest-environment jsdom
 */
// U6 Step 9: the diner screens with the U6 features mounted in them (BR1.1 to BR1.6, BR2.1, BR2.2, BR3.x, BR8.x, BR9.x).
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup, act } from '@testing-library/react';
import MenuScreen from '../MenuScreen.js';
import CartScreen from '../CartScreen.js';
import MyOrdersScreen from '../MyOrdersScreen.js';
import { takePendingCartNotice } from '../../../diner/features/cartNotice.js';
import type { SSEEvent } from '../../../hooks/useTableSSE.js';

const ev = (seq: number, type: string, data: unknown = {}): SSEEvent => ({ seq, type, data });

const burger = {
  id: 'i-04',
  name: 'Classic Burger',
  description: 'Beef patty',
  price_cents: 1450,
  category_id: 'c-02',
  available: true,
  allergens: ['gluten', 'dairy'],
  options: [
    { id: 'g-size', name: 'Size', kind: 'one', required: true, choices: [{ id: 'c-reg', label: 'Regular', price_delta_cents: 0 }, { id: 'c-lg', label: 'Large', price_delta_cents: 300 }] },
    { id: 'g-x', name: 'Extras', kind: 'any', required: false, choices: [{ id: 'c-ch', label: 'Extra cheese', price_delta_cents: 100 }] },
  ],
};
const bread = { id: 'i-01', name: 'Garlic Bread', description: 'Toasted', price_cents: 650, category_id: 'c-01', available: true, allergens: ['gluten', 'dairy'], options: [] };
const salmon = { id: 'i-05', name: 'Grilled Salmon', description: 'Fish', price_cents: 1850, category_id: 'c-02', available: true, allergens: null, options: [] };
const salad = { id: 'i-02', name: 'House Salad', description: 'Greens', price_cents: 850, category_id: 'c-01', available: true, allergens: [], options: [] };

const categories = [{ id: 'c-01', name: 'Starters' }, { id: 'c-02', name: 'Mains' }];

let menu: object[];
let special: object | null;
let estimate: { estimate_minutes: number; basis: string } | 'fail';
let orderAnswer: { status: number; body: unknown } | 'fail';
let posts: any[];

function installServer() {
  posts = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      const answer = (status: number, body: unknown) => ({ ok: status < 400, status, json: async () => body });
      if (url === '/api/menu') return answer(200, { items: menu, categories });
      if (url === '/api/specials/current') return answer(200, { special });
      if (url.startsWith('/api/estimate')) return estimate === 'fail' ? Promise.reject(new TypeError('offline')) : answer(200, estimate);
      if (url.endsWith('/calls')) return answer(200, { calls: [] });
      if (url.endsWith('/orders') && init?.method === 'POST') {
        posts.push(JSON.parse(init.body as string));
        if (orderAnswer === 'fail') throw new TypeError('offline');
        return answer(orderAnswer.status, orderAnswer.body);
      }
      return answer(200, {});
    })
  );
}

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  takePendingCartNotice('5');
  menu = [bread, salad, burger, salmon];
  special = null;
  estimate = { estimate_minutes: 14, basis: 'today' };
  orderAnswer = { status: 201, body: { order_number: 7, dropped_lines: [] } };
  vi.stubGlobal('IntersectionObserver', class { observe() {} disconnect() {} unobserve() {} });
  installServer();
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const storedCart = () => JSON.parse(localStorage.getItem('cart:table:5') ?? '[]') as Array<{ lineId: string; quantity: number; priceCents: number; specialId?: string }>;

// ------------------------------------------------------------------ Menu

describe('Menu with U6 features', () => {
  async function renderMenu(events: SSEEvent[] = []) {
    const view = render(<MenuScreen tableId="5" events={events} />);
    await screen.findByTestId('menu-screen');
    return view;
  }

  it('"+ Add" on an item without options adds straight to the cart', async () => {
    await renderMenu();
    fireEvent.click(screen.getByTestId('add-item-i-01'));
    expect(storedCart()).toMatchObject([{ lineId: 'i-01', quantity: 1 }]);
    expect(screen.queryByTestId('options-sheet')).toBeNull();
  });

  it('an item with options shows "Make it yours" and "+ Add" opens the options sheet instead of adding', async () => {
    await renderMenu();
    expect(screen.getByTestId('make-it-yours-i-04')).toHaveTextContent('Make it yours');
    expect(screen.queryByTestId('make-it-yours-i-01')).toBeNull();
    fireEvent.click(screen.getByTestId('add-item-i-04'));
    expect(screen.getByTestId('options-sheet')).toBeInTheDocument();
    expect(storedCart()).toEqual([]);
  });

  it('choosing in the sheet adds one line with its options and price, and the sheet closes', async () => {
    await renderMenu();
    fireEvent.click(screen.getByTestId('add-item-i-04'));
    fireEvent.click(screen.getByTestId('option-choice-c-lg'));
    fireEvent.click(screen.getByTestId('option-choice-c-ch'));
    fireEvent.click(screen.getByTestId('options-add'));
    expect(screen.queryByTestId('options-sheet')).toBeNull();
    expect(storedCart()).toMatchObject([{ lineId: 'i-04#c-ch+c-lg', priceCents: 1850, quantity: 1 }]);
  });

  it('closing the sheet adds nothing', async () => {
    await renderMenu();
    fireEvent.click(screen.getByTestId('add-item-i-04'));
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByTestId('options-sheet')).toBeNull();
    expect(storedCart()).toEqual([]);
  });

  it('marks items that hold an allergen the diner set, and says "Allergens not set" where it is not set', async () => {
    localStorage.setItem('table-order.allergies', JSON.stringify(['dairy']));
    await renderMenu();
    const mark = within(screen.getByTestId('menu-item-i-01')).getByTestId('allergen-mark');
    expect(mark).toHaveTextContent('Contains dairy');
    expect(screen.getByTestId('menu-item-i-01')).toHaveClass('item-unsafe');
    expect(within(screen.getByTestId('menu-item-i-05')).getByTestId('allergens-not-set')).toBeInTheDocument();
    expect(within(screen.getByTestId('menu-item-i-02')).queryByTestId('allergen-mark')).toBeNull(); // an empty list: no mark
    expect(screen.getByTestId('allergy-guidance')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('add-item-i-01')); // "+ Add" still works on a marked item
    expect(storedCart()).toHaveLength(1);
  });

  it('shows no allergen mark while no allergy is set', async () => {
    await renderMenu();
    expect(screen.queryByTestId('allergen-mark')).toBeNull();
    expect(screen.getByTestId('allergens-not-set')).toBeInTheDocument(); // the unset item still says so
  });

  it("the Chef's special card adds a special line at the special price, limited by its stock", async () => {
    special = { id: 'sp-1', item_id: 'i-01', name: 'Garlic Bread', special_price_cents: 400, stock_left: 2, ends_at: new Date(Date.now() + 600_000).toISOString() };
    await renderMenu();
    const add = await screen.findByTestId('special-add');
    fireEvent.click(add);
    fireEvent.click(add);
    fireEvent.click(add);
    expect(storedCart()).toMatchObject([{ lineId: 'i-01@sp-1', priceCents: 400, quantity: 2, specialId: 'sp-1' }]);
  });

  it("a special on an item with options goes through the sheet, priced from the special", async () => {
    special = { id: 'sp-1', item_id: 'i-04', name: 'Classic Burger', special_price_cents: 1000, stock_left: 5, ends_at: new Date(Date.now() + 600_000).toISOString() };
    await renderMenu();
    fireEvent.click(await screen.findByTestId('special-add'));
    fireEvent.click(screen.getByTestId('option-choice-c-lg'));
    expect(screen.getByTestId('options-price')).toHaveTextContent('$13.00');
    fireEvent.click(screen.getByTestId('options-add'));
    expect(storedCart()[0]).toMatchObject({ specialId: 'sp-1', priceCents: 1300 });
  });

  it('a live MENU_CHANGED reloads the menu and brings the cart in line, leaving the notice for the Cart', async () => {
    localStorage.setItem('cart:table:5', JSON.stringify([{ menuItemId: 'i-01', name: 'Garlic Bread', priceCents: 650, quantity: 1 }]));
    const view = await renderMenu();
    await act(async () => {});
    menu = [{ ...bread, price_cents: 700 }, salad, burger, salmon];
    view.rerender(<MenuScreen tableId="5" events={[ev(1, 'MENU_CHANGED', { reason: 'item', ids: ['i-01'] })]} />);
    await waitFor(() => expect(storedCart()[0].priceCents).toBe(700));
    expect(takePendingCartNotice('5')).toContain('prices changed');
  });

  it('a live sold-out change removes that line from the cart and names it in the notice', async () => {
    localStorage.setItem('cart:table:5', JSON.stringify([{ menuItemId: 'i-01', name: 'Garlic Bread', priceCents: 650, quantity: 1 }]));
    const view = await renderMenu();
    view.rerender(<MenuScreen tableId="5" events={[ev(1, 'MENU_AVAILABILITY_CHANGED', { menu_item_id: 'i-01', available: false })]} />);
    await waitFor(() => expect(storedCart()).toEqual([]));
    expect(takePendingCartNotice('5')).toContain('Garlic Bread');
    expect(screen.queryByTestId('add-item-i-01')).toBeNull();
  });

  it('a live SPECIAL_CHANGED to none sends a special line back to the regular price with a notice', async () => {
    special = { id: 'sp-1', item_id: 'i-01', name: 'Garlic Bread', special_price_cents: 400, stock_left: 2, ends_at: new Date(Date.now() + 600_000).toISOString() };
    const view = await renderMenu();
    fireEvent.click(await screen.findByTestId('special-add'));
    expect(storedCart()[0].priceCents).toBe(400);
    view.rerender(<MenuScreen tableId="5" events={[ev(1, 'SPECIAL_CHANGED', { special: null })]} />);
    await waitFor(() => expect(storedCart()[0]).toMatchObject({ lineId: 'i-01', priceCents: 650 }));
    expect(takePendingCartNotice('5')).toContain("Chef's special ended");
  });
});

import { within } from '@testing-library/react';

// ------------------------------------------------------------------ Cart

function seedBurgerCart() {
  localStorage.setItem(
    'cart:table:5',
    JSON.stringify([
      {
        lineId: 'i-04#c-ch+c-lg',
        menuItemId: 'i-04',
        name: 'Classic Burger',
        basePriceCents: 1450,
        priceCents: 1850,
        quantity: 1,
        optionChoices: [
          { choiceId: 'c-lg', group: 'Size', label: 'Large', priceDeltaCents: 300 },
          { choiceId: 'c-ch', group: 'Extras', label: 'Extra cheese', priceDeltaCents: 100 },
        ],
      },
    ])
  );
  sessionStorage.setItem('cart-placement-key:5', 'pk-1');
}

describe('Cart with U6 features', () => {
  it('shows each option under its item and the line total including them', async () => {
    seedBurgerCart();
    render(<CartScreen tableId="5" />);
    expect(screen.getByTestId('cart-options-i-04#c-ch+c-lg')).toHaveTextContent('Large');
    expect(screen.getByTestId('cart-options-i-04#c-ch+c-lg')).toHaveTextContent('Extra cheese');
    expect(screen.getByTestId('cart-total')).toHaveTextContent('$18.50');
  });

  it('shows the estimated wait', async () => {
    seedBurgerCart();
    render(<CartScreen tableId="5" />);
    expect(await screen.findByTestId('wait-estimate')).toHaveTextContent('Estimated wait: about 14 min');
  });

  it('sends every line with its option ids, and hands the order to the parent', async () => {
    seedBurgerCart();
    const onOrderPlaced = vi.fn();
    render(<CartScreen tableId="5" onOrderPlaced={onOrderPlaced} />);
    await screen.findByTestId('wait-estimate');
    fireEvent.click(screen.getByTestId('place-order-button'));
    fireEvent.click(await screen.findByTestId('confirm-modal-confirm'));
    await waitFor(() => expect(onOrderPlaced).toHaveBeenCalledWith({ orderNumber: 7, droppedLines: [] }));
    expect(posts[0]).toEqual({ placement_key: 'pk-1', lines: [{ menu_item_id: 'i-04', quantity: 1, option_ids: ['c-lg', 'c-ch'] }] });
  });

  it('a double tap on Place order sends one order', async () => {
    seedBurgerCart();
    render(<CartScreen tableId="5" onOrderPlaced={vi.fn()} />);
    await screen.findByTestId('wait-estimate');
    fireEvent.click(screen.getByTestId('place-order-button'));
    const confirm = await screen.findByTestId('confirm-modal-confirm');
    fireEvent.click(confirm);
    fireEvent.click(confirm);
    await waitFor(() => expect(posts).toHaveLength(1));
    await act(async () => {});
    expect(posts).toHaveLength(1);
  });

  it('names a line the server dropped with its reason, and still places the rest', async () => {
    seedBurgerCart();
    orderAnswer = { status: 201, body: { order_number: 8, dropped_lines: [{ menu_item_id: 'i-04', reason: 'OPTION_UNAVAILABLE' }] } };
    const onOrderPlaced = vi.fn();
    render(<CartScreen tableId="5" onOrderPlaced={onOrderPlaced} />);
    await screen.findByTestId('wait-estimate');
    fireEvent.click(screen.getByTestId('place-order-button'));
    fireEvent.click(await screen.findByTestId('confirm-modal-confirm'));
    await waitFor(() => expect(onOrderPlaced).toHaveBeenCalled());
    expect(onOrderPlaced.mock.calls[0][0].droppedLines[0]).toMatchObject({ name: 'Classic Burger', reason: 'an option is no longer offered' });
  });

  it('400 EMPTY_ORDER keeps the cart, runs the refresh at once and says nothing could be ordered', async () => {
    seedBurgerCart();
    orderAnswer = { status: 400, body: { error: { code: 'EMPTY_ORDER', message: 'none' } } };
    const onOrderPlaced = vi.fn();
    render(<CartScreen tableId="5" onOrderPlaced={onOrderPlaced} />);
    await screen.findByTestId('wait-estimate');
    // between opening and placing, the burger became sold out
    menu = [bread, salad, { ...burger, available: false }, salmon];
    fireEvent.click(screen.getByTestId('place-order-button'));
    fireEvent.click(await screen.findByTestId('confirm-modal-confirm'));
    await waitFor(() => expect(screen.getByTestId('cart-refresh-notice')).toHaveTextContent('Nothing could be ordered'));
    expect(screen.getByTestId('cart-refresh-notice')).toHaveTextContent('Classic Burger');
    expect(onOrderPlaced).not.toHaveBeenCalled();
    expect(storedCart()).toEqual([]); // the unavailable line is named and removed by the refresh
    expect(screen.getByTestId('place-order-button')).toBeDisabled(); // nothing left to place
  });

  it('400 INVALID_OPTIONS refreshes the cart, says an option needed attention and loses nothing else', async () => {
    seedBurgerCart();
    orderAnswer = { status: 400, body: { error: { code: 'INVALID_OPTIONS', message: 'bad' } } };
    render(<CartScreen tableId="5" onOrderPlaced={vi.fn()} />);
    await screen.findByTestId('wait-estimate');
    fireEvent.click(screen.getByTestId('place-order-button'));
    fireEvent.click(await screen.findByTestId('confirm-modal-confirm'));
    await waitFor(() => expect(screen.getByTestId('cart-refresh-notice')).toHaveTextContent('An option needed attention'));
    expect(storedCart()).toHaveLength(1);
    expect(screen.getByTestId('place-order-button')).not.toBeDisabled();
  });

  it('a network failure keeps the cart and the placement key so a retry is the same order', async () => {
    seedBurgerCart();
    orderAnswer = 'fail';
    render(<CartScreen tableId="5" onOrderPlaced={vi.fn()} />);
    await screen.findByTestId('wait-estimate');
    fireEvent.click(screen.getByTestId('place-order-button'));
    fireEvent.click(await screen.findByTestId('confirm-modal-confirm'));
    await waitFor(() => expect(screen.getByTestId('order-error-banner')).toHaveTextContent('Network error'));
    expect(storedCart()).toHaveLength(1);
    expect(sessionStorage.getItem('cart-placement-key:5')).toBe('pk-1');
  });

  describe('the allergy warning (BR2.2)', () => {
    beforeEach(() => {
      localStorage.setItem('table-order.allergies', JSON.stringify(['dairy']));
    });

    it('opens before the order when the cart holds a marked item, and blocks the order until "Place order anyway"', async () => {
      seedBurgerCart();
      const onOrderPlaced = vi.fn();
      render(<CartScreen tableId="5" onOrderPlaced={onOrderPlaced} />);
      await screen.findByTestId('wait-estimate');
      fireEvent.click(screen.getByTestId('place-order-button'));
      const warning = await screen.findByTestId('allergy-warning');
      expect(warning).toHaveTextContent('Classic Burger');
      expect(warning).toHaveTextContent('dairy');
      expect(posts).toHaveLength(0);
      expect(screen.queryByTestId('confirm-modal')).toBeNull();
      fireEvent.click(screen.getByTestId('allergy-confirm'));
      await waitFor(() => expect(onOrderPlaced).toHaveBeenCalled());
      expect(posts).toHaveLength(1);
    });

    it('"Back to cart" closes it and places nothing, and it is asked again the next time', async () => {
      seedBurgerCart();
      render(<CartScreen tableId="5" onOrderPlaced={vi.fn()} />);
      await screen.findByTestId('wait-estimate');
      fireEvent.click(screen.getByTestId('place-order-button'));
      fireEvent.click(await screen.findByTestId('allergy-back'));
      expect(screen.queryByTestId('allergy-warning')).toBeNull();
      expect(posts).toHaveLength(0);
      fireEvent.click(screen.getByTestId('place-order-button'));
      expect(await screen.findByTestId('allergy-warning')).toBeInTheDocument();
    });

    it('regression: while the menu is still loading, Place order is disabled and a second tap does nothing (one check, one dialog)', async () => {
      seedBurgerCart();
      let releaseMenu!: () => void;
      const gate = new Promise<void>((resolve) => (releaseMenu = resolve));
      let menuReads = 0;
      vi.stubGlobal(
        'fetch',
        vi.fn(async (url: string) => {
          const answer = (body: unknown) => ({ ok: true, status: 200, json: async () => body });
          if (url === '/api/menu') {
            menuReads += 1;
            await gate; // the menu is slow
            return answer({ items: menu, categories });
          }
          if (url === '/api/specials/current') return answer({ special: null });
          if (url.startsWith('/api/estimate')) return answer(estimate);
          return answer({});
        })
      );
      render(<CartScreen tableId="5" onOrderPlaced={vi.fn()} />);
      const button = screen.getByTestId('place-order-button');
      fireEvent.click(button); // the first tap waits for the menu
      await waitFor(() => expect(button).toBeDisabled());
      fireEvent.click(button); // a second tap while it waits
      fireEvent.click(button);
      await act(async () => {
        releaseMenu();
      });
      expect(await screen.findAllByTestId('allergy-warning')).toHaveLength(1);
      expect(screen.queryByTestId('confirm-modal')).toBeNull();
      expect(menuReads).toBe(2); // the one read when the Cart opened and one for the first tap, none for the others
      // a tap while the dialog is open does nothing either
      fireEvent.click(button);
      expect(screen.getAllByTestId('allergy-warning')).toHaveLength(1);
    });

    it('does not open for a cart with no marked item', async () => {
      localStorage.setItem('cart:table:5', JSON.stringify([{ menuItemId: 'i-02', name: 'House Salad', priceCents: 850, quantity: 1 }]));
      render(<CartScreen tableId="5" onOrderPlaced={vi.fn()} />);
      await screen.findByTestId('wait-estimate');
      fireEvent.click(screen.getByTestId('place-order-button'));
      expect(await screen.findByTestId('confirm-modal')).toBeInTheDocument();
      expect(screen.queryByTestId('allergy-warning')).toBeNull();
    });

    it('says it could not check when the menu cannot be read, rather than passing silently', async () => {
      seedBurgerCart();
      vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('offline'); }));
      render(<CartScreen tableId="5" onOrderPlaced={vi.fn()} />);
      fireEvent.click(screen.getByTestId('place-order-button'));
      expect(await screen.findByText(/could not check your items/)).toBeInTheDocument();
    });
  });

  it('a cart line for a special shows the special label and respects its stock on the plus button', async () => {
    localStorage.setItem(
      'cart:table:5',
      JSON.stringify([{ lineId: 'i-01@sp-1', menuItemId: 'i-01', name: 'Garlic Bread', basePriceCents: 400, priceCents: 400, quantity: 2, optionChoices: [], specialId: 'sp-1', maxQuantity: 2 }])
    );
    special = { id: 'sp-1', item_id: 'i-01', name: 'Garlic Bread', special_price_cents: 400, stock_left: 2, ends_at: new Date(Date.now() + 600_000).toISOString() };
    render(<CartScreen tableId="5" />);
    expect(screen.getByTestId('cart-special-i-01@sp-1')).toBeInTheDocument();
    expect(screen.getByTestId('cart-increase-i-01@sp-1')).toBeDisabled();
  });

  it('opens with the notice a refresh left while the Cart was closed, and with the "Same again" notice', async () => {
    seedBurgerCart();
    const { setPendingCartNotice } = await import('../../../diner/features/cartNotice.js');
    setPendingCartNotice('5', 'Prices moved while you were away.');
    render(<CartScreen tableId="5" notice="Added 2 items from your earlier order." />);
    expect(screen.getByTestId('cart-refresh-notice')).toHaveTextContent('Prices moved while you were away.');
    expect(screen.getByTestId('cart-same-again-notice')).toHaveTextContent('Added 2 items');
  });

  it('refreshes again on a live special change while open', async () => {
    localStorage.setItem(
      'cart:table:5',
      JSON.stringify([{ lineId: 'i-01@sp-1', menuItemId: 'i-01', name: 'Garlic Bread', basePriceCents: 400, priceCents: 400, quantity: 1, optionChoices: [], specialId: 'sp-1', maxQuantity: 2 }])
    );
    special = { id: 'sp-1', item_id: 'i-01', name: 'Garlic Bread', special_price_cents: 400, stock_left: 2, ends_at: new Date(Date.now() + 600_000).toISOString() };
    const view = render(<CartScreen tableId="5" events={[]} />);
    await screen.findByTestId('wait-estimate');
    special = null;
    view.rerender(<CartScreen tableId="5" events={[ev(1, 'SPECIAL_CHANGED', { special: null })]} />);
    await waitFor(() => expect(screen.getByTestId('cart-refresh-notice')).toHaveTextContent("Chef's special ended"));
    expect(storedCart()[0].priceCents).toBe(650);
  });
});

// ------------------------------------------------------------------ My orders

const NOW_ISO = new Date().toISOString();

describe('My orders with U6 features', () => {
  function ordersServer(orders: object[], calls: object[] = []) {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init?: RequestInit) => {
        const answer = (body: unknown) => ({ ok: true, status: 200, json: async () => body });
        if (url.endsWith('/calls')) return answer({ calls });
        if (url === '/api/menu') return answer({ items: menu, categories });
        if (url.includes('/orders?visit=current')) return answer({ orders });
        return answer({});
      })
    );
  }

  it('shows the tracker with the wait text for an open order, and the options the line was ordered with', async () => {
    ordersServer([
      { order_number: 12, status: 'Preparing', placed_at: NOW_ISO, estimate_minutes: 14, lines: [{ menu_item_id: 'i-04', name: 'Classic Burger', quantity: 1, price_cents_each: 1850, subtotal_cents: 1850, options: [{ label: 'Large', price_delta_cents: 300 }, { label: 'Extra cheese', price_delta_cents: 100 }] }] },
    ]);
    render(<MyOrdersScreen tableId="5" lastSSEEvent={null} events={[]} />);
    expect(await screen.findByTestId('order-tracker-12')).toBeInTheDocument();
    expect(screen.getByTestId('order-estimate-12')).toHaveTextContent(/About \d+ min left/);
    expect(screen.getByTestId('order-line-options-12-0')).toHaveTextContent('Large, Extra cheese');
  });

  it('shows "Running late" for an order past its estimate and "Cancelled" with no bar', async () => {
    const old = new Date(Date.now() - 30 * 60_000).toISOString();
    ordersServer([
      { order_number: 8, status: 'Pending', placed_at: old, estimate_minutes: 10, lines: [] },
      { order_number: 9, status: 'Cancelled', placed_at: old, estimate_minutes: 10, lines: [] },
    ]);
    render(<MyOrdersScreen tableId="5" lastSSEEvent={null} />);
    expect(await screen.findByTestId('running-late-8')).toHaveTextContent('Running late');
    expect(screen.queryByTestId('order-tracker-9')).toBeNull();
    expect(screen.getByTestId('order-cancelled-9')).toBeInTheDocument();
  });

  it('shows the call card while the table has orders', async () => {
    ordersServer([{ order_number: 1, status: 'Pending', placed_at: NOW_ISO, estimate_minutes: 10, lines: [] }]);
    render(<MyOrdersScreen tableId="5" lastSSEEvent={null} />);
    expect(await screen.findByTestId('help-card')).toBeInTheDocument();
  });

  it('shows no call card on an empty My orders', async () => {
    ordersServer([]);
    render(<MyOrdersScreen tableId="5" lastSSEEvent={null} />);
    await screen.findByTestId('orders-empty');
    expect(screen.queryByTestId('help-card')).toBeNull();
  });

  it('"Same again" shows only on a Completed order, and hands one notice to the parent', async () => {
    ordersServer([
      { order_number: 9, status: 'Completed', placed_at: NOW_ISO, estimate_minutes: 10, lines: [{ menu_item_id: 'i-02', name: 'House Salad', quantity: 2, price_cents_each: 800, subtotal_cents: 1600, options: [] }] },
      { order_number: 10, status: 'Pending', placed_at: NOW_ISO, estimate_minutes: 10, lines: [] },
    ]);
    const onSameAgain = vi.fn();
    render(<MyOrdersScreen tableId="5" lastSSEEvent={null} onSameAgain={onSameAgain} />);
    fireEvent.click(await screen.findByTestId('same-again-9'));
    await waitFor(() => expect(onSameAgain).toHaveBeenCalledTimes(1));
    expect(onSameAgain.mock.calls[0][0]).toContain('Added 2 items');
    expect(storedCart()).toMatchObject([{ lineId: 'i-02', quantity: 2, priceCents: 850 }]); // today's price
    expect(screen.queryByTestId('same-again-10')).toBeNull();
  });
});
