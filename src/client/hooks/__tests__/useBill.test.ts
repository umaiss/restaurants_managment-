// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi, type Mock } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useBill, type Bill } from '../useBill';

class MockEventSource {
  static instance: MockEventSource | null = null;
  listeners: Record<string, ((e: MessageEvent) => void)[]> = {};
  constructor(public url: string) {
    MockEventSource.instance = this;
  }
  addEventListener(type: string, handler: (e: MessageEvent) => void) {
    (this.listeners[type] ??= []).push(handler);
  }
  onopen: (() => void) | null = null;
  onerror: (() => void) | null = null;
  close() {}
  open() {
    this.onopen?.();
  }
  drop() {
    this.onerror?.();
  }
  triggerMessage(type: string, data: unknown) {
    for (const h of this.listeners[type] ?? []) h({ data: JSON.stringify(data) } as MessageEvent);
  }
}

const bill: Bill = {
  table_id: 5,
  orders: [
    {
      order_number: 15,
      status: 'Completed',
      placed_at: '2026-11-05T19:04:00Z',
      lines: [{ menu_item_id: 'i-04', name: 'Classic Burger', quantity: 1, price_cents_each: 1450, subtotal_cents: 1450 }],
      subtotal_cents: 1450,
    },
  ],
  combined_total_cents: 1450,
  close_available: true,
  blocking_orders: [],
};

function okResponse(body: unknown) {
  return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body) });
}

let fetchMock: Mock<any[], any>;

beforeEach(() => {
  MockEventSource.instance = null;
  vi.stubGlobal('EventSource', MockEventSource);
  fetchMock = vi.fn(() => okResponse(bill));
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe('useBill', () => {
  it('loads the bill on mount: loading is true, then false', async () => {
    const { result } = renderHook(() => useBill(5));
    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.bill).toEqual(bill);
    expect(result.current.error).toBe(false);
    expect(fetchMock).toHaveBeenCalledWith('/api/tables/5/bill');
  });

  it('a status change for this table fetches the bill again', async () => {
    const { result } = renderHook(() => useBill(5));
    await waitFor(() => expect(result.current.loading).toBe(false));
    act(() => MockEventSource.instance!.triggerMessage('ORDER_STATUS_CHANGED', { order_number: 15, table_id: 5, status: 'Completed' }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
  });

  it('an order placed at this table fetches the bill again', async () => {
    const { result } = renderHook(() => useBill(5));
    await waitFor(() => expect(result.current.loading).toBe(false));
    act(() => MockEventSource.instance!.triggerMessage('ORDER_PLACED', { order_number: 16, table_id: 5 }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
  });

  it('events of another table do not fetch again', async () => {
    const { result } = renderHook(() => useBill(5));
    await waitFor(() => expect(result.current.loading).toBe(false));
    act(() => MockEventSource.instance!.triggerMessage('ORDER_STATUS_CHANGED', { order_number: 9, table_id: 6, status: 'Preparing' }));
    act(() => MockEventSource.instance!.triggerMessage('TABLE_CLOSED', { table_id: 6, archived_visit_id: 'v' }));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result.current.closed).toBe(false);
  });

  it('TABLE_CLOSED for this table sets closed', async () => {
    const { result } = renderHook(() => useBill(5));
    await waitFor(() => expect(result.current.loading).toBe(false));
    act(() => MockEventSource.instance!.triggerMessage('TABLE_CLOSED', { table_id: 5, archived_visit_id: 'v' }));
    await waitFor(() => expect(result.current.closed).toBe(true));
  });

  it('a failed fetch sets error and keeps the last good bill; reload retries', async () => {
    const { result } = renderHook(() => useBill(5));
    await waitFor(() => expect(result.current.bill).toEqual(bill));

    fetchMock.mockImplementationOnce(() => Promise.resolve({ ok: false, status: 500, json: () => Promise.resolve({}) }));
    act(() => result.current.reload());
    await waitFor(() => expect(result.current.error).toBe(true));
    expect(result.current.bill).toEqual(bill);

    act(() => result.current.reload());
    await waitFor(() => expect(result.current.error).toBe(false));
  });

  it('fetches the bill again when the event stream connects, and again after each reconnect, but never in a loop', async () => {
    const { result } = renderHook(() => useBill(5));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // The stream opens after the first load: catch up on anything missed in the gap.
    act(() => MockEventSource.instance!.open());
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));

    // Dropping the connection alone fetches nothing.
    act(() => MockEventSource.instance!.drop());
    expect(fetchMock).toHaveBeenCalledTimes(2);

    // Reconnecting fetches once more.
    act(() => MockEventSource.instance!.open());
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));

    // Staying connected causes no further fetches.
    await new Promise((r) => setTimeout(r, 50));
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('a network failure on the first load sets error with no bill', async () => {
    fetchMock.mockImplementation(() => Promise.reject(new Error('offline')));
    const { result } = renderHook(() => useBill(5));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe(true);
    expect(result.current.bill).toBeNull();
  });
});
