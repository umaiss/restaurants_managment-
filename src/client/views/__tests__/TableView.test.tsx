/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest';
import { render, screen, waitFor, cleanup, act } from '@testing-library/react';
import React from 'react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import TableView from '../TableView.js';

class MockEventSource {
  static instance: MockEventSource | null = null;
  listeners: Record<string, ((e: MessageEvent) => void)[]> = {};
  onopen: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onmessage: ((e: MessageEvent) => void) | null = null;
  constructor(public url: string) {
    MockEventSource.instance = this;
  }
  addEventListener(type: string, handler: (e: MessageEvent) => void) {
    (this.listeners[type] ??= []).push(handler);
  }
  close() {}
  open() {
    this.onopen?.();
  }
  drop() {
    this.onerror?.();
  }
  trigger(type: string, data: unknown) {
    for (const h of this.listeners[type] ?? []) h({ data: JSON.stringify(data) } as MessageEvent);
  }
}

const CART_KEY = 'cart:table:5';
const MARKER_KEY = 'cart-closed-marker:5';
const CART = [{ menuItemId: 'i-01', name: 'Burger', priceCents: 1050, quantity: 2 }];
const MENU = {
  categories: [{ id: 'mains', name: 'Mains' }],
  items: [{ id: 'i-01', name: 'Burger', description: 'x', price_cents: 1050, category_id: 'mains', available: true }],
};

let lastClosed: string | null;
let tableStatusFails: boolean;
let holdNextStatusAnswer: boolean;
let releaseStatusAnswer: (() => void) | null;
let fetchMock: Mock<any[], any>;

function renderView() {
  return render(
    <MemoryRouter initialEntries={['/table/5']}>
      <Routes>
        <Route path="/table/:id" element={<TableView />} />
      </Routes>
    </MemoryRouter>
  );
}

