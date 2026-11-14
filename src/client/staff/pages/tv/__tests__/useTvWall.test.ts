/**
 * @vitest-environment jsdom
 */
// U8 Step 8: the TV wall data hook (C4; BR7.1 to BR7.7, plan R-02 to R-05).
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, cleanup } from '@testing-library/react';
import type { TvSummary } from '../../../../../shared/tvWall';

const fetchMock = vi.hoisted(() => vi.fn());
vi.mock('../../../staffAuth', () => ({ staffFetch: fetchMock, notifyStaffUnauthorized: vi.fn(), onStaffUnauthorized: vi.fn() }));

import { useTvWall, TV_READ_TIMEOUT_MS, TV_REFRESH_MS, TV_RETRY_MS, TV_TICK_MS } from '../useTvWall';

class MockEventSource {
  static instances: MockEventSource[] = [];
  readyState = 0;
  listeners: Record<string, Array<(e: MessageEvent) => void>> = {};
  onopen: (() => void) | null = null;
  onerror: (() => void) | null = null;
  constructor(public url: string) {
    MockEventSource.instances.push(this);
  }
  addEventListener(type: string, handler: (e: MessageEvent) => void) {
    (this.listeners[type] ??= []).push(handler);
  }
  close() {}
  emit(type: string, data: unknown = {}) {
    for (const h of this.listeners[type] ?? []) h(new MessageEvent(type, { data: JSON.stringify(data) }));
  }
}
const stream = () => MockEventSource.instances[0];

/** Each read waits until the test answers it. */
interface Pending {
  resolve: (body: TvSummary) => void;
  reject: (err: Error) => void;
}
let pending: Pending[] = [];

function summary(overrides: Partial<TvSummary> = {}): TvSummary {
  return {
    server_time: '2026-11-10T12:00:00.000Z',
    day: '2026-11-10',
    day_ends_at: '2026-11-11T00:00:00.000Z',
    show_takings: false,
    orders: [],
    busiest_table: null,
    top_dish: null,
    requests: [],
    ...overrides,
  };
}

async function answer(index: number, body: TvSummary) {
  await act(async () => {
    pending[index].resolve(body);
  });
}
async function fail(index: number) {
  await act(async () => {
    pending[index].reject(new Error('offline'));
  });
}
async function advance(ms: number) {
  await act(async () => {
    vi.advanceTimersByTime(ms);
  });
}

beforeEach(() => {
  MockEventSource.instances = [];
  pending = [];
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-11-10T12:00:00.000Z'));
  vi.stubGlobal('EventSource', MockEventSource);
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  fetchMock.mockReset();
  fetchMock.mockImplementation(
    () =>
      new Promise((resolve, reject) => {
        pending.push({
          resolve: (body) => resolve({ ok: true, status: 200, json: () => Promise.resolve(body) }),
          reject,
        });
      })
  );
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('useTvWall (C4)', () => {
  it('reads on mount and becomes ready and live with exactly the summary', async () => {
    const { result } = renderHook(() => useTvWall());
    expect(result.current.status).toBe('loading');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe('/api/staff/tv/summary');
    const body = summary({ orders: [{ order_number: 4, table_id: 2, status: 'Pending', placed_at: '2026-11-10T11:50:00.000Z', portions: 2 }] });
    await answer(0, body);
    expect(result.current.status).toBe('ready');
    expect(result.current.connection).toBe('live');
    expect(result.current.summary).toEqual(body);
    expect(result.current.now.toISOString()).toBe(body.server_time);
    expect(result.current.lastUpdatedAt).toBeInstanceOf(Date);
  });

  it('a burst of events makes at most one read in flight and one waiting (BR7.2)', async () => {
    renderHook(() => useTvWall());
    act(() => {
      for (let i = 0; i < 6; i++) stream().emit('ORDER_PLACED', { order_number: i });
    });
    expect(fetchMock).toHaveBeenCalledTimes(1); // the mount read is still in flight
    await answer(0, summary());
    expect(fetchMock).toHaveBeenCalledTimes(2); // one waiting read for the whole burst
    await answer(1, summary());
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('a TV_SETTINGS_CHANGED hidden inside a burst still causes a read (R-03: the full event list is read)', async () => {
    renderHook(() => useTvWall());
    await answer(0, summary());
    act(() => {
      stream().emit('TV_SETTINGS_CHANGED', { show_takings: true, updated_at: '2026-11-10T12:00:00.000Z' });
      stream().emit('MENU_AVAILABILITY_CHANGED', { menu_item_id: 'i-01', available: false }); // not a trigger, and the newest
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    act(() => stream().emit('MENU_CHANGED', { reason: 'item' })); // R-05: a renamed dish updates at once
    await answer(1, summary());
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('the latest answer wins: a read that timed out and answers late is ignored (BR7.5, BR7.6)', async () => {
    const { result } = renderHook(() => useTvWall());
    await answer(0, summary({ day: '2026-11-10' }));
    act(() => stream().emit('ORDER_PLACED'));
    await advance(TV_READ_TIMEOUT_MS); // read 1 has no answer in 10 s: it has failed
    expect(result.current.connection).toBe('reconnecting');
    act(() => stream().emit('ORDER_STATUS_CHANGED'));
    expect(fetchMock).toHaveBeenCalledTimes(3);
    const newest = summary({ busiest_table: { table_id: 9, orders: 3 } });
    await answer(2, newest);
    await answer(1, summary({ busiest_table: { table_id: 1, orders: 1 } })); // the old one, late
    expect(result.current.summary).toEqual(newest);
    expect(result.current.connection).toBe('live');
  });

  it('re-reads when the server clock estimate passes midnight (BR7.4, R-02), once', async () => {
    renderHook(() => useTvWall());
    await answer(0, summary({ server_time: '2026-11-10T23:59:50.000Z', day_ends_at: '2026-11-11T00:00:00.000Z' }));
    await advance(TV_TICK_MS);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    await advance(TV_TICK_MS);
    expect(fetchMock).toHaveBeenCalledTimes(2); // asked once while that read is out
  });

  it('re-reads 5 minutes after the last read started, with no events (BR7.3, R-04), and waits recount every 15 s', async () => {
    const { result } = renderHook(() => useTvWall());
    await answer(0, summary());
    await advance(TV_TICK_MS);
    expect(result.current.now.toISOString()).toBe('2026-11-10T12:00:15.000Z'); // BR7.7
    await advance(TV_REFRESH_MS - 2 * TV_TICK_MS);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await advance(TV_TICK_MS);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('a dropped stream shows Reconnecting with the last summary, and a read after the reconnect makes it Live (BR7.6)', async () => {
    const { result } = renderHook(() => useTvWall());
    act(() => stream().onopen?.());
    await answer(0, summary());
    await answer(1, summary()); // the read the first connect asked for
    act(() => stream().onerror?.());
    expect(result.current.connection).toBe('reconnecting');
    expect(result.current.summary).not.toBeNull();
    act(() => stream().onopen?.());
    expect(fetchMock).toHaveBeenCalledTimes(3); // every reconnect asks for a read
    await answer(2, summary());
    expect(result.current.connection).toBe('live');
  });

  it('with no summary yet a failed read shows Error and retries every 10 s until it succeeds (BR7.6)', async () => {
    const { result } = renderHook(() => useTvWall());
    await fail(0);
    expect(result.current.status).toBe('error');
    await advance(TV_RETRY_MS - 1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await advance(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    await answer(1, summary());
    expect(result.current.status).toBe('ready');
    expect(result.current.connection).toBe('live');
  });
});
