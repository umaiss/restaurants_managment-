// @vitest-environment jsdom
/// <reference types="vitest/globals" />
import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, cleanup, waitFor, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import KitchenBoardScreen from '../KitchenBoardScreen';

class MockEventSource {
  static instance: MockEventSource | null = null;
  listeners: Record<string, Array<(e: MessageEvent) => void>> = {};
  onopen: (() => void) | null = null;
  onerror: (() => void) | null = null;
  constructor() { MockEventSource.instance = this; }
  addEventListener() {}
  removeEventListener() {}
  close() {}
  triggerError() { this.onerror?.(); }
}

type FetchMockArgs = {
  tableOrders?: Record<number, Array<{
    order_number: number;
    table_id: number;
    status: 'Pending' | 'Preparing' | 'Completed' | 'Cancelled';
    placed_at: string;
    visit_id: string;
    lines: Array<{ menu_item_id: string; name: string; quantity: number; price_cents_each: number; subtotal_cents: number }>;
    subtotal_cents: number;
  }>>;
};

function setupFetchMock({ tableOrders = {} }: FetchMockArgs = {}) {
  vi.stubGlobal('fetch', vi.fn((url: string) => {
    // Menu
    if (url.includes('/api/menu')) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ categories: [], items: [] }),
      });
    }
    // Orders for a table
    const match = /\/api\/tables\/(\d+)\/orders/.exec(url);
    if (match) {
      const tableId = parseInt(match[1], 10);
      const orders = tableOrders[tableId] ?? [];
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ orders }),
      });
    }
    return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
  }));
}

function makeOrder(overrides: Partial<{
  order_number: number;
  table_id: number;
  status: 'Pending' | 'Preparing' | 'Completed' | 'Cancelled';
  placed_at: string;
  visit_id: string;
  lines: Array<{ menu_item_id: string; name: string; quantity: number; price_cents_each: number; subtotal_cents: number }>;
  subtotal_cents: number;
}> = {}) {
  return {
    order_number: overrides.order_number ?? 1,
    table_id: overrides.table_id ?? 1,
    status: overrides.status ?? 'Pending' as const,
    placed_at: overrides.placed_at ?? '2026-01-01T12:00:00Z',
    visit_id: overrides.visit_id ?? 'v-1',
    lines: overrides.lines ?? [{ menu_item_id: 'i-01', name: 'Burger', quantity: 1, price_cents_each: 1000, subtotal_cents: 1000 }],
    subtotal_cents: overrides.subtotal_cents ?? 1000,
  };
}

function renderScreen() {
  return render(
    <MemoryRouter>
      <KitchenBoardScreen />
    </MemoryRouter>
  );
}