const storedCart = () => JSON.parse(localStorage.getItem(CART_KEY) ?? '[]') as unknown[];

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  MockEventSource.instance = null;
  lastClosed = null;
  tableStatusFails = false;
  holdNextStatusAnswer = false;
  releaseStatusAnswer = null;
  vi.stubGlobal('EventSource', MockEventSource);
  vi.stubGlobal('IntersectionObserver', vi.fn(() => ({ observe: vi.fn(), unobserve: vi.fn(), disconnect: vi.fn() })));
  fetchMock = vi.fn((url: string) => {
    if (url === '/api/menu') return Promise.resolve({ ok: true, status: 200, json: async () => MENU });
    if (url === '/api/tables/5') {
      if (tableStatusFails) return Promise.reject(new TypeError('Failed to fetch'));
      const answer = (value: string | null) => ({
        ok: true,
        status: 200,
        json: async () => ({
          id: 5,
          visit_id: null,
          has_open_orders: false,
          has_any_orders: false,
          state: 'closed',
          last_closed_visit_id: value,
        }),
      });
      if (holdNextStatusAnswer) {
        // The server's answer is on its way: it carries the value as it is now, and arrives later.
        holdNextStatusAnswer = false;
        const valueWhenAsked = lastClosed;
        return new Promise((resolve) => {
          releaseStatusAnswer = () => resolve(answer(valueWhenAsked));
        });
      }
      return Promise.resolve(answer(lastClosed));
    }
    return Promise.resolve({ ok: true, status: 200, json: async () => ({ orders: [] }) });
  });
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('TableView: a table closed while this device was away', () => {
  it('regression: a cart saved before the table was closed is cleared when the page is opened again', async () => {
    // Party 1 saved a cart, then the table was closed while their tab was shut.
    localStorage.setItem(CART_KEY, JSON.stringify(CART));
    localStorage.setItem(MARKER_KEY, 'visit-old');
    lastClosed = 'visit-new';

    renderView();

    await waitFor(() => expect(screen.getByTestId('table-closed-takeover')).toBeInTheDocument());
    expect(screen.getByTestId('table-closed-takeover')).toHaveTextContent('This table was closed');
    expect(storedCart()).toHaveLength(0);
    // The device now knows about this close, so opening the page again is quiet
    expect(localStorage.getItem(MARKER_KEY)).toBe('visit-new');
    // The next party cannot place the old cart: nothing is left to place
    expect(screen.queryByTestId('menu-cart-summary')).toBeNull();
  });

  it('keeps the cart when the table was not closed meanwhile', async () => {
    localStorage.setItem(CART_KEY, JSON.stringify(CART));
    localStorage.setItem(MARKER_KEY, 'visit-old');
    lastClosed = 'visit-old';

    renderView();

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/tables/5'));
    await act(async () => {});
    expect(screen.queryByTestId('table-closed-takeover')).toBeNull();
    expect(storedCart()).toHaveLength(1);
  });

  it('a table that was never closed keeps the cart too (marker "never closed")', async () => {
    localStorage.setItem(CART_KEY, JSON.stringify(CART));
    renderView(); // no marker yet, never closed: first visit, the marker is recorded
    await waitFor(() => expect(localStorage.getItem(MARKER_KEY)).toBe('never-closed'));

    cleanup();
    renderView(); // opened again, still never closed
    await waitFor(() => expect(fetchMock.mock.calls.filter((c) => c[0] === '/api/tables/5')).toHaveLength(2));
    await act(async () => {});
    expect(screen.queryByTestId('table-closed-takeover')).toBeNull();
  });

  it('a first visit with an empty cart records the marker and shows no message', async () => {
    lastClosed = 'visit-from-before-this-device-came';
    renderView();
    await waitFor(() => expect(localStorage.getItem(MARKER_KEY)).toBe('visit-from-before-this-device-came'));
    expect(screen.queryByTestId('table-closed-takeover')).toBeNull();
  });

  it('a saved cart with no record of when it was started cannot be trusted: it is cleared quietly', async () => {
    localStorage.setItem(CART_KEY, JSON.stringify(CART));
    lastClosed = 'visit-x';
    renderView();
    await waitFor(() => expect(storedCart()).toHaveLength(0));
    expect(screen.queryByTestId('table-closed-takeover')).toBeNull();
    expect(localStorage.getItem(MARKER_KEY)).toBe('visit-x');
  });

  it('keeps the cart when the server cannot be reached', async () => {
    tableStatusFails = true;
    localStorage.setItem(CART_KEY, JSON.stringify(CART));
    localStorage.setItem(MARKER_KEY, 'visit-old');
    renderView();
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/tables/5'));
    await act(async () => {});
    expect(storedCart()).toHaveLength(1);
    expect(screen.queryByTestId('table-closed-takeover')).toBeNull();
  });

  it('checks again when the live stream reconnects: a close that happened meanwhile resets the device', async () => {
    localStorage.setItem(CART_KEY, JSON.stringify(CART));
    localStorage.setItem(MARKER_KEY, 'visit-old');
    lastClosed = 'visit-old';
    renderView();
    await waitFor(() => expect(MockEventSource.instance).not.toBeNull());
    act(() => MockEventSource.instance!.open());
    await waitFor(() => expect(fetchMock.mock.calls.filter((c) => c[0] === '/api/tables/5')).toHaveLength(1));
    expect(storedCart()).toHaveLength(1);

    // The connection drops, the table is closed meanwhile, the stream comes back
    lastClosed = 'visit-new';
    act(() => MockEventSource.instance!.drop());
    await waitFor(() => expect(MockEventSource.instance).not.toBeNull(), { timeout: 3000 });
    await new Promise((r) => setTimeout(r, 1200)); // the stream's first retry (after 1 second)
    act(() => MockEventSource.instance!.open());

    await waitFor(() => expect(screen.getByTestId('table-closed-takeover')).toBeInTheDocument(), { timeout: 3000 });
    expect(storedCart()).toHaveLength(0);
    expect(localStorage.getItem(MARKER_KEY)).toBe('visit-new');
  });

  it('a live TABLE_CLOSED event clears the cart and records the close, so reopening the page is quiet', async () => {
    localStorage.setItem(CART_KEY, JSON.stringify(CART));
    localStorage.setItem(MARKER_KEY, 'visit-old');
    lastClosed = 'visit-old';
    renderView();
    await waitFor(() => expect(MockEventSource.instance).not.toBeNull());
    act(() => MockEventSource.instance!.open());

    act(() => MockEventSource.instance!.trigger('TABLE_CLOSED', { table_id: 5, archived_visit_id: 'visit-live' }));

    await waitFor(() => expect(screen.getByTestId('table-closed-takeover')).toBeInTheDocument());
    expect(storedCart()).toHaveLength(0);
    expect(localStorage.getItem(MARKER_KEY)).toBe('visit-live');
  });

  describe('races around the server answer', () => {
    const LATER_ITEM = { menuItemId: 'i-02', name: 'Fries', priceCents: 450, quantity: 1 };

    it('a line added while the first answer is on its way is kept; only the lines that were there before go', async () => {
      // An old cart with no recorded marker (saved by an earlier version), and the answer is slow.
      localStorage.setItem(CART_KEY, JSON.stringify(CART));
      lastClosed = 'visit-x';
      holdNextStatusAnswer = true;
      renderView();
      await waitFor(() => expect(releaseStatusAnswer).not.toBeNull());

      // The diner adds a Fries while the request is still out.
      localStorage.setItem(CART_KEY, JSON.stringify([...CART, LATER_ITEM]));
      await act(async () => {
        releaseStatusAnswer!();
      });

      await waitFor(() => expect(localStorage.getItem(MARKER_KEY)).toBe('visit-x'));
      // U6 changed this line (see code-summary "v1 tests changed"): when the cart is saved again, the v1-shaped line
      // is written in the new line model, so it carries the new fields besides the v1 ones.
      expect(storedCart()).toMatchObject([LATER_ITEM]);
      expect(storedCart()[0]).toMatchObject({ lineId: 'i-02', optionChoices: [] });
      expect(screen.queryByTestId('table-closed-takeover')).toBeNull();
    });

    it('an item added to an empty cart while the first answer is on its way is not dropped', async () => {
      lastClosed = null;
      holdNextStatusAnswer = true;
      renderView();
      await waitFor(() => expect(releaseStatusAnswer).not.toBeNull());

      localStorage.setItem(CART_KEY, JSON.stringify([LATER_ITEM]));
      await act(async () => {
        releaseStatusAnswer!();
      });

      await waitFor(() => expect(localStorage.getItem(MARKER_KEY)).toBe('never-closed'));
      expect(storedCart()).toEqual([LATER_ITEM]);
    });

    it('regression: an older server answer that arrives after a live TABLE_CLOSED cannot overwrite the newer marker', async () => {
      localStorage.setItem(CART_KEY, JSON.stringify(CART));
      localStorage.setItem(MARKER_KEY, 'visit-old');
      lastClosed = 'visit-old';
      renderView();
      await waitFor(() => expect(MockEventSource.instance).not.toBeNull());
      act(() => MockEventSource.instance!.open());
      await waitFor(() => expect(fetchMock.mock.calls.filter((c) => c[0] === '/api/tables/5')).toHaveLength(1));

      // The stream drops and comes back: a check starts, and its answer (still "visit-old") is slow.
      act(() => MockEventSource.instance!.drop());
      holdNextStatusAnswer = true;
      await new Promise((r) => setTimeout(r, 1200)); // the stream's first retry
      act(() => MockEventSource.instance!.open());
      await waitFor(() => expect(releaseStatusAnswer).not.toBeNull(), { timeout: 3000 });

      // Meanwhile the table is closed: the live event carries the newer value.
      act(() => MockEventSource.instance!.trigger('TABLE_CLOSED', { table_id: 5, archived_visit_id: 'visit-new' }));
      await waitFor(() => expect(localStorage.getItem(MARKER_KEY)).toBe('visit-new'));

      // The old answer finally arrives. It must change nothing.
      await act(async () => {
        releaseStatusAnswer!();
      });
      await act(async () => {});
      expect(localStorage.getItem(MARKER_KEY)).toBe('visit-new');
    });
  });

  it('has no made-up visit id in session storage any more', async () => {
    renderView();
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/tables/5'));
    expect(sessionStorage.getItem('visit-id:table:5')).toBeNull();
  });
});
