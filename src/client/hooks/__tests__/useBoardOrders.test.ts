// @vitest-environment jsdom
/// <reference types="vitest/globals" />
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act, waitFor, cleanup } from '@testing-library/react';
import { useBoardOrders } from '../useBoardOrders';

// --- MockEventSource ---
type EventMap = Record<string, ((e: MessageEvent) => void)[]>;

class MockEventSource {
  static instance: MockEventSource | null = null;
  url: string;
  listeners: EventMap = {};
  closed = false;
  onopen: (() => void) | null = null;
  onerror: (() => void) | null = null;

  constructor(url: string) {
    this.url = url;
    MockEventSource.instance = this;
  }

  open() {
    this.onopen?.();
  }

  drop() {
    this.onerror?.();
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

/**
 * U7 (BR4.1, BR10.3): the board reads the table list from the server instead of a fixed 10 tables. This is
 * the list v1's tests assumed, 10 tables with no open requests.
 */
const TEN_TABLES = {
  ok: true,
  json: () => Promise.resolve({ tables: Array.from({ length: 10 }, (_, i) => ({ id: i + 1, label: `Table ${i + 1}`, open_calls: [] })) }),
};

function setupFetchMock(tableOrders: Record<number, ReturnType<typeof makeOrder>[]> = {}) {
  vi.stubGlobal('fetch', vi.fn((url: string) => {
    if (url.includes('/api/staff/tables')) return Promise.resolve(TEN_TABLES);
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
  cleanup(); // unmount the hooks, so the shared staff stream closes and the next test opens its own
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

  it('regression: two events arriving together both reach the board', async () => {
    setupFetchMock({});
    const { result } = renderHook(() => useBoardOrders());
    await waitFor(() => expect(result.current.loading).toBe(false));
    const es = MockEventSource.instance!;
    const placed = (order_number: number, table_id: number) => ({
      order_number,
      table_id,
      status: 'Pending',
      placed_at: '2026-01-01T12:05:00Z',
      lines: [{ menu_item_id: 'i-01', name: 'Burger', quantity: 1, price_cents_each: 1000, subtotal_cents: 1000 }],
      visit_id: `v-${table_id}`,
    });
    act(() => {
      es.triggerMessage('ORDER_PLACED', placed(7, 3));
      es.triggerMessage('ORDER_PLACED', placed(8, 4));
    });
    expect(result.current.ordersByTable.get(3)![0].order_number).toBe(7);
    expect(result.current.ordersByTable.get(4)![0].order_number).toBe(8);
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

  it('regression: a table with only completed orders stays on the board with its bill link until it is closed', async () => {
    const order = makeOrder({ order_number: 10, table_id: 7, status: 'Preparing' });
    setupFetchMock({ 7: [order] });
    const { result } = renderHook(() => useBoardOrders());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.ordersByTable.has(7)).toBe(true);
    const es = MockEventSource.instance!;

    // The last open order is completed: the table must NOT leave the board (the old filter dropped it here)
    act(() => {
      es.triggerMessage('ORDER_STATUS_CHANGED', { order_number: 10, table_id: 7, status: 'Completed' });
    });
    expect(result.current.ordersByTable.has(7)).toBe(true);
    expect(result.current.ordersByTable.get(7)![0].status).toBe('Completed');

    // Only closing the table takes it off
    act(() => {
      es.triggerMessage('TABLE_CLOSED', { table_id: 7, archived_visit_id: 'v-1' });
    });
    expect(result.current.ordersByTable.has(7)).toBe(false);
  });

  it('a table whose orders are all Cancelled stays too, until it is closed', async () => {
    setupFetchMock({ 9: [makeOrder({ order_number: 13, table_id: 9, status: 'Pending' })] });
    const { result } = renderHook(() => useBoardOrders());
    await waitFor(() => expect(result.current.loading).toBe(false));
    const es = MockEventSource.instance!;
    act(() => {
      es.triggerMessage('ORDER_STATUS_CHANGED', { order_number: 13, table_id: 9, status: 'Cancelled' });
    });
    expect(result.current.ordersByTable.get(9)).toHaveLength(1);
    expect(result.current.ordersByTable.get(9)![0].status).toBe('Cancelled');
  });

  it('a table that was already all-finished when the board loads is on the board', async () => {
    setupFetchMock({ 3: [makeOrder({ order_number: 14, table_id: 3, status: 'Completed' })] });
    const { result } = renderHook(() => useBoardOrders());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.ordersByTable.get(3)).toHaveLength(1);
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

  describe('a board whose fetches are slow, and a stream that comes and goes', () => {
    type Orders = ReturnType<typeof makeOrder>[];
    /** A fetch the test controls: `server` is what the server holds; held answers are released by hand. */
    function controllableFetch(server: Record<number, Orders>) {
      const held: Array<() => void> = [];
      let hold = false;
      let failTable: number | null = null;
      const calls = { orders: 0 };
      vi.stubGlobal(
        'fetch',
        vi.fn((url: string) => {
          // U7: the table list answers at once and is not one of the order reads these tests count.
          if (url.includes('/api/staff/tables')) return Promise.resolve(TEN_TABLES);
          const match = /\/api\/tables\/(\d+)\/orders/.exec(url);
          const tableId = match ? parseInt(match[1], 10) : 0;
          calls.orders += 1;
          if (failTable === tableId) return Promise.reject(new TypeError('Failed to fetch'));
          // The answer is taken when the request is sent, like a server that answered before a later change.
          const orders = server[tableId] ?? [];
          const answer = { ok: true, json: () => Promise.resolve({ orders }) };
          if (!hold) return Promise.resolve(answer);
          return new Promise((resolve) => held.push(() => resolve(answer)));
        })
      );
      return {
        server,
        calls,
        holdNext: () => (hold = true),
        stopHolding: () => (hold = false),
        release: () => held.splice(0).forEach((r) => r()),
        failTable: (t: number | null) => (failTable = t),
      };
    }

    it('regression: a table closed while the board is still loading does not come back when the first fetch resolves', async () => {
      const ctl = controllableFetch({ 5: [makeOrder({ order_number: 3, table_id: 5, status: 'Completed' })] });
      ctl.holdNext();
      const { result } = renderHook(() => useBoardOrders());
      await waitFor(() => expect(MockEventSource.instance).not.toBeNull());

      // The close arrives while the first fetch is still on its way
      act(() => {
        MockEventSource.instance!.triggerMessage('TABLE_CLOSED', { table_id: 5, archived_visit_id: 'v-1' });
      });
      expect(result.current.loading).toBe(true);

      // The fetch answers with the table as it was before the close
      await act(async () => {
        ctl.release();
      });
      await waitFor(() => expect(result.current.loading).toBe(false));
      expect(result.current.ordersByTable.has(5)).toBe(false);
    });

    it('an order placed after that close, while the first fetch is still on its way, is kept', async () => {
      const ctl = controllableFetch({ 5: [makeOrder({ order_number: 3, table_id: 5, status: 'Completed' })] });
      ctl.holdNext();
      const { result } = renderHook(() => useBoardOrders());
      await waitFor(() => expect(MockEventSource.instance).not.toBeNull());

      act(() => {
        MockEventSource.instance!.triggerMessage('TABLE_CLOSED', { table_id: 5, archived_visit_id: 'v-1' });
        MockEventSource.instance!.triggerMessage('ORDER_PLACED', {
          order_number: 4,
          table_id: 5,
          status: 'Pending',
          placed_at: '2026-01-01T13:00:00Z',
          lines: [{ menu_item_id: 'i-01', name: 'Burger', quantity: 1, price_cents_each: 1000, subtotal_cents: 1000 }],
        });
      });
      await act(async () => {
        ctl.release();
      });
      await waitFor(() => expect(result.current.loading).toBe(false));
      expect(result.current.ordersByTable.get(5)!.map((o) => o.order_number)).toEqual([4]);
    });

    it('fetches the board again when the stream (re)connects, and a table closed while it was down leaves', async () => {
      const ctl = controllableFetch({ 5: [makeOrder({ order_number: 3, table_id: 5, status: 'Completed' })] });
      const { result } = renderHook(() => useBoardOrders());
      await waitFor(() => expect(result.current.ordersByTable.has(5)).toBe(true));

      // The stream drops; the table is closed meanwhile and the TABLE_CLOSED event is never seen
      act(() => MockEventSource.instance!.drop());
      ctl.server[5] = [];
      const before = ctl.calls.orders;
      act(() => MockEventSource.instance!.open());

      await waitFor(() => expect(result.current.ordersByTable.has(5)).toBe(false));
      expect(ctl.calls.orders).toBe(before + 10); // one read of each of the ten tables
    });

    it('a reconnect picks up a status change that was missed', async () => {
      const ctl = controllableFetch({ 2: [makeOrder({ order_number: 8, table_id: 2, status: 'Pending' })] });
      const { result } = renderHook(() => useBoardOrders());
      await waitFor(() => expect(result.current.ordersByTable.get(2)![0].status).toBe('Pending'));

      act(() => MockEventSource.instance!.drop());
      ctl.server[2] = [makeOrder({ order_number: 8, table_id: 2, status: 'Completed' })];
      act(() => MockEventSource.instance!.open());

      await waitFor(() => expect(result.current.ordersByTable.get(2)![0].status).toBe('Completed'));
    });

    it('does not fetch in a loop: staying connected causes no more reads, and a drop alone causes none', async () => {
      const ctl = controllableFetch({});
      const { result } = renderHook(() => useBoardOrders());
      await waitFor(() => expect(result.current.loading).toBe(false));
      act(() => MockEventSource.instance!.open());
      await waitFor(() => expect(ctl.calls.orders).toBe(20)); // the first load, then the one for the connect
      await new Promise((r) => setTimeout(r, 100));
      expect(ctl.calls.orders).toBe(20);

      act(() => MockEventSource.instance!.drop());
      await new Promise((r) => setTimeout(r, 50));
      expect(ctl.calls.orders).toBe(20);

      act(() => MockEventSource.instance!.open());
      await waitFor(() => expect(ctl.calls.orders).toBe(30));
    });

    it('an order placed while a reconnect fetch is on its way is not lost, and keeps its "new" highlight', async () => {
      const ctl = controllableFetch({});
      const { result } = renderHook(() => useBoardOrders());
      await waitFor(() => expect(result.current.loading).toBe(false));

      ctl.holdNext();
      act(() => MockEventSource.instance!.open());
      act(() => {
        MockEventSource.instance!.triggerMessage('ORDER_PLACED', {
          order_number: 9,
          table_id: 6,
          status: 'Pending',
          placed_at: '2026-01-01T13:00:00Z',
          lines: [{ menu_item_id: 'i-01', name: 'Burger', quantity: 1, price_cents_each: 1000, subtotal_cents: 1000 }],
        });
      });
      await act(async () => {
        ctl.release(); // the server's answer was taken before the order existed: table 6 is empty in it
      });
      await waitFor(() => expect(ctl.calls.orders).toBe(20));
      expect(result.current.ordersByTable.get(6)).toHaveLength(1);
      expect(result.current.ordersByTable.get(6)![0].isNew).toBe(true);
    });

    it('a table that cannot be read on a reconnect keeps its card', async () => {
      const ctl = controllableFetch({ 4: [makeOrder({ order_number: 5, table_id: 4, status: 'Preparing' })] });
      const { result } = renderHook(() => useBoardOrders());
      await waitFor(() => expect(result.current.ordersByTable.has(4)).toBe(true));

      ctl.failTable(4);
      act(() => MockEventSource.instance!.drop());
      act(() => MockEventSource.instance!.open());
      await waitFor(() => expect(ctl.calls.orders).toBe(20));
      expect(result.current.ordersByTable.has(4)).toBe(true);
    });

    it('an older answer that arrives after a newer one does not undo it', async () => {
      const ctl = controllableFetch({ 3: [makeOrder({ order_number: 6, table_id: 3, status: 'Pending' })] });
      ctl.holdNext();
      const { result } = renderHook(() => useBoardOrders()); // first fetch: held, shows Pending
      await waitFor(() => expect(ctl.calls.orders).toBe(10));

      // The server moves on; a second fetch (stream connected) is sent and answers at once
      ctl.server[3] = [makeOrder({ order_number: 6, table_id: 3, status: 'Completed' })];
      ctl.stopHolding();
      act(() => MockEventSource.instance!.open());
      await waitFor(() => expect(result.current.ordersByTable.get(3)?.[0].status).toBe('Completed'));

      // Now the old, slow answer finally arrives
      await act(async () => {
        ctl.release();
      });
      expect(result.current.ordersByTable.get(3)![0].status).toBe('Completed');
    });
  });
});
