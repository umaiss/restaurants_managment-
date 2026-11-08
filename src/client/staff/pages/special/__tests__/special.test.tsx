// @vitest-environment jsdom
/// <reference types="vitest/globals" />
// U7 Step 13: the Chef's special page (BR6.1 to BR6.3).
import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor, act } from '@testing-library/react';
import SpecialPage, { countdown } from '../index';
import { MockEventSource, calledWith, failed, ok, stubStream } from '../../../__tests__/u7Mocks';

const menuBody = {
  categories: [{ id: 'c-02', name: 'Mains', order: 2, hidden: false }, { id: 'c-09', name: 'Hidden cat', order: 9, hidden: true }],
  items: [
    { id: 'i-04', category_id: 'c-02', name: 'Classic Burger', description: '', image: '', price_cents: 1450, available: true, hidden: false, station: 'Grill', allergens: [], options: [] },
    { id: 'i-07', category_id: 'c-02', name: 'Pasta Carbonara', description: '', image: '', price_cents: 1250, available: true, hidden: false, station: 'Grill', allergens: [], options: [] },
    { id: 'i-08', category_id: 'c-02', name: 'Sold Out Dish', description: '', image: '', price_cents: 900, available: false, hidden: false, station: 'Grill', allergens: [], options: [] },
    { id: 'i-09', category_id: 'c-02', name: 'Hidden Dish', description: '', image: '', price_cents: 900, available: true, hidden: true, station: 'Grill', allergens: [], options: [] },
    { id: 'i-10', category_id: 'c-09', name: 'In Hidden Category', description: '', image: '', price_cents: 900, available: true, hidden: false, station: 'Grill', allergens: [], options: [] },
    { id: 'i-11', category_id: 'c-02', name: 'Deal Burger', description: '', image: '', price_cents: 1000, available: true, hidden: false, station: 'Grill', allergens: [], options: [
      { id: 'g', name: 'Voucher', kind: 'one', required: true, choices: [{ id: 'c1', label: 'Student', price_delta_cents: -500 }, { id: 'c2', label: 'None', price_delta_cents: 0 }] },
    ] },
  ],
};
const live = (over: object = {}) => ({ id: 's1', item_id: 'i-04', name: 'Classic Burger', special_price_cents: 1000, stock_left: 6, ends_at: new Date(Date.now() + 12 * 60_000 + 40_000).toISOString(), ...over });

let current: { special: object | null };
let handlers: Record<string, (init?: RequestInit) => unknown>;
let fetchMock: import('vitest').Mock<any[], any>;
const sent = (method: string, url: string) => JSON.parse(String((calledWith(fetchMock, url, method)[0][1] as RequestInit).body));

beforeEach(() => {
  stubStream();
  current = { special: null };
  handlers = {};
  fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method ?? 'GET';
    const handler = handlers[`${method} ${url}`];
    if (handler) return handler(init);
    if (method === 'GET' && url === '/api/specials/current') return ok(current);
    if (method === 'GET' && url === '/api/staff/menu') return ok(menuBody);
    return failed(404);
  });
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const fill = async (over: { price?: string; stock?: string; minutes?: string; item?: string } = {}) => {
  await waitFor(() => expect(screen.getByLabelText('Menu item')).not.toBeDisabled());
  if (over.item) fireEvent.change(screen.getByLabelText('Menu item'), { target: { value: over.item } });
  fireEvent.change(screen.getByLabelText('Special price (dollars)'), { target: { value: over.price ?? '10.00' } });
  if (over.stock !== undefined) fireEvent.change(screen.getByLabelText('Stock (1 to 999)'), { target: { value: over.stock } });
  if (over.minutes !== undefined) fireEvent.change(screen.getByLabelText('Runs for (minutes)'), { target: { value: over.minutes } });
};

