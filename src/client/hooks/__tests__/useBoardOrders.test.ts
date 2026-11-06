// @vitest-environment jsdom
/// <reference types="vitest/globals" />
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useBoardOrders } from '../useBoardOrders';

// --- MockEventSource ---
type EventMap = Record<string, ((e: MessageEvent) => void)[]>;

class MockEventSource {
  static instance: MockEventSource | null = null;
  url: string;
  listeners: EventMap = {};
  closed = false;

  constructor(url: string) {
    this.url = url;
    MockEventSource.instance = this;
  }

  addEventListener(type: string, handler: (e: MessageEvent) => void) {
    if (!this.listeners[type]) this.listeners[type] = [];
    this.listeners[type].push(handler);
  }

  removeEventListener(type: string, handler: (e: MessageEvent) => void) {
    this.listeners[type] = (this.listeners[type] ?? []).filter((h) => h !== handler);
  }

  close() {
    this.closed = true;
  }

  triggerMessage(type: string, data: unknown) {
    const event = { data: JSON.stringify(data) } as MessageEvent;
    for (const handler of this.listeners[type] ?? []) {
      handler(event);
    }
  }
}

// Minimal order fixture
function makeOrder(overrides: Partial<{
  order_number: number;
  table_id: number;
  status: 'Pending' | 'Preparing' | 'Completed' | 'Cancelled';
  placed_at: string;
  lines: Array<{ menu_item_id: string; name: string; quantity: number; price_cents_each: number; subtotal_cents: number }>;
  visit_id: string;
}> = {}) {
  return {
    order_number: overrides.order_number ?? 1,
    table_id: overrides.table_id ?? 1,
    status: overrides.status ?? 'Pending' as const,
    placed_at: overrides.placed_at ?? '2026-01-01T12:00:00Z',
    lines: overrides.lines ?? [{ menu_item_id: 'i-01', name: 'Burger', quantity: 1, price_cents_each: 1000, subtotal_cents: 1000 }],
    visit_id: overrides.visit_id ?? 'v-1',
    subtotal_cents: 1000,
    isNew: false,
  };
}

function setupFetchMock(tableOrders: Record<number, ReturnType<typeof makeOrder>[]> = {}) {
  vi.stubGlobal('fetch', vi.fn((url: string) => {
    const match = /\/api\/tables\/(\d+)\/orders/.exec(url);
    if (match) {
      const tableId = parseInt(match[1], 10);
      const orders = tableOrders[tableId] ?? [];
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ orders }),
      });
    }
    return Promise.resolve({ ok: true, json: () => Promise.resolve({ orders: [] }) });
  }));
}

beforeEach(() => {
  MockEventSource.instance = null;
  vi.stubGlobal('EventSource', MockEventSource);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('useBoardOrders', () => {
  it('loading is true before fetches resolve, false after', async () => {
    setupFetchMock({});
    const { result } = renderHook(() => useBoardOrders());
    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.loading).toBe(false));
  });

  it('on mount: fetches orders for tables and populates map', async () => {
    const order = makeOrder({ order_number: 1, table_id: 1 });
    setupFetchMock({ 1: [order] });
    const { result } = renderHook(() => useBoardOrders());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.ordersByTable.has(1)).toBe(true);
    expect(result.current.ordersByTable.get(1)![0].order_number).toBe(1);
  });

  it('ORDER_PLACED SSE adds order to correct table slot with isNew=true', async () => {
    setupFetchMock({});
    const { result } = renderHook(() => useBoardOrders());
    await waitFor(() => expect(result.current.loading).toBe(false));
    const es = MockEventSource.instance!;
    act(() => {
      es.triggerMessage('ORDER_PLACED', {
        order_number: 5,
        table_id: 3,
        status: 'Pending',
        placed_at: '2026-01-01T12:05:00Z',
        lines: [{ menu_item_id: 'i-01', name: 'Burger', quantity: 1, price_cents_each: 1000, subtotal_cents: 1000 }],
        visit_id: 'v-3',
      });
    });
    expect(result.current.ordersByTable.get(3)![0].order_number).toBe(5);
    expect(result.current.ordersByTable.get(3)![0].isNew).toBe(true);
  });

  it('ORDER_STATUS_CHANGED updates status in map', async () => {
    const order = makeOrder({ order_number: 2, table_id: 2, status: 'Pending' });
    setupFetchMock({ 2: [order] });
    const { result } = renderHook(() => useBoardOrders());
    await waitFor(() => expect(result.current.loading).toBe(false));
    const es = MockEventSource.instance!;
    act(() => {
      es.triggerMessage('ORDER_STATUS_CHANGED', { order_number: 2, table_id: 2, status: 'Preparing' });
    });
    expect(result.current.ordersByTable.get(2)![0].status).toBe('Preparing');
  });

  it('Pending→Preparing transition clears isNew flag', async () => {
    setupFetchMock({});
    const { result } = renderHook(() => useBoardOrders());
    await waitFor(() => expect(result.current.loading).toBe(false));
    const es = MockEventSource.instance!;
    act(() => {
      es.triggerMessage('ORDER_PLACED', {
        order_number: 7,
        table_id: 4,
        status: 'Pending',
        placed_at: '2026-01-01T12:00:00Z',
        lines: [],
        visit_id: 'v-4',
      });
    });
    expect(result.current.ordersByTable.get(4)![0].isNew).toBe(true);
    act(() => {
      es.triggerMessage('ORDER_STATUS_CHANGED', { order_number: 7, table_id: 4, status: 'Preparing' });
    });
    expect(result.current.ordersByTable.get(4)![0].isNew).toBe(false);
  });

  it('TABLE_CLOSED removes all orders for that tableId', async () => {
    const order = makeOrder({ order_number: 3, table_id: 5 });
    setupFetchMock({ 5: [order] });
    const { result } = renderHook(() => useBoardOrders());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.ordersByTable.has(5)).toBe(true);
    const es = MockEventSource.instance!;
    act(() => {
      es.triggerMessage('TABLE_CLOSED', { table_id: 5 });
    });
    expect(result.current.ordersByTable.has(5)).toBe(false);
  });

  // Fix 3: table entry removed when last order transitions to terminal state
  it('table entry removed when last order transitions to Completed', async () => {
    const order = makeOrder({ order_number: 10, table_id: 7, status: 'Preparing' });
    setupFetchMock({ 7: [order] });
    const { result } = renderHook(() => useBoardOrders());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.ordersByTable.has(7)).toBe(true);
    const es = MockEventSource.instance!;
    act(() => {
      es.triggerMessage('ORDER_STATUS_CHANGED', { order_number: 10, table_id: 7, status: 'Completed' });
    });
    expect(result.current.ordersByTable.has(7)).toBe(false);
  });

  it('table entry retained when at least one order remains non-terminal after status change', async () => {
    const order1 = makeOrder({ order_number: 11, table_id: 8, status: 'Preparing' });
    const order2 = makeOrder({ order_number: 12, table_id: 8, status: 'Pending' });
    setupFetchMock({ 8: [order1, order2] });
    const { result } = renderHook(() => useBoardOrders());
    await waitFor(() => expect(result.current.loading).toBe(false));
    const es = MockEventSource.instance!;
    act(() => {
      es.triggerMessage('ORDER_STATUS_CHANGED', { order_number: 11, table_id: 8, status: 'Completed' });
    });
    // order2 is still Pending, so table 8 stays in the map
    expect(result.current.ordersByTable.has(8)).toBe(true);
  });
});
