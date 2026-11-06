// @vitest-environment jsdom
/// <reference types="vitest/globals" />
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useMenuAvailability } from '../useMenuAvailability';

// --- MockEventSource ---
class MockEventSource {
  static instance: MockEventSource | null = null;
  url: string;
  listeners: Record<string, Array<(e: MessageEvent) => void>> = {};
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

const seedItems = [
  { id: 'i-01', category_id: 'cat-1', name: 'Burger', description: 'A burger', image: '', price_cents: 1000, available: true },
  { id: 'i-02', category_id: 'cat-1', name: 'Fries', description: 'Fries', image: '', price_cents: 500, available: true },
];

const seedCategories = [{ id: 'cat-1', name: 'Mains', order: 1 }];

function setupFetchMock(opts: { fail?: boolean; available?: boolean } = {}) {
  vi.stubGlobal('fetch', vi.fn((url: string, init?: RequestInit) => {
    // POST to /api/menu/items/:id/availability
    if (init?.method === 'POST' && url.includes('/api/menu/items/')) {
      if (opts.fail) {
        return Promise.resolve({
          ok: false,
          json: () => Promise.resolve({ error: { message: 'Server error' } }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ id: 'i-01', available: opts.available ?? true }),
      });
    }
    // GET /api/menu
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve({ categories: seedCategories, items: seedItems }),
    });
  }));
}

beforeEach(() => {
  MockEventSource.instance = null;
  vi.stubGlobal('EventSource', MockEventSource);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('useMenuAvailability', () => {
  it('loads items from API on mount', async () => {
    setupFetchMock();
    const { result } = renderHook(() => useMenuAvailability());
    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.items).toHaveLength(2);
    expect(result.current.items[0].name).toBe('Burger');
  });

  it('toggleAvailability sends POST and updates local state optimistically', async () => {
    setupFetchMock({ available: false });
    const { result } = renderHook(() => useMenuAvailability());
    await waitFor(() => expect(result.current.loading).toBe(false));
    // Toggle i-01 to unavailable
    act(() => {
      result.current.toggleAvailability('i-01', false);
    });
    // Optimistic update fires immediately
    expect(result.current.items.find((i) => i.id === 'i-01')?.available).toBe(false);
  });

  it('rolls back on POST error', async () => {
    setupFetchMock({ fail: true });
    const { result } = renderHook(() => useMenuAvailability());
    await waitFor(() => expect(result.current.loading).toBe(false));
    // Confirm initial state
    expect(result.current.items.find((i) => i.id === 'i-01')?.available).toBe(true);
    await act(async () => {
      await result.current.toggleAvailability('i-01', false);
    });
    // Should roll back to true
    expect(result.current.items.find((i) => i.id === 'i-01')?.available).toBe(true);
    // Should set an error
    expect(result.current.error).toBeTruthy();
  });

  it('MENU_AVAILABILITY_CHANGED SSE syncs state', async () => {
    setupFetchMock();
    const { result } = renderHook(() => useMenuAvailability());
    await waitFor(() => expect(result.current.loading).toBe(false));
    const es = MockEventSource.instance!;
    act(() => {
      es.triggerMessage('MENU_AVAILABILITY_CHANGED', { menu_item_id: 'i-02', available: false });
    });
    expect(result.current.items.find((i) => i.id === 'i-02')?.available).toBe(false);
  });

  it('loading transitions from true to false after fetch completes', async () => {
    setupFetchMock();
    const { result } = renderHook(() => useMenuAvailability());
    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.loading).toBe(false));
  });
});
