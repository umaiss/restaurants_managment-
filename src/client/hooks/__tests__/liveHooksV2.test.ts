/**
 * @vitest-environment jsdom
 */
// U5 Step 14: the live-event hooks as extended by U5: every event name registered once, the diner page's
// page id and heartbeat, and the staff stream's way back to the PIN screen (BR8.1, BR9.2, BR1.7).
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTableSSE } from '../useTableSSE.js';
import { useStaffSSE } from '../useStaffSSE.js';
import { EVENT_NAMES, STAFF_EVENT_NAMES, HEARTBEAT_INTERVAL_MS, makePageId } from '../eventNames.js';
import { onStaffUnauthorized } from '../../staff/staffAuth.js';

class MockEventSource {
  static instances: MockEventSource[] = [];
  url: string;
  readyState = 0;
  listeners: Record<string, Array<(e: Event) => void>> = {};
  onopen: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onmessage: ((e: MessageEvent) => void) | null = null;
  closed = false;
  constructor(url: string) {
    this.url = url;
    MockEventSource.instances.push(this);
  }
  addEventListener(type: string, handler: (e: Event) => void) {
    (this.listeners[type] ??= []).push(handler);
  }
  close() {
    this.closed = true;
  }
}

const PAGE_PATTERN = /^[A-Za-z0-9-]{8,64}$/;
let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  MockEventSource.instances = [];
  vi.useFakeTimers();
  vi.stubGlobal('EventSource', MockEventSource);
  fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 204 });
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const heartbeats = () => fetchMock.mock.calls.filter((c) => String(c[0]).endsWith('/presence'));

describe('event names (BR9.2)', () => {
  it('lists every name of contract 4, once', () => {
    expect([...EVENT_NAMES].sort()).toEqual(
      [
        'MENU_AVAILABILITY_CHANGED',
        'MENU_CHANGED',
        'ORDER_PLACED',
        'ORDER_STATUS_CHANGED',
        'SERVICE_CALL_OPENED',
        'SERVICE_CALL_RESPONDED',
        'SPECIAL_CHANGED',
        'STATION_DONE',
        'TABLE_CLOSED',
        'TABLE_PRESENCE_CHANGED',
      ].sort()
    );
    expect(new Set(EVENT_NAMES).size).toBe(EVENT_NAMES.length);
  });

  it('the staff list is the same names plus v1\'s TABLE_STATUS_CHANGED', () => {
    expect(STAFF_EVENT_NAMES).toEqual([...EVENT_NAMES, 'TABLE_STATUS_CHANGED']);
  });

  it('a page id is of the form the server accepts, and differs between calls', () => {
    const ids = Array.from({ length: 20 }, makePageId);
    for (const id of ids) expect(id).toMatch(PAGE_PATTERN);
    expect(new Set(ids).size).toBe(20);
  });

  it('a page id still has the allowed form where crypto.randomUUID is missing', () => {
    vi.stubGlobal('crypto', {});
    expect(makePageId()).toMatch(PAGE_PATTERN);
  });
});

describe('useTableSSE: every event is listened for', () => {
  it('registers a listener for each name of contract 4', () => {
    renderHook(() => useTableSSE('5'));
    const es = MockEventSource.instances[0];
    for (const name of EVENT_NAMES) expect(es.listeners[name], name).toHaveLength(1);
  });

  it.each(['MENU_CHANGED', 'SPECIAL_CHANGED', 'SERVICE_CALL_OPENED', 'SERVICE_CALL_RESPONDED'])('a %s event reaches the screen', (type) => {
    const { result } = renderHook(() => useTableSSE('5'));
    act(() => {
      for (const h of MockEventSource.instances[0].listeners[type]) h(new MessageEvent(type, { data: JSON.stringify({ n: 1 }), lastEventId: '9' }));
    });
    expect(result.current.lastEvent).toMatchObject({ type, data: { n: 1 } });
  });

  it('a reconnect after a failure listens again for every name', () => {
    renderHook(() => useTableSSE('5'));
    act(() => MockEventSource.instances[0].onerror?.());
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(MockEventSource.instances).toHaveLength(2);
    for (const name of EVENT_NAMES) expect(MockEventSource.instances[1].listeners[name], name).toHaveLength(1);
  });
});

