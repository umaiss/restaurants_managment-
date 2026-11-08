/**
 * @vitest-environment jsdom
 */
// U6 Step 9: the diner page with the U6 features (BR4.1, BR6.2, BR7.2, BR8.2): Settings in the header, the ready banner
// on every tab, Rate your meal under the closed message, and "Same again" opening the Cart with a notice.
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup, act } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import TableView from '../TableView.js';

const streams: Array<{ handlers: Record<string, (e: MessageEvent) => void> }> = [];
const emit = (type: string, data: unknown) =>
  act(() => {
    streams[streams.length - 1].handlers[type]?.(new MessageEvent(type, { data: JSON.stringify(data) }));
  });

const menu = { items: [{ id: 'i-02', name: 'House Salad', description: '', price_cents: 850, category_id: 'c-01', available: true, allergens: [], options: [] }], categories: [{ id: 'c-01', name: 'Starters' }] };
const completedOrder = { order_number: 9, status: 'Completed', visit_id: 'v-1', placed_at: new Date().toISOString(), estimate_minutes: 10, lines: [{ menu_item_id: 'i-02', name: 'House Salad', quantity: 2, price_cents_each: 850, subtotal_cents: 1700, options: [] }] };
let currentOrders: object[];

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  streams.length = 0;
  currentOrders = [completedOrder];
  vi.stubGlobal('IntersectionObserver', class { observe() {} disconnect() {} unobserve() {} });
  vi.stubGlobal(
    'EventSource',
    class {
      handlers: Record<string, (e: MessageEvent) => void> = {};
      onopen: (() => void) | null = null;
      constructor() {
        streams.push(this);
      }
      addEventListener(type: string, handler: (e: MessageEvent) => void) {
        this.handlers[type] = handler;
      }
      close() {}
    }
  );
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      const answer = (body: unknown) => ({ ok: true, status: 200, json: async () => body });
      if (url === '/api/menu') return answer(menu);
      if (url === '/api/tables/5') return answer({ id: 5, last_closed_visit_id: null });
      if (url.includes('visit=current')) return answer({ orders: currentOrders });
      if (url.includes('visit=last_closed')) return answer({ orders: [completedOrder] });
      if (url.endsWith('/calls')) return answer({ calls: [] });
      if (url === '/api/specials/current') return answer({ special: null });
      return answer({});
    })
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function renderView() {
  return render(
    <MemoryRouter initialEntries={['/table/5']}>
      <Routes>
        <Route path="/table/:id" element={<TableView />} />
      </Routes>
    </MemoryRouter>
  );
}

describe('TableView with U6 features', () => {
  it('has the Settings gear in the header on every tab', async () => {
    renderView();
    expect(screen.getByTestId('open-settings')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('tab-orders'));
    expect(screen.getByTestId('open-settings')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('open-settings'));
    expect(screen.getByTestId('settings-sheet')).toBeInTheDocument();
  });

  it('shows the ready banner on whichever tab the diner is on when an order completes', async () => {
    renderView();
    await screen.findByTestId('menu-screen');
    emit('ORDER_STATUS_CHANGED', { order_number: 9, table_id: 5, status: 'Completed' });
    expect(await screen.findByTestId('ready-banner')).toHaveTextContent('Your order #9 is ready');
    fireEvent.click(screen.getByTestId('tab-cart'));
    expect(screen.getByTestId('ready-banner')).toBeInTheDocument();
  });

  it('shows Rate your meal under the closed message once the table is closed, with the dishes of the closed visit', async () => {
    renderView();
    await screen.findByTestId('menu-screen');
    expect(screen.queryByTestId('rate-meal')).toBeNull();
    emit('TABLE_CLOSED', { table_id: 5, archived_visit_id: 'v-1' });
    const takeover = await screen.findByTestId('table-closed-takeover');
    const rate = await screen.findByTestId('rate-meal');
    expect(takeover).toContainElement(rate);
    expect(takeover).toHaveTextContent('This table was closed');
    expect(rate).toHaveTextContent('House Salad');
  });

  // Found by the first version of this test: the items were added through state updaters that React ran later, and
  // the Cart tab opening in the same moment removed the screen that added them, so the Cart came up empty.
  it('regression: "Same again" on My orders opens the Cart with one notice and the items it added', async () => {
    renderView();
    fireEvent.click(screen.getByTestId('tab-orders'));
    fireEvent.click(await screen.findByTestId('same-again-9'));
    expect(await screen.findByTestId('cart-screen')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByTestId('cart-same-again-notice')).toHaveTextContent('Added 2 items'));
    expect(screen.getByTestId('cart-item-i-02')).toBeInTheDocument();
    // leaving the Cart takes the notice away
    fireEvent.click(screen.getByTestId('tab-menu'));
    fireEvent.click(screen.getByTestId('tab-cart'));
    expect(screen.queryByTestId('cart-same-again-notice')).toBeNull();
  });
});
