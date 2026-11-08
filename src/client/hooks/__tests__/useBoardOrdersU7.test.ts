// @vitest-environment jsdom
/// <reference types="vitest/globals" />
// U7 Step 11: the Kitchen Board's data now comes from the server's table list (BR4.1, BR10.3) and carries the open
// requests (BR3.2), options and completed_at (BR2.2, BR2.3).
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useBoardOrders } from '../useBoardOrders';
import { MockEventSource, calledWith, failed, ok, routeFetch, stubStream } from '../../staff/__tests__/u7Mocks';

const table = (id: number, calls: Array<{ id: string; kind: 'waiter' | 'bill'; opened_at: string }> = []) => ({ id, label: `Table ${id}`, open_calls: calls });
const line = { menu_item_id: 'i-04', name: 'Classic Burger', quantity: 1, price_cents_each: 1450, subtotal_cents: 1450, station: 'Grill', options: [{ label: 'Large', price_delta_cents: 300 }] };
const order = (n: number, tableId: number, over: object = {}) => ({ order_number: n, status: 'Pending', placed_at: '2026-11-08T12:00:00Z', visit_id: 'v', lines: [line], subtotal_cents: 1450, completed_at: null, ...over });

let tables: ReturnType<typeof table>[];
let orders: Record<number, ReturnType<typeof order>[]>;
function wireOrders() {
  return vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.startsWith('/api/staff/tables')) return ok({ tables });
      const m = /\/api\/tables\/(\d+)\/orders/.exec(url);
      return ok({ orders: m ? (orders[Number(m[1])] ?? []) : [] });
    })
  );
}

beforeEach(() => {
  stubStream();
  tables = [table(1), table(2), table(3)];
  orders = {};
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe('the table list (BR4.1)', () => {
  it('reads the orders of exactly the tables the server lists, not a fixed 10', async () => {
    wireOrders();
    const { result } = renderHook(() => useBoardOrders());
    await waitFor(() => expect(result.current.loading).toBe(false));
    const fetchMock = globalThis.fetch as unknown as ReturnType<typeof vi.fn>;
    const read = calledWith(fetchMock, '/api/tables/').map((c) => String(c[0]));
    expect(read.sort()).toEqual(['/api/tables/1/orders?visit=current', '/api/tables/2/orders?visit=current', '/api/tables/3/orders?visit=current']);
    expect(result.current.tables.map((t) => t.id)).toEqual([1, 2, 3]);
  });

  it('follows a larger restaurant: 14 tables are all read', async () => {
    tables = Array.from({ length: 14 }, (_, i) => table(i + 1));
    orders = { 14: [order(77, 14)] };
    wireOrders();
    const { result } = renderHook(() => useBoardOrders());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.ordersByTable.get(14)![0].order_number).toBe(77);
  });

  it('with no table list and nothing known, it says so (error) instead of showing an empty board as if it were fine', async () => {
    routeFetch({ '/api/staff/tables': () => failed(500) });
    const { result } = renderHook(() => useBoardOrders());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe(true);
    expect(result.current.tables).toEqual([]);
  });

  it('reload reads it again and clears the error', async () => {
    let fail = true;
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => (String(input).startsWith('/api/staff/tables') ? (fail ? failed(500) : ok({ tables })) : ok({ orders: [] }))));
    const { result } = renderHook(() => useBoardOrders());
    await waitFor(() => expect(result.current.error).toBe(true));
    fail = false;
    act(() => result.current.reload());
    await waitFor(() => expect(result.current.error).toBe(false));
    expect(result.current.tables).toHaveLength(3);
  });

  it('keeps the last table list when a later read of it fails (a reconnect with the server briefly down)', async () => {
    let fail = false;
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.startsWith('/api/staff/tables')) return fail ? failed(500) : ok({ tables });
      const m = /\/api\/tables\/(\d+)\/orders/.exec(url);
      return ok({ orders: m ? (orders[Number(m[1])] ?? []) : [] });
    }));
    orders = { 2: [order(5, 2)] };
    const { result } = renderHook(() => useBoardOrders());
    await waitFor(() => expect(result.current.ordersByTable.has(2)).toBe(true));
    fail = true;
    act(() => MockEventSource.last.open());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.tables).toHaveLength(3);
    expect(result.current.ordersByTable.has(2)).toBe(true);
    expect(result.current.error).toBe(false);
  });
});

