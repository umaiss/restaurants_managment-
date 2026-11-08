// @vitest-environment jsdom
/// <reference types="vitest/globals" />
// Integration fix 5: a staff page opens at most ONE live stream (/sse/staff), however many reads it makes.
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, cleanup, renderHook, waitFor, act } from '@testing-library/react';
import { useStaffSSE } from '../../hooks/useStaffSSE';
import SalesPage from '../pages/sales/index';
import FloorPage from '../pages/floor/index';
import MenuManagementPage from '../pages/menu/index';
import SpecialPage from '../pages/special/index';
import { MockEventSource, failed, ok, stubStream } from './u7Mocks';

const streams = () => MockEventSource.instances.filter((s) => s.url === '/sse/staff');

beforeEach(() => {
  stubStream();
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.startsWith('/api/staff/sales')) return ok({ days: [] });
      if (url.startsWith('/api/staff/ratings')) return ok({ day: '2026-11-08', best: [], worst: [], tie_rule: '' });
      if (url.startsWith('/api/staff/tables')) return ok({ tables: [] });
      if (url.startsWith('/api/staff/menu')) return ok({ categories: [], items: [] });
      if (url.startsWith('/api/specials/current')) return ok({ special: null });
      if (url.startsWith('/api/menu')) return ok({ categories: [], items: [] });
      return failed(404);
    })
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('regression: the staff pages share one live stream', () => {
  it('two callers of useStaffSSE share one EventSource, both hear every event, and it closes with the last one', () => {
    const a = renderHook(() => useStaffSSE());
    const b = renderHook(() => useStaffSSE());
    expect(streams()).toHaveLength(1);
    act(() => MockEventSource.last.open());
    expect(a.result.current.connected).toBe(true);
    expect(b.result.current.connected).toBe(true);
    act(() => MockEventSource.last.emit('MENU_CHANGED', { reason: 'item', ids: [] }));
    expect(a.result.current.events.map((e) => e.type)).toEqual(['MENU_CHANGED']);
    expect(b.result.current.events.map((e) => e.type)).toEqual(['MENU_CHANGED']);
    a.unmount();
    expect(streams()[0].closed).toBe(false);
    b.unmount();
    expect(streams()[0].closed).toBe(true);
  });

  it('a caller that starts later is told the stream is already open, and sees only events from then on', () => {
    const a = renderHook(() => useStaffSSE());
    act(() => MockEventSource.last.open());
    act(() => MockEventSource.last.emit('TABLE_CLOSED', { table_id: 1 }));
    const b = renderHook(() => useStaffSSE());
    expect(streams()).toHaveLength(1);
    expect(b.result.current.connected).toBe(true);
    expect(b.result.current.events).toEqual([]);
    expect(a.result.current.events).toHaveLength(1);
  });

  it('the Sales page, which reads two routes, opens one EventSource', async () => {
    const fetchMock = globalThis.fetch as unknown as ReturnType<typeof vi.fn>;
    render(<SalesPage />);
    await waitFor(() => expect(fetchMock.mock.calls.length).toBeGreaterThanOrEqual(2));
    expect(streams()).toHaveLength(1);
    // and one event still reloads both reads
    const before = fetchMock.mock.calls.length;
    act(() => MockEventSource.last.emit('TABLE_CLOSED', { table_id: 5 }));
    await waitFor(() => expect(fetchMock.mock.calls.length).toBe(before + 2));
    expect(streams()).toHaveLength(1);
  });

  it.each([
    ['Floor map', () => <FloorPage />],
    ['Menu management', () => <MenuManagementPage />],
    ["Chef's special", () => <SpecialPage />],
  ])('the %s page opens at most one EventSource', async (_name, page) => {
    render(<MemoryRouter>{page()}</MemoryRouter>);
    await act(async () => {});
    expect(streams().length).toBeLessThanOrEqual(1);
  });
});
