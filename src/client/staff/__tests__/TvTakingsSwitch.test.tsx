// U8 Step 8: the "Show takings on TV" switch (BR8.1, BR8.2, BR9.2).
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, act, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const fetchMock = vi.hoisted(() => vi.fn());
vi.mock('../staffAuth', () => ({ staffFetch: fetchMock, notifyStaffUnauthorized: vi.fn(), onStaffUnauthorized: vi.fn() }));

import TvTakingsSwitch from '../TvTakingsSwitch';

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
  emit(type: string, data: unknown) {
    for (const h of this.listeners[type] ?? []) h(new MessageEvent(type, { data: JSON.stringify(data) }));
  }
}
const stream = () => MockEventSource.instances[0];
const reply = (status: number, body: unknown = {}) => Promise.resolve({ ok: status >= 200 && status < 300, status, json: () => Promise.resolve(body) });
const reads = () => fetchMock.mock.calls.filter((c) => c[1] === undefined);
const puts = () => fetchMock.mock.calls.filter((c) => c[1]?.method === 'PUT');
const switchEl = () => screen.getByRole('switch', { name: 'Show takings on TV' });

let serverValue = false;

beforeEach(() => {
  MockEventSource.instances = [];
  serverValue = false;
  vi.stubGlobal('EventSource', MockEventSource);
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  fetchMock.mockReset();
  fetchMock.mockImplementation((url: string, init?: RequestInit) => {
    if (init?.method === 'PUT') {
      serverValue = JSON.parse(String(init.body)).show_takings;
      return reply(200, { show_takings: serverValue, updated_at: '2026-11-10T12:00:00.000Z' });
    }
    return reply(200, { show_takings: serverValue, updated_at: null });
  });
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('TvTakingsSwitch', () => {
  it('reads the setting on mount and shows it as a switch with an On/Off word, at least 44 px tall', async () => {
    serverValue = true;
    render(<TvTakingsSwitch />);
    expect(reads()[0][0]).toBe('/api/staff/tv/settings');
    await waitFor(() => expect(switchEl()).toHaveAttribute('aria-checked', 'true'));
    expect(screen.getByTestId('tv-takings-switch-state')).toHaveTextContent('On');
    expect(screen.getByText('Show takings on TV')).toBeInTheDocument();
    expect(switchEl().className).toContain('tv-switch'); // the 44 px touch area comes from .tv-switch (min-height: var(--touch))
  });

  it('reads again on every reconnect of the staff stream (BR8.1)', async () => {
    render(<TvTakingsSwitch />);
    await waitFor(() => expect(reads()).toHaveLength(1));
    act(() => stream().onopen?.());
    await waitFor(() => expect(reads()).toHaveLength(2));
    serverValue = true; // changed elsewhere while this page was disconnected
    act(() => stream().onerror?.());
    act(() => stream().onopen?.());
    await waitFor(() => expect(switchEl()).toHaveAttribute('aria-checked', 'true'));
    expect(reads()).toHaveLength(3);
  });

  it('follows TV_SETTINGS_CHANGED from another staff page, even when another event arrives right after it', async () => {
    render(<TvTakingsSwitch />);
    await waitFor(() => expect(reads()).toHaveLength(1));
    act(() => {
      stream().emit('TV_SETTINGS_CHANGED', { show_takings: true, updated_at: '2026-11-10T12:00:00.000Z' });
      stream().emit('ORDER_PLACED', { order_number: 3 });
    });
    expect(switchEl()).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByTestId('tv-takings-switch-state')).toHaveTextContent('On');
  });

  it('flips by keyboard (Space and Enter) and saves each new value', async () => {
    const user = userEvent.setup();
    render(<TvTakingsSwitch />);
    await waitFor(() => expect(reads()).toHaveLength(1));
    switchEl().focus();
    await user.keyboard(' ');
    await waitFor(() => expect(switchEl()).toHaveAttribute('aria-checked', 'true'));
    await user.keyboard('{Enter}');
    await waitFor(() => expect(switchEl()).toHaveAttribute('aria-checked', 'false'));
    expect(puts().map((c) => JSON.parse(String(c[1].body)))).toEqual([{ show_takings: true }, { show_takings: false }]);
    expect(puts()[0][0]).toBe('/api/staff/tv/settings');
  });

  it('shows the new position at once, and returns to the old one with the "server did not answer" message when the save fails (BR8.2)', async () => {
    const user = userEvent.setup();
    let failSave: (v: unknown) => void = () => undefined;
    render(<TvTakingsSwitch />);
    await waitFor(() => expect(reads()).toHaveLength(1));
    fetchMock.mockImplementation((_url: string, init?: RequestInit) =>
      init?.method === 'PUT' ? new Promise((resolve) => (failSave = resolve)) : reply(200, { show_takings: false, updated_at: null })
    );
    await user.click(switchEl());
    expect(switchEl()).toHaveAttribute('aria-checked', 'true'); // at once, before the answer
    await act(async () => failSave({ ok: false, status: 500, json: () => Promise.resolve({}) }));
    await waitFor(() => expect(switchEl()).toHaveAttribute('aria-checked', 'false'));
    expect(screen.getByTestId('tv-takings-switch-error')).toHaveTextContent('The server did not answer.');

    // Try again sends the same change; this time it is saved and the message goes away
    fetchMock.mockImplementation((_url: string, init?: RequestInit) => reply(200, { show_takings: init?.method === 'PUT', updated_at: '2026-11-10T12:01:00.000Z' }));
    await user.click(screen.getByTestId('tv-takings-switch-retry'));
    await waitFor(() => expect(switchEl()).toHaveAttribute('aria-checked', 'true'));
    expect(screen.queryByTestId('tv-takings-switch-error')).toBeNull();
  });

  it('a save with no answer in 10 seconds also returns the switch to its old position', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      render(<TvTakingsSwitch />);
      await waitFor(() => expect(reads()).toHaveLength(1));
      fetchMock.mockImplementation((_url: string, init?: RequestInit) => (init?.method === 'PUT' ? new Promise(() => {}) : reply(200, { show_takings: false, updated_at: null })));
      act(() => switchEl().click());
      expect(switchEl()).toHaveAttribute('aria-checked', 'true');
      await act(async () => {
        vi.advanceTimersByTime(10_000);
      });
      await waitFor(() => expect(switchEl()).toHaveAttribute('aria-checked', 'false'));
      expect(screen.getByTestId('tv-takings-switch-error')).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });
});
