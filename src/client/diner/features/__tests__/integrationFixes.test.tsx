/**
 * @vitest-environment jsdom
 */
// Integration fixes on the diner side: findings 1, 2 and 3 (the special card for an item that is not offered, a
// price below zero in the cart, an order refused for an option or an unknown item).
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { computeRefresh, type CartItem, type RefreshMenuItem } from '../cartModel.js';
import { sendOrder } from '../orderSend.js';
import SpecialCardFeature from '../special-card/index.js';
import CartScreen from '../../../screens/diner/CartScreen.js';
import MenuScreen from '../../../screens/diner/MenuScreen.js';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const voucher = { choiceId: 'c-v', group: 'Voucher', label: 'Voucher', priceDeltaCents: -900 };
const base: CartItem = { lineId: 'i-04', menuItemId: 'i-04', name: 'Classic Burger', basePriceCents: 1450, priceCents: 1450, quantity: 1, optionChoices: [] };
const burgerMenu = (deltaCents: number, price = 1450): RefreshMenuItem => ({
  id: 'i-04',
  name: 'Classic Burger',
  price_cents: price,
  available: true,
  options: [{ id: 'g-v', name: 'Voucher', kind: 'any', required: false, choices: [{ id: 'c-v', label: 'Voucher', price_delta_cents: deltaCents }] }],
});

describe('regression: a price below zero is never clamped and sent (finding 2c)', () => {
  const special = { id: 'sp-1', item_id: 'i-04', special_price_cents: 500, stock_left: 5 };
  const spLine: CartItem = { ...base, lineId: 'i-04#c-v@sp-1', specialId: 'sp-1', basePriceCents: 500, priceCents: 0, optionChoices: [voucher], maxQuantity: 5 };

  it('a special line whose price with its options is below zero falls back to the regular price, and is named', () => {
    const { lines, result } = computeRefresh([spLine], [burgerMenu(-900)], special); // 5.00 - 9.00 < 0, 14.50 - 9.00 = 5.50
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatchObject({ lineId: 'i-04#c-v', priceCents: 550, basePriceCents: 1450 });
    expect(lines[0].specialId).toBeUndefined();
    expect(result.reset).toEqual(['Classic Burger']);
    expect(result.removed).toEqual([]);
  });

  it('a line that is still below zero at the regular price is removed and named', () => {
    const { lines, result } = computeRefresh([spLine], [burgerMenu(-1600)], special); // 14.50 - 16.00 < 0 too
    expect(lines).toEqual([]);
    expect(result.removed).toEqual(['Classic Burger']);
  });

  it('a regular line whose price with its options is below zero is removed and named', () => {
    const plain: CartItem = { ...spLine, lineId: 'i-04#c-v', specialId: undefined, basePriceCents: 1450, maxQuantity: undefined };
    delete plain.specialId;
    const { lines, result } = computeRefresh([plain], [burgerMenu(-1600)], null);
    expect(lines).toEqual([]);
    expect(result.removed).toEqual(['Classic Burger']);
  });

  it('a line at exactly zero is kept', () => {
    const plain: CartItem = { ...base, lineId: 'i-04#c-v', basePriceCents: 1450, optionChoices: [voucher] };
    expect(computeRefresh([plain], [burgerMenu(-1450)], null).lines[0].priceCents).toBe(0);
  });
});

describe('regression: UNKNOWN_ITEM is mapped like INVALID_OPTIONS (finding 3)', () => {
  it('sendOrder answers unknown_item for 400 UNKNOWN_ITEM instead of the server\'s raw text, and carries the item of INVALID_OPTIONS', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 400, json: async () => ({ error: { code: 'UNKNOWN_ITEM', message: 'Unknown item i-05' } }) })));
    expect(await sendOrder('5', 'pk', [base])).toEqual({ kind: 'unknown_item' });
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 400, json: async () => ({ error: { code: 'INVALID_OPTIONS', message: 'x', details: { menu_item_id: 'i-04' } } }) })));
    expect(await sendOrder('5', 'pk', [base])).toEqual({ kind: 'invalid_options', menuItemId: 'i-04' });
  });
});

// ------------------------------------------------------------------ the Cart

const menuItem = (id: string, name: string, price: number, extra: object = {}) => ({ id, name, description: '', price_cents: price, category_id: 'c-01', available: true, allergens: [], options: [], ...extra });
let menu: object[];
let orderAnswer: { status: number; body: unknown };
let posts: unknown[];