describe('lines with options, and completed_at (BR2.2, BR2.3)', () => {
  it('keeps each line\'s options from the read and from ORDER_PLACED', async () => {
    orders = { 1: [order(1, 1)] };
    wireOrders();
    const { result } = renderHook(() => useBoardOrders());
    await waitFor(() => expect(result.current.ordersByTable.get(1)?.[0].lines[0].options).toEqual(line.options));
    act(() => MockEventSource.last.emit('ORDER_PLACED', { order_number: 2, table_id: 2, status: 'Pending', placed_at: '2026-11-08T12:05:00Z', visit_id: 'v2', lines: [line] }));
    await waitFor(() => expect(result.current.ordersByTable.get(2)?.[0].lines[0].options).toEqual(line.options));
  });

  it('ORDER_STATUS_CHANGED to Completed stores completed_at, so the ticket can show the time it took', async () => {
    orders = { 1: [order(1, 1, { status: 'Preparing' })] };
    wireOrders();
    const { result } = renderHook(() => useBoardOrders());
    await waitFor(() => expect(result.current.ordersByTable.has(1)).toBe(true));
    act(() => MockEventSource.last.emit('ORDER_STATUS_CHANGED', { order_number: 1, table_id: 1, status: 'Completed', completed_at: '2026-11-08T12:12:00Z' }));
    await waitFor(() => expect(result.current.ordersByTable.get(1)![0]).toMatchObject({ status: 'Completed', completed_at: '2026-11-08T12:12:00Z' }));
  });

  it('a status change with no completed_at keeps what the order had', async () => {
    orders = { 1: [order(1, 1, { status: 'Pending', completed_at: null })] };
    wireOrders();
    const { result } = renderHook(() => useBoardOrders());
    await waitFor(() => expect(result.current.ordersByTable.has(1)).toBe(true));
    act(() => MockEventSource.last.emit('ORDER_STATUS_CHANGED', { order_number: 1, table_id: 1, status: 'Preparing' }));
    await waitFor(() => expect(result.current.ordersByTable.get(1)![0].status).toBe('Preparing'));
    expect(result.current.ordersByTable.get(1)![0].completed_at).toBeNull();
  });
});