describe('the live special (BR6.1)', () => {
  it('says "No special is live." when there is none', async () => {
    render(<SpecialPage />);
    expect(await screen.findByTestId('special-none')).toHaveTextContent('No special is live.');
    expect(screen.queryByTestId('end-special')).toBeNull();
  });

  it('shows the live special with its name, price, stock left and a countdown', async () => {
    current = { special: live() };
    render(<SpecialPage />);
    // Wait on the text itself and look the card up afresh each time: under a loaded machine the page can replace the
    // card element once more while its reads settle, and a node found earlier would then be a stale one.
    await waitFor(() => expect(screen.getByTestId('special-live')).toHaveTextContent('Live now'));
    const card = () => screen.getByTestId('special-live');
    expect(card()).toHaveTextContent('Classic Burger');
    expect(card()).toHaveTextContent('$10.00');
    expect(screen.getByTestId('special-stock-left')).toHaveTextContent('6');
    expect(screen.getByTestId('special-countdown')).toHaveTextContent(/Ends in 12:[34]\d/);
    expect(card()).toHaveTextContent('It disappears when the stock reaches 0 or the time runs out.');
  });

  it('counts down every second', async () => {
    vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'] });
    try {
      current = { special: live({ ends_at: new Date(Date.now() + 65_000).toISOString() }) };
      render(<SpecialPage />);
      await vi.waitFor(() => expect(screen.getByTestId('special-countdown')).toHaveTextContent('Ends in 1:05'));
      act(() => {
        vi.advanceTimersByTime(5_000);
      });
      expect(screen.getByTestId('special-countdown')).toHaveTextContent('Ends in 1:00');
    } finally {
      vi.useRealTimers();
    }
  });

  it('countdown() gives mm:ss and never goes below zero', () => {
    const now = Date.parse('2026-11-08T12:00:00Z');
    expect(countdown('2026-11-08T12:12:40Z', now).text).toBe('12:40');
    expect(countdown('2026-11-08T12:00:05Z', now).text).toBe('0:05');
    expect(countdown('2026-11-08T11:00:00Z', now)).toEqual({ text: '0:00', msLeft: 0 });
  });

  it('a special whose time has already run out is not shown as live', async () => {
    current = { special: live({ ends_at: new Date(Date.now() - 1000).toISOString() }) };
    render(<SpecialPage />);
    expect(await screen.findByTestId('special-none')).toBeInTheDocument();
  });

  it('a failed first read says so, with Retry', async () => {
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => (String(input) === '/api/specials/current' ? failed(500) : ok(menuBody)));
    render(<SpecialPage />);
    expect(await screen.findByTestId('special-error')).toHaveTextContent('The special could not be loaded. Try again.');
  });
});

describe('following the special live (BR6.3)', () => {
  it('SPECIAL_CHANGED with a special shows it at once', async () => {
    render(<SpecialPage />);
    await screen.findByTestId('special-none');
    act(() => MockEventSource.last.emit('SPECIAL_CHANGED', { special: live({ name: 'Lobster Linguine' }) }));
    expect(await screen.findByTestId('special-live')).toHaveTextContent('Lobster Linguine');
  });

  it('a special that sells out or runs out of time (SPECIAL_CHANGED with null) switches to "No special is live." at once', async () => {
    current = { special: live() };
    render(<SpecialPage />);
    await screen.findByTestId('end-special');
    act(() => MockEventSource.last.emit('SPECIAL_CHANGED', { special: null }));
    expect(await screen.findByTestId('special-none')).toHaveTextContent('No special is live.');
  });

  it('a stock change shows the new stock left', async () => {
    current = { special: live() };
    render(<SpecialPage />);
    await screen.findByTestId('end-special');
    act(() => MockEventSource.last.emit('SPECIAL_CHANGED', { special: live({ stock_left: 3 }) }));
    await waitFor(() => expect(screen.getByTestId('special-stock-left')).toHaveTextContent('3'));
  });

  it('a special with no stock left is not shown as live', async () => {
    current = { special: live() };
    render(<SpecialPage />);
    await screen.findByTestId('end-special');
    act(() => MockEventSource.last.emit('SPECIAL_CHANGED', { special: live({ stock_left: 0 }) }));
    expect(await screen.findByTestId('special-none')).toBeInTheDocument();
  });
});

