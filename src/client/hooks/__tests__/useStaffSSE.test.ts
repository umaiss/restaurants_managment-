// @vitest-environment jsdom
/// <reference types="vitest/globals" />
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useStaffSSE } from '../useStaffSSE';

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

  triggerOpen() {
    this.onopen?.();
  }

  triggerError() {
    this.onerror?.();
  }

  triggerMessage(type: string, data: unknown) {
    const event = { data: JSON.stringify(data) } as MessageEvent;
    for (const handler of this.listeners[type] ?? []) {
      handler(event);
    }
  }
}

beforeEach(() => {
  MockEventSource.instance = null;
  vi.stubGlobal('EventSource', MockEventSource);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('useStaffSSE', () => {
  it('connects once — creates a single EventSource to /sse/staff', () => {
    renderHook(() => useStaffSSE());
    expect(MockEventSource.instance).not.toBeNull();
    expect(MockEventSource.instance!.url).toBe('/sse/staff');
  });

  it('distributes events — lastEvent is updated when an SSE event fires', () => {
    const { result } = renderHook(() => useStaffSSE());
    expect(result.current.lastEvent).toBeNull();

    act(() => {
      MockEventSource.instance!.triggerMessage('ORDER_PLACED', {
        order_number: 1,
        table_id: 1,
        status: 'Pending',
      });
    });

    expect(result.current.lastEvent).not.toBeNull();
    expect(result.current.lastEvent!.type).toBe('ORDER_PLACED');
    expect((result.current.lastEvent!.data as { order_number: number }).order_number).toBe(1);
  });

  it('tracks connected state — false initially, true after onopen, false after onerror', () => {
    const { result } = renderHook(() => useStaffSSE());
    expect(result.current.connected).toBe(false);

    act(() => {
      MockEventSource.instance!.triggerOpen();
    });
    expect(result.current.connected).toBe(true);

    act(() => {
      MockEventSource.instance!.triggerError();
    });
    expect(result.current.connected).toBe(false);
  });
});