function server() {
  posts = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      const answer = (status: number, body: unknown) => ({ ok: status < 400, status, json: async () => body });
      if (url === '/api/menu') return answer(200, { items: menu, categories: [{ id: 'c-01', name: 'Starters' }] });
      if (url === '/api/specials/current') return answer(200, { special: null });
      if (url.startsWith('/api/estimate')) return answer(200, { estimate_minutes: 10, basis: 'today' });
      if (url.endsWith('/orders') && init?.method === 'POST') {
        const sent = JSON.parse(init.body as string) as { lines: Array<{ menu_item_id: string }> };
        posts.push(sent);
        // the server refuses the whole order while the bad line is in it
        if (sent.lines.some((l) => l.menu_item_id === 'i-04')) return answer(orderAnswer.status, orderAnswer.body);
        return answer(201, { order_number: 9, dropped_lines: [] });
      }
      return answer(200, {});
    })
  );
}

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  menu = [menuItem('i-02', 'House Salad', 850), menuItem('i-04', 'Classic Burger', 1450, { options: [{ id: 'g-v', name: 'Voucher', kind: 'any', required: false, choices: [{ id: 'c-v', label: 'Voucher', price_delta_cents: -900 }] }] })];
  orderAnswer = { status: 400, body: { error: { code: 'INVALID_OPTIONS', message: 'The price of Classic Burger cannot be below zero', details: { menu_item_id: 'i-04' } } } };
  server();
});

function seed(lines: object[]) {
  localStorage.setItem('cart:table:5', JSON.stringify(lines));
  sessionStorage.setItem('cart-placement-key:5', 'pk-1');
}
const salad = { lineId: 'i-02', menuItemId: 'i-02', name: 'House Salad', basePriceCents: 850, priceCents: 850, quantity: 1, optionChoices: [] };
// a line the refresh cannot find fault with (price 14.50 + 0 for the option on the menu it is checked against)
const stuckBurger = { lineId: 'i-04#c-v', menuItemId: 'i-04', name: 'Classic Burger', basePriceCents: 1450, priceCents: 550, quantity: 1, optionChoices: [{ choiceId: 'c-v', group: 'Voucher', label: 'Voucher', priceDeltaCents: -900 }] };

async function place() {
  fireEvent.click(screen.getByTestId('place-order-button'));
  fireEvent.click(await screen.findByTestId('confirm-modal-confirm'));
}

describe('regression: the diner can never be stuck in an INVALID_OPTIONS loop (finding 2d)', () => {
  it('when the server names a line and the refresh changed nothing, that line is taken out with a notice, and the rest is placed next time', async () => {
    seed([salad, stuckBurger]);
    const onOrderPlaced = vi.fn();
    render(<CartScreen tableId="5" onOrderPlaced={onOrderPlaced} />);
    await screen.findByTestId('wait-estimate');
    await place();
    await waitFor(() => expect(screen.getByTestId('cart-refresh-notice')).toHaveTextContent('Classic Burger could not be ordered as chosen'));
    expect(screen.getByTestId('cart-refresh-notice')).toHaveTextContent('taken out of your cart');
    expect(JSON.parse(localStorage.getItem('cart:table:5')!)).toHaveLength(1);
    expect(screen.queryByTestId('cart-item-i-04#c-v')).toBeNull();
    expect(screen.getByTestId('cart-item-i-02')).toBeInTheDocument(); // nothing else was lost

    await place(); // the second try goes through
    await waitFor(() => expect(onOrderPlaced).toHaveBeenCalledWith({ orderNumber: 9, droppedLines: [] }));
    expect(posts).toHaveLength(2);
  });

  it('when the refresh did change something, the notice is the refresh\'s and the cart is not cut further', async () => {
    seed([salad, stuckBurger]);
    render(<CartScreen tableId="5" onOrderPlaced={vi.fn()} />);
    await screen.findByTestId('wait-estimate');
    // the option's price moves while the order is on its way: the refresh after the refusal reprices the line
    menu = [menuItem('i-02', 'House Salad', 850), menuItem('i-04', 'Classic Burger', 1450, { options: [{ id: 'g-v', name: 'Voucher', kind: 'any', required: false, choices: [{ id: 'c-v', label: 'Voucher', price_delta_cents: -800 }] }] })];
    await place();
    await waitFor(() => expect(screen.getByTestId('cart-refresh-notice')).toHaveTextContent('An option needed attention'));
    expect(JSON.parse(localStorage.getItem('cart:table:5')!)).toHaveLength(2);
  });

  it('an answer with no item named leaves the cart and says an option needed attention (nothing is guessed)', async () => {
    seed([salad, stuckBurger]);
    orderAnswer = { status: 400, body: { error: { code: 'INVALID_OPTIONS', message: 'x' } } };
    render(<CartScreen tableId="5" onOrderPlaced={vi.fn()} />);
    await screen.findByTestId('wait-estimate');
    await place();
    await waitFor(() => expect(screen.getByTestId('cart-refresh-notice')).toHaveTextContent('An option needed attention'));
    expect(JSON.parse(localStorage.getItem('cart:table:5')!)).toHaveLength(2);
  });
});