describe('open requests (BR3.2)', () => {
  const call = (id: string, kind: 'waiter' | 'bill' = 'waiter') => ({ id, kind, opened_at: '2026-11-08T12:00:00Z' });

  it('starts from the open requests the table list carries', async () => {
    tables = [table(1), table(2, [call('c1'), call('c2', 'bill')]), table(3)];
    wireOrders();
    const { result } = renderHook(() => useBoardOrders());
    await waitFor(() => expect(result.current.callsByTable.get(2)).toHaveLength(2));
    expect(result.current.callsByTable.has(1)).toBe(false);
  });

  it('SERVICE_CALL_OPENED adds a request, once', async () => {
    wireOrders();
    const { result } = renderHook(() => useBoardOrders());
    await waitFor(() => expect(result.current.loading).toBe(false));
    const payload = { call_id: 'c9', table_id: 3, kind: 'bill', opened_at: '2026-11-08T12:00:00Z' };
    act(() => MockEventSource.last.emit('SERVICE_CALL_OPENED', payload));
    act(() => MockEventSource.last.emit('SERVICE_CALL_OPENED', payload));
    await waitFor(() => expect(result.current.callsByTable.get(3)).toEqual([{ id: 'c9', kind: 'bill', opened_at: '2026-11-08T12:00:00Z' }]));
  });

  it('SERVICE_CALL_RESPONDED removes only that request', async () => {
    tables = [table(1, [call('a'), call('b', 'bill')])];
    wireOrders();
    const { result } = renderHook(() => useBoardOrders());
    await waitFor(() => expect(result.current.callsByTable.get(1)).toHaveLength(2));
    act(() => MockEventSource.last.emit('SERVICE_CALL_RESPONDED', { call_id: 'a', table_id: 1, kind: 'waiter', responded_at: 'x' }));
    await waitFor(() => expect(result.current.callsByTable.get(1)!.map((c) => c.id)).toEqual(['b']));
    act(() => MockEventSource.last.emit('SERVICE_CALL_RESPONDED', { call_id: 'b', table_id: 1, kind: 'bill', responded_at: 'x' }));
    await waitFor(() => expect(result.current.callsByTable.has(1)).toBe(false));
  });

  it('TABLE_CLOSED clears the table\'s requests', async () => {
    tables = [table(1, [call('a')])];
    wireOrders();
    const { result } = renderHook(() => useBoardOrders());
    await waitFor(() => expect(result.current.callsByTable.has(1)).toBe(true));
    act(() => MockEventSource.last.emit('TABLE_CLOSED', { table_id: 1, archived_visit_id: 'v' }));
    await waitFor(() => expect(result.current.callsByTable.has(1)).toBe(false));
  });

  it('a response that arrives while the table list is still being read is not undone when the older list lands', async () => {
    tables = [table(1, [call('a')])];
    let release: () => void = () => {};
    let held = false;
    vi.stubGlobal('fetch', vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.startsWith('/api/staff/tables')) {
        const answer = ok({ tables: JSON.parse(JSON.stringify(tables)) });
        if (!held) return Promise.resolve(answer);
        return new Promise((resolve) => (release = () => resolve(answer)));
      }
      return Promise.resolve(ok({ orders: [] }));
    }));
    const { result } = renderHook(() => useBoardOrders());
    await waitFor(() => expect(result.current.callsByTable.has(1)).toBe(true));
    held = true;
    act(() => MockEventSource.last.open()); // a (re)connect: the list is read again and the answer is held
    await new Promise((r) => setTimeout(r, 10));
    act(() => MockEventSource.last.emit('SERVICE_CALL_RESPONDED', { call_id: 'a', table_id: 1, kind: 'waiter', responded_at: 'x' }));
    await waitFor(() => expect(result.current.callsByTable.has(1)).toBe(false));
    act(() => release()); // the older list, which still shows the request, arrives now
    await new Promise((r) => setTimeout(r, 30));
    expect(result.current.callsByTable.has(1)).toBe(false);
  });

  it('a request opened while the table list is on its way is kept when the older list lands', async () => {
    let release: () => void = () => {};
    let held = false;
    vi.stubGlobal('fetch', vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.startsWith('/api/staff/tables')) {
        const answer = ok({ tables: [table(4)] });
        if (!held) return Promise.resolve(answer);
        return new Promise((resolve) => (release = () => resolve(answer)));
      }
      return Promise.resolve(ok({ orders: [] }));
    }));
    const { result } = renderHook(() => useBoardOrders());
    await waitFor(() => expect(result.current.loading).toBe(false));
    held = true;
    act(() => MockEventSource.last.open());
    await new Promise((r) => setTimeout(r, 10));
    act(() => MockEventSource.last.emit('SERVICE_CALL_OPENED', { call_id: 'n', table_id: 4, kind: 'waiter', opened_at: '2026-11-08T12:00:00Z' }));
    await waitFor(() => expect(result.current.callsByTable.get(4)).toHaveLength(1));
    act(() => release());
    await new Promise((r) => setTimeout(r, 30));
    expect(result.current.callsByTable.get(4)).toHaveLength(1);
  });
});

describe('the events are handed on for the new-order banner', () => {
  it('returns every event of the stream, in order, each with a seq', async () => {
    wireOrders();
    const { result } = renderHook(() => useBoardOrders());
    await waitFor(() => expect(result.current.loading).toBe(false));
    act(() => MockEventSource.last.emit('MENU_CHANGED', { reason: 'item', ids: [] }));
    act(() => MockEventSource.last.emit('STATION_DONE', { order_number: 1, table_id: 1, station: 'Grill', remaining: [] }));
    await waitFor(() => expect(result.current.events.map((e) => e.type)).toEqual(['MENU_CHANGED', 'STATION_DONE']));
    expect(result.current.events.map((e) => e.seq)).toEqual([1, 2]);
  });
});