beforeEach(() => {
  vi.stubGlobal('EventSource', MockEventSource);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('KitchenBoardScreen', () => {
  it('renders kitchen board container', () => {
    setupFetchMock();
    renderScreen();
    expect(screen.getByTestId('kitchen-board')).toBeTruthy();
  });

  it('shows loading state initially', () => {
    // Use a never-resolving fetch to keep loading state
    vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})));
    renderScreen();
    expect(screen.getByTestId('board-loading')).toBeTruthy();
  });

  it('shows empty state when no active orders', async () => {
    setupFetchMock({});
    renderScreen();
    await waitFor(() => expect(screen.getByTestId('board-empty')).toBeTruthy());
  });

  it('renders table sections with order cards when orders exist', async () => {
    setupFetchMock({ tableOrders: { 1: [makeOrder({ order_number: 1, table_id: 1 })] } });
    renderScreen();
    await waitFor(() => expect(screen.getByTestId('table-section-1')).toBeTruthy());
    expect(screen.getByTestId('order-card-1')).toBeTruthy();
  });

  it('regression: a Completed order stays on its table card while the table has an open order, newest first', async () => {
    setupFetchMock({
      tableOrders: {
        4: [
          makeOrder({ order_number: 20, table_id: 4, status: 'Completed', placed_at: '2026-01-01T12:00:00Z' }),
          makeOrder({ order_number: 21, table_id: 4, status: 'Pending', placed_at: '2026-01-01T12:30:00Z' }),
          makeOrder({ order_number: 22, table_id: 4, status: 'Cancelled', placed_at: '2026-01-01T12:45:00Z' }),
        ],
      },
    });
    renderScreen();
    await waitFor(() => expect(screen.getByTestId('table-section-4')).toBeTruthy());

    expect(screen.getByTestId('order-card-20')).toBeTruthy();
    expect(screen.queryByTestId('order-card-22')).toBeNull();
    const cards = screen.getAllByTestId(/^order-card-/);
    expect(cards.map((c) => c.getAttribute('data-testid'))).toEqual(['order-card-21', 'order-card-20']);
  });

  it('regression: table cards sit in a grid, not one full-width column', async () => {
    setupFetchMock({
      tableOrders: {
        1: [makeOrder({ order_number: 40, table_id: 1 })],
        2: [makeOrder({ order_number: 41, table_id: 2 })],
      },
    });
    renderScreen();
    await waitFor(() => expect(screen.getByTestId('board-grid')).toBeTruthy());
    const grid = screen.getByTestId('board-grid');
    expect(grid.style.display).toBe('grid');
    expect(grid.contains(screen.getByTestId('table-section-1'))).toBe(true);
    expect(grid.contains(screen.getByTestId('table-section-2'))).toBe(true);
  });

  it('regression: a table with only completed orders stays on the board with its bill link until it is closed', async () => {
    setupFetchMock({
      tableOrders: {
        6: [
          makeOrder({ order_number: 30, table_id: 6, status: 'Completed', placed_at: '2026-01-01T12:00:00Z' }),
          makeOrder({ order_number: 31, table_id: 6, status: 'Completed', placed_at: '2026-01-01T12:10:00Z' }),
        ],
      },
    });
    renderScreen();
    await waitFor(() => expect(screen.getByTestId('table-section-6')).toBeTruthy());

    // The card is there, with the link to the bill and the finished orders as they are
    expect(screen.getByText('Table 6 →').getAttribute('href')).toBe('/staff/tables/6');
    expect(screen.getByTestId('order-card-30')).toHaveTextContent('Completed');
    expect(screen.getByTestId('order-card-31')).toHaveTextContent('Completed');
    expect(screen.getByTestId('table-ready-to-close-6')).toHaveTextContent('No open orders. Open the bill to close this table.');
    // A board with a table on it is not empty
    expect(screen.queryByTestId('board-empty')).toBeNull();
  });

  it('a table with only Completed and Cancelled orders shows both as they are, with the bill link', async () => {
    setupFetchMock({
      tableOrders: {
        6: [
          makeOrder({ order_number: 30, table_id: 6, status: 'Completed' }),
          makeOrder({ order_number: 31, table_id: 6, status: 'Cancelled' }),
        ],
      },
    });
    renderScreen();
    await waitFor(() => expect(screen.getByTestId('table-section-6')).toBeTruthy());
    expect(screen.getByTestId('order-card-30')).toHaveTextContent('Completed');
    expect(screen.getByTestId('order-card-31')).toHaveTextContent('Cancelled');
    expect(screen.getByText('Table 6 →')).toBeTruthy();
    // Finished orders offer no action buttons
    expect(screen.queryByTestId('btn-preparing-30')).toBeNull();
    expect(screen.queryByTestId('btn-complete-30')).toBeNull();
    expect(screen.queryByTestId('btn-cancel-31')).toBeNull();
  });

  it('a table with an open order shows no "ready to close" line', async () => {
    setupFetchMock({
      tableOrders: {
        2: [
          makeOrder({ order_number: 50, table_id: 2, status: 'Completed' }),
          makeOrder({ order_number: 51, table_id: 2, status: 'Preparing' }),
        ],
      },
    });
    renderScreen();
    await waitFor(() => expect(screen.getByTestId('table-section-2')).toBeTruthy());
    expect(screen.queryByTestId('table-ready-to-close-2')).toBeNull();
  });

  it('the empty state stays for a board with no table at all', async () => {
    setupFetchMock({});
    renderScreen();
    await waitFor(() => expect(screen.getByTestId('board-empty')).toBeTruthy());
    expect(screen.getByText(/No open orders right now\./)).toBeTruthy();
  });

  it('"Table N →" links rendered correctly', async () => {
    setupFetchMock({ tableOrders: { 3: [makeOrder({ order_number: 2, table_id: 3 })] } });
    renderScreen();
    await waitFor(() => expect(screen.getByTestId('table-section-3')).toBeTruthy());
    const link = screen.getByText('Table 3 →');
    expect(link).toBeTruthy();
    expect(link.getAttribute('href')).toBe('/staff/tables/3');
  });

  it('sorts table sections by table number ascending', async () => {
    setupFetchMock({
      tableOrders: {
        5: [makeOrder({ order_number: 10, table_id: 5 })],
        2: [makeOrder({ order_number: 11, table_id: 2 })],
      },
    });
    renderScreen();
    await waitFor(() => expect(screen.getByTestId('table-section-2')).toBeTruthy());
    const sections = screen.getAllByTestId(/table-section-/);
    // Table 2 should come before table 5
    expect(sections[0].getAttribute('data-testid')).toBe('table-section-2');
    expect(sections[1].getAttribute('data-testid')).toBe('table-section-5');
  });

  // Fix 6: reconnect banner appears after disconnect
  it('reconnect banner appears after connection is down for more than 3 seconds', async () => {
    vi.useFakeTimers();
    setupFetchMock({});
    renderScreen();

    // Trigger an SSE error (disconnect)
    act(() => {
      MockEventSource.instance!.triggerError();
    });

    // Banner should not appear immediately
    expect(screen.queryByTestId('reconnect-banner')).toBeNull();

    // Advance timers past 3 seconds
    act(() => {
      vi.advanceTimersByTime(3100);
    });

    expect(screen.getByTestId('reconnect-banner')).toBeTruthy();
    expect(screen.getByText(/Reconnecting… Updates will resume shortly\./)).toBeTruthy();

    vi.useRealTimers();
  });
});