describe('launching and ending (BR6.1, BR6.2)', () => {
  it('offers only visible, available items in a visible category', async () => {
    render(<SpecialPage />);
    await waitFor(() => expect(screen.getByLabelText('Menu item')).not.toBeDisabled());
    const options = Array.from(screen.getByLabelText('Menu item').querySelectorAll('option')).map((o) => o.textContent);
    expect(options).toEqual(['Classic Burger', 'Pasta Carbonara', 'Deal Burger']);
  });

  it('Launch sends the item, the price in whole cents, the stock and the minutes, and shows the new special', async () => {
    handlers['POST /api/specials'] = () => ok(live({ id: 's2', name: 'Pasta Carbonara', item_id: 'i-07', special_price_cents: 950, stock_left: 8 }), 201);
    render(<SpecialPage />);
    await fill({ item: 'i-07', price: '9.50', stock: '8', minutes: '45' });
    fireEvent.click(screen.getByTestId('launch-special'));
    expect(await screen.findByTestId('special-live')).toHaveTextContent('Pasta Carbonara');
    expect(sent('POST', '/api/specials')).toEqual({ item_id: 'i-07', special_price_cents: 950, stock: 8, minutes: 45 });
  });

  it('a launch the server refuses shows the message beside the named field and keeps what was typed', async () => {
    handlers['POST /api/specials'] = () => failed(400, { error: { code: 'INVALID_REQUEST', message: 'stock must be a whole number from 1 to 999', details: { field: 'stock' } } });
    render(<SpecialPage />);
    await fill({ price: '10.00', stock: '0', minutes: '30' });
    fireEvent.click(screen.getByTestId('launch-special'));
    expect(await screen.findByTestId('field-s-stock')).toHaveTextContent('Stock must be a whole number from 1 to 999.');
    expect(screen.getByLabelText('Stock (1 to 999)')).toHaveValue('0');
    expect(screen.getByLabelText('Stock (1 to 999)')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByLabelText('Special price (dollars)')).toHaveValue('10.00');
    expect(screen.getByLabelText('Runs for (minutes)')).toHaveValue('30');
    expect(screen.getByTestId('special-none')).toBeInTheDocument();
  });

  it('refusals about the price and the minutes show beside those fields', async () => {
    handlers['POST /api/specials'] = (init) => {
      const b = JSON.parse(String(init?.body));
      return failed(400, { error: { code: 'INVALID_REQUEST', message: b.minutes === 999 ? 'minutes must be a whole number from 1 to 720' : 'something else', details: { field: 'minutes' } } });
    };
    render(<SpecialPage />);
    await fill({ price: '10.00', stock: '5', minutes: '999' });
    fireEvent.click(screen.getByTestId('launch-special'));
    expect(await screen.findByTestId('field-s-mins')).toHaveTextContent('Minutes must be a whole number from 1 to 720.');
  });

  it('a price that is not dollars and cents is refused beside the price field, with nothing sent', async () => {
    render(<SpecialPage />);
    await fill({ price: 'ten' });
    fireEvent.click(screen.getByTestId('launch-special'));
    expect(await screen.findByTestId('field-s-price')).toHaveTextContent('Price must be dollars and cents');
    expect(calledWith(fetchMock, '/api/specials', 'POST')).toHaveLength(0);
  });

  it('the cheapest-price check: a special price plus the item\'s cheapest options below zero is refused on the page, with nothing sent', async () => {
    render(<SpecialPage />);
    await fill({ item: 'i-11', price: '4.00' }); // $4.00 with a required -$5.00 choice would be -$1.00
    fireEvent.click(screen.getByTestId('launch-special'));
    expect(await screen.findByTestId('field-s-price')).toHaveTextContent('below $0.00');
    expect(calledWith(fetchMock, '/api/specials', 'POST')).toHaveLength(0);
  });

  it('the cheapest-price check lets a price that stays at or above zero through', async () => {
    handlers['POST /api/specials'] = () => ok(live({ item_id: 'i-11', name: 'Deal Burger', special_price_cents: 500 }), 201);
    render(<SpecialPage />);
    await fill({ item: 'i-11', price: '5.00' });
    fireEvent.click(screen.getByTestId('launch-special'));
    expect(await screen.findByTestId('special-live')).toHaveTextContent('Deal Burger');
  });

  it('a network error keeps the form and says so', async () => {
    handlers['POST /api/specials'] = () => {
      throw new TypeError('offline');
    };
    render(<SpecialPage />);
    await fill({});
    fireEvent.click(screen.getByTestId('launch-special'));
    expect(await screen.findByTestId('special-form-error')).toHaveTextContent('could not be sent');
    expect(screen.getByLabelText('Special price (dollars)')).toHaveValue('10.00');
  });

  it('End special now sends DELETE and switches to "No special is live."', async () => {
    current = { special: live() };
    handlers['DELETE /api/specials/current'] = () => ({ ok: true, status: 204, json: () => Promise.resolve({}) });
    render(<SpecialPage />);
    fireEvent.click(await screen.findByTestId('end-special'));
    expect(await screen.findByTestId('special-none')).toBeInTheDocument();
    expect(calledWith(fetchMock, '/api/specials/current', 'DELETE')).toHaveLength(1);
  });

  it('a failed End keeps the special and says so', async () => {
    current = { special: live() };
    handlers['DELETE /api/specials/current'] = () => failed(500);
    render(<SpecialPage />);
    fireEvent.click(await screen.findByTestId('end-special'));
    expect(await screen.findByRole('alert')).toHaveTextContent('The special could not be ended');
    expect(screen.getByTestId('special-live')).toBeInTheDocument();
  });
});