describe('useTableSSE: the page id and the heartbeat (BR8.1)', () => {
  it('opens the stream with a page id of the allowed form', () => {
    renderHook(() => useTableSSE('5'));
    const url = new URL(MockEventSource.instances[0].url, 'http://x');
    expect(url.pathname).toBe('/sse/tables/5');
    expect(url.searchParams.get('page')).toMatch(PAGE_PATTERN);
  });

  it('posts a heartbeat with the same page id when the stream opens', () => {
    renderHook(() => useTableSSE('5'));
    expect(heartbeats()).toHaveLength(0); // not before the stream is open
    act(() => MockEventSource.instances[0].onopen?.());
    expect(heartbeats()).toHaveLength(1);
    const [url, init] = heartbeats()[0];
    expect(url).toBe('/api/tables/5/presence');
    expect(init.method).toBe('POST');
    const pageInUrl = new URL(MockEventSource.instances[0].url, 'http://x').searchParams.get('page');
    expect(JSON.parse(init.body)).toEqual({ page_id: pageInUrl });
  });

  it('sends another about every 60 seconds while the stream stays open', () => {
    renderHook(() => useTableSSE('5'));
    act(() => MockEventSource.instances[0].onopen?.());
    expect(heartbeats()).toHaveLength(1);
    act(() => {
      vi.advanceTimersByTime(HEARTBEAT_INTERVAL_MS - 1);
    });
    expect(heartbeats()).toHaveLength(1);
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(heartbeats()).toHaveLength(2);
    act(() => {
      vi.advanceTimersByTime(HEARTBEAT_INTERVAL_MS * 3);
    });
    expect(heartbeats()).toHaveLength(5);
  });

  it('stops while the stream is down and starts again, with the same page id, when it reconnects', () => {
    renderHook(() => useTableSSE('5'));
    act(() => MockEventSource.instances[0].onopen?.());
    act(() => MockEventSource.instances[0].onerror?.());
    act(() => {
      vi.advanceTimersByTime(HEARTBEAT_INTERVAL_MS * 2 - 1000); // down for two minutes: no heartbeats
    });
    expect(heartbeats()).toHaveLength(1);

    act(() => {
      vi.advanceTimersByTime(1000); // the reconnect timer (1 s) fired long ago; this is the second stream
    });
    act(() => MockEventSource.instances[1].onopen?.());
    expect(heartbeats()).toHaveLength(2);
    const idOf = (es: MockEventSource) => new URL(es.url, 'http://x').searchParams.get('page');
    expect(idOf(MockEventSource.instances[1])).toBe(idOf(MockEventSource.instances[0]));
    expect(JSON.parse(heartbeats()[1][1].body).page_id).toBe(idOf(MockEventSource.instances[0]));
  });

  it('stops for good when the page closes', () => {
    const { unmount } = renderHook(() => useTableSSE('5'));
    act(() => MockEventSource.instances[0].onopen?.());
    unmount();
    act(() => {
      vi.advanceTimersByTime(HEARTBEAT_INTERVAL_MS * 5);
    });
    expect(heartbeats()).toHaveLength(1);
    expect(MockEventSource.instances[0].closed).toBe(true);
  });

  it('a heartbeat that fails does not break the page: no error, and the next one is still sent', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));
    const { result } = renderHook(() => useTableSSE('5'));
    act(() => MockEventSource.instances[0].onopen?.());
    await act(async () => {
      vi.advanceTimersByTime(HEARTBEAT_INTERVAL_MS);
    });
    expect(heartbeats()).toHaveLength(2);
    expect(result.current.connected).toBe(true);
  });

  it('a page without fetch (very old browser) simply sends none', () => {
    vi.stubGlobal('fetch', undefined);
    renderHook(() => useTableSSE('5'));
    expect(() => act(() => MockEventSource.instances[0].onopen?.())).not.toThrow();
  });

  it('two pages open at once have different page ids', () => {
    renderHook(() => useTableSSE('5'));
    renderHook(() => useTableSSE('5'));
    const ids = MockEventSource.instances.map((es) => new URL(es.url, 'http://x').searchParams.get('page'));
    expect(ids[0]).not.toBe(ids[1]);
  });

  it('keeps the Last-Event-ID query value alongside the page id after a reconnect', () => {
    renderHook(() => useTableSSE('5'));
    act(() => {
      for (const h of MockEventSource.instances[0].listeners.ORDER_PLACED) h(new MessageEvent('ORDER_PLACED', { data: '{}', lastEventId: '42' }));
    });
    act(() => MockEventSource.instances[0].onerror?.());
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    const url = new URL(MockEventSource.instances[1].url, 'http://x');
    expect(url.searchParams.get('lastEventId')).toBe('42');
    expect(url.searchParams.get('page')).toMatch(PAGE_PATTERN);
  });
});

describe('useStaffSSE: every event, and the way back to the PIN screen (BR9.2, BR1.7)', () => {
  it('registers a listener for each name, v1\'s included', () => {
    renderHook(() => useStaffSSE());
    const es = MockEventSource.instances[0];
    for (const name of STAFF_EVENT_NAMES) expect(es.listeners[name], name).toHaveLength(1);
    expect(es.url).toBe('/sse/staff');
  });

  it('a stream the browser closed (a refusal) asks the session check, and a 401 sends the screen to the PIN screen', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 401 });
    const refused = vi.fn();
    const stop = onStaffUnauthorized(refused);
    renderHook(() => useStaffSSE());
    MockEventSource.instances[0].readyState = 2;
    await act(async () => {
      MockEventSource.instances[0].onerror?.();
    });
    expect(fetchMock).toHaveBeenCalledWith('/api/staff/session');
    expect(refused).toHaveBeenCalledTimes(1);
    stop();
  });

  it('a closed stream whose session is still valid does nothing more', async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 200 });
    const refused = vi.fn();
    const stop = onStaffUnauthorized(refused);
    renderHook(() => useStaffSSE());
    MockEventSource.instances[0].readyState = 2;
    await act(async () => {
      MockEventSource.instances[0].onerror?.();
    });
    expect(refused).not.toHaveBeenCalled();
    stop();
  });

  it('a dropped connection that the browser retries by itself makes no session check', async () => {
    const refused = vi.fn();
    const stop = onStaffUnauthorized(refused);
    const { result } = renderHook(() => useStaffSSE());
    act(() => MockEventSource.instances[0].onopen?.());
    MockEventSource.instances[0].readyState = 0; // CONNECTING again
    await act(async () => {
      MockEventSource.instances[0].onerror?.();
    });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(refused).not.toHaveBeenCalled();
    expect(result.current.connected).toBe(false);
    stop();
  });

  it('a session check that cannot reach the server does not throw or sign anyone out', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));
    const refused = vi.fn();
    const stop = onStaffUnauthorized(refused);
    renderHook(() => useStaffSSE());
    MockEventSource.instances[0].readyState = 2;
    await act(async () => {
      MockEventSource.instances[0].onerror?.();
    });
    expect(refused).not.toHaveBeenCalled();
    stop();
  });
});