describe('regression: an order refused for an unknown item says what changed in plain words (finding 3)', () => {
  it('refreshes the cart, removes and names the item, and never shows the server\'s raw text', async () => {
    const burger = { ...base, lineId: 'i-04', priceCents: 1450 };
    seed([salad, burger]);
    orderAnswer = { status: 400, body: { error: { code: 'UNKNOWN_ITEM', message: 'Unknown item i-04' } } };
    const onOrderPlaced = vi.fn();
    render(<CartScreen tableId="5" onOrderPlaced={onOrderPlaced} />);
    await screen.findByTestId('wait-estimate');
    menu = [menuItem('i-02', 'House Salad', 850)]; // the burger was hidden while the order was on its way
    await place();
    await waitFor(() => expect(screen.getByTestId('cart-refresh-notice')).toHaveTextContent('Classic Burger'));
    expect(screen.getByTestId('cart-refresh-notice')).toHaveTextContent('Something on the menu changed');
    expect(screen.queryByTestId('order-error-banner')).toBeNull();
    expect(document.body).not.toHaveTextContent('Unknown item');
    expect(JSON.parse(localStorage.getItem('cart:table:5')!).map((l: { lineId: string }) => l.lineId)).toEqual(['i-02']);
    expect(onOrderPlaced).not.toHaveBeenCalled();
  });
});

// ------------------------------------------------------------------ the special card (finding 1)

describe("regression: no Chef's special card, and no dead \"+ Add\", for an item the diner cannot order (finding 1)", () => {
  const special = { id: 'sp-1', item_id: 'i-02', name: 'House Salad', special_price_cents: 500, stock_left: 5, ends_at: new Date(Date.now() + 600_000).toISOString() };
  function stubSpecial() {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ special }) })));
  }

  it('the card is not shown when the item is not on the diner\'s menu', async () => {
    stubSpecial();
    const { container } = render(<SpecialCardFeature tableId="5" events={[]} itemInfo={() => undefined} />);
    await waitFor(() => expect((globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls.length).toBeGreaterThan(0));
    await new Promise((r) => setTimeout(r, 20));
    expect(container).toBeEmptyDOMElement();
  });

  it('the card is not shown when the item is sold out, and is shown when it is available', async () => {
    stubSpecial();
    const sold = render(<SpecialCardFeature tableId="5" events={[]} itemInfo={() => ({ available: false })} />);
    await new Promise((r) => setTimeout(r, 20));
    expect(sold.container).toBeEmptyDOMElement();
    sold.unmount();
    render(<SpecialCardFeature tableId="5" events={[]} itemInfo={() => ({ available: true })} />);
    expect(await screen.findByTestId('chef-special')).toBeInTheDocument();
  });

  it('on the Menu: a special whose item is not on the menu shows no card; one on the menu shows its card and adds', async () => {
    vi.stubGlobal('IntersectionObserver', class { observe() {} disconnect() {} unobserve() {} });
    menu = [menuItem('i-01', 'Garlic Bread', 650)]; // the special's item (i-02) is not on this menu
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => ({
        ok: true,
        status: 200,
        json: async () => (url === '/api/specials/current' ? { special } : { items: menu, categories: [{ id: 'c-01', name: 'Starters' }] }),
      }))
    );
    const first = render(<MenuScreen tableId="5" events={[]} />);
    await screen.findByTestId('menu-screen');
    await new Promise((r) => setTimeout(r, 30));
    expect(screen.queryByTestId('chef-special')).toBeNull();
    first.unmount();

    menu = [menuItem('i-02', 'House Salad', 850)];
    render(<MenuScreen tableId="5" events={[]} />);
    fireEvent.click(await screen.findByTestId('special-add'));
    expect(JSON.parse(localStorage.getItem('cart:table:5')!)).toMatchObject([{ lineId: 'i-02@sp-1', priceCents: 500 }]);
  });

  it('a live sold-out event removes the card from an open Menu', async () => {
    vi.stubGlobal('IntersectionObserver', class { observe() {} disconnect() {} unobserve() {} });
    menu = [menuItem('i-02', 'House Salad', 850)];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => ({
        ok: true,
        status: 200,
        json: async () => (url === '/api/specials/current' ? { special } : { items: menu, categories: [{ id: 'c-01', name: 'Starters' }] }),
      }))
    );
    const view = render(<MenuScreen tableId="5" events={[]} />);
    await screen.findByTestId('chef-special');
    view.rerender(<MenuScreen tableId="5" events={[{ seq: 1, type: 'MENU_AVAILABILITY_CHANGED', data: { menu_item_id: 'i-02', available: false } }]} />);
    await waitFor(() => expect(screen.queryByTestId('chef-special')).toBeNull());
  });
});
