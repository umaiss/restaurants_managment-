/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTableSSE } from '../useTableSSE.js';

// ---------------------------------------------------------------------------
// Mock EventSource
// ---------------------------------------------------------------------------

interface MockESInstance {
  url: string;
  onopen: ((ev: Event) => void) | null;
  onmessage: ((ev: MessageEvent) => void) | null;
  onerror: ((ev: Event) => void) | null;
  listeners: Record<string, Array<(ev: Event) => void>>;
  closed: boolean;
  close: () => void;
  addEventListener: (type: string, handler: (ev: Event) => void) => void;
  triggerOpen: () => void;
  triggerNamedEvent: (type: string, data: unknown, lastEventId?: string) => void;
  triggerMessage: (data: unknown, lastEventId?: string) => void;
  triggerError: () => void;
}

let instances: MockESInstance[] = [];

class MockEventSource {
  url: string;
  onopen: ((ev: Event) => void) | null = null;
  onmessage: ((ev: MessageEvent) => void) | null = null;
  onerror: ((ev: Event) => void) | null = null;
  listeners: Record<string, Array<(ev: Event) => void>> = {};
  closed = false;

  constructor(url: string) {
    this.url = url;
    instances.push(this as unknown as MockESInstance);
  }

  addEventListener(type: string, handler: (ev: Event) => void) {
    if (!this.listeners[type]) this.listeners[type] = [];
    this.listeners[type].push(handler);
  }

  close() {
    this.closed = true;
  }

  triggerOpen() {
    if (this.onopen) this.onopen(new Event('open'));
  }

  triggerNamedEvent(type: string, data: unknown, lastEventId = '') {
    const handlers = this.listeners[type] ?? [];
    // MessageEvent's lastEventId is read-only; pass it via the constructor init dict.
    const ev = new MessageEvent(type, { data: JSON.stringify(data), lastEventId });
    for (const h of handlers) h(ev);
  }

  triggerMessage(data: unknown, lastEventId = '') {
    if (this.onmessage) {
      const ev = Object.assign(
        new MessageEvent('message', { data: JSON.stringify(data) }),
        { lastEventId }
      );
      this.onmessage(ev);
    }
  }

  triggerError() {
    this.closed = true;
    if (this.onerror) this.onerror(new Event('error'));
  }
}

beforeEach(() => {
  instances = [];
  vi.useFakeTimers();
  vi.stubGlobal('EventSource', MockEventSource);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useTableSSE', () => {
  it('connects to the SSE endpoint and sets connected=true on open', () => {
    const { result } = renderHook(() => useTableSSE('5'));
    expect(instances).toHaveLength(1);
    expect(instances[0].url).toContain('/sse/tables/5');

    act(() => {
      instances[0].triggerOpen();
    });

    expect(result.current.connected).toBe(true);
    expect(result.current.lastEvent).toBeNull();
  });

  it('updates lastEvent when a named SSE event arrives', () => {
    const { result } = renderHook(() => useTableSSE('5'));
    act(() => {
      instances[0].triggerOpen();
    });

    act(() => {
      instances[0].triggerNamedEvent('ORDER_PLACED', { order_number: 1 }, '42');
    });

    expect(result.current.lastEvent).toMatchObject({
      type: 'ORDER_PLACED',
      data: { order_number: 1 },
    });
  });

  it('regression: two events that arrive together are both kept, in order', () => {
    const { result } = renderHook(() => useTableSSE('5'));
    act(() => {
      instances[0].triggerOpen();
    });

    // Both events land in one batch, as a reconnect replay delivers them
    act(() => {
      instances[0].triggerNamedEvent('ORDER_PLACED', { order_number: 1 }, '1');
      instances[0].triggerNamedEvent('ORDER_STATUS_CHANGED', { order_number: 1, status: 'Preparing' }, '2');
    });

    expect(result.current.events.map((e) => e.type)).toEqual(['ORDER_PLACED', 'ORDER_STATUS_CHANGED']);
    expect(result.current.events.map((e) => e.seq)).toEqual([1, 2]);
    // lastEvent alone would have shown only the second
    expect(result.current.lastEvent?.type).toBe('ORDER_STATUS_CHANGED');
  });

  it('closes the EventSource and clears timers on unmount', () => {
    const { unmount } = renderHook(() => useTableSSE('5'));
    act(() => {
      instances[0].triggerOpen();
    });

    unmount();

    expect(instances[0].closed).toBe(true);
  });

  it('sets connected=false and schedules reconnect with 1s backoff on error', () => {
    const { result } = renderHook(() => useTableSSE('5'));
    act(() => {
      instances[0].triggerOpen();
    });
    expect(result.current.connected).toBe(true);

    act(() => {
      instances[0].triggerError();
    });

    expect(result.current.connected).toBe(false);
    // After 1 s the hook should reconnect (creates a second EventSource)
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(instances).toHaveLength(2);
  });

  it('uses increasing backoff on successive errors', () => {
    renderHook(() => useTableSSE('5'));

    // First error → 1s delay
    act(() => { instances[0].triggerOpen(); });
    act(() => { instances[0].triggerError(); });
    act(() => { vi.advanceTimersByTime(1000); });
    expect(instances).toHaveLength(2);

    // Second error → 2s delay
    act(() => { instances[1].triggerOpen(); });
    act(() => { instances[1].triggerError(); });
    act(() => { vi.advanceTimersByTime(999); });
    expect(instances).toHaveLength(2); // not yet
    act(() => { vi.advanceTimersByTime(1); });
    expect(instances).toHaveLength(3);
  });

  it('connected toggles false when error fires', () => {
    const { result } = renderHook(() => useTableSSE('5'));
    act(() => { instances[0].triggerOpen(); });
    expect(result.current.connected).toBe(true);

    act(() => { instances[0].triggerError(); });
    expect(result.current.connected).toBe(false);
  });

  it('does not create an EventSource when tableId is undefined', () => {
    renderHook(() => useTableSSE(undefined));
    expect(instances).toHaveLength(0);
  });
});
