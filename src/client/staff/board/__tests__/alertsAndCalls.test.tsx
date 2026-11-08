// @vitest-environment jsdom
/// <reference types="vitest/globals" />
// U7 Step 11: the new-order alert and mute switch (BR3.1) and the call pulse with Respond (BR3.2).
import React from 'react';
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import NewOrderBanner, { SoundSwitch } from '../NewOrderBanner';
import CallPulse, { callLabels, respondToCalls } from '../CallPulse';
import { calledWith, failed, ok, routeFetch } from '../../__tests__/u7Mocks';
import type { StaffSSEEvent } from '../../../hooks/useStaffSSE';

const placed = (n: number, table: number, seq: number, placedAt = new Date(Date.now() + 1000).toISOString()): StaffSSEEvent => ({
  type: 'ORDER_PLACED',
  seq,
  data: { order_number: n, table_id: table, placed_at: placedAt, lines: [{ quantity: 1 }, { quantity: 1 }] },
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  window.localStorage.clear();
});

describe('the new-order banner (BR3.1)', () => {
  it('shows "New order #<n> from Table <n>" for an ORDER_PLACED event', () => {
    render(<NewOrderBanner events={[placed(14, 7, 1)]} muted={false} />);
    const banner = screen.getByTestId('new-order-alert-14');
    expect(banner).toHaveTextContent('New order #14 from Table 7');
    expect(banner).toHaveTextContent('2 items just came in.');
  });

  it('shows nothing for other events', () => {
    render(<NewOrderBanner events={[{ type: 'ORDER_STATUS_CHANGED', seq: 1, data: { order_number: 1, table_id: 1, status: 'Preparing' } }]} muted={false} />);
    expect(screen.queryByTestId('new-order-alerts')).toBeNull();
  });

  it('raises each order once, even when the event list is rendered again', () => {
    const { rerender } = render(<NewOrderBanner events={[placed(14, 7, 1)]} muted={false} />);
    rerender(<NewOrderBanner events={[placed(14, 7, 1)]} muted={false} />);
    rerender(<NewOrderBanner events={[placed(14, 7, 1), placed(14, 7, 2)]} muted={false} />);
    expect(screen.getAllByText('New order #14 from Table 7')).toHaveLength(1);
  });

  it('never raises an event from before the page loaded', () => {
    render(<NewOrderBanner events={[placed(3, 2, 1, new Date(Date.now() - 60_000).toISOString())]} muted={false} />);
    expect(screen.queryByTestId('new-order-alerts')).toBeNull();
  });

  it('a dismissed banner does not come back', () => {
    const { rerender } = render(<NewOrderBanner events={[placed(14, 7, 1)]} muted={false} />);
    fireEvent.click(screen.getByTestId('new-order-alert-14-dismiss'));
    expect(screen.queryByTestId('new-order-alert-14')).toBeNull();
    rerender(<NewOrderBanner events={[placed(14, 7, 1), placed(15, 3, 2)]} muted={false} />);
    expect(screen.queryByTestId('new-order-alert-14')).toBeNull();
    expect(screen.getByTestId('new-order-alert-15')).toBeInTheDocument();
  });

  it('keeps at most three banners on screen, the newest', () => {
    render(<NewOrderBanner events={[1, 2, 3, 4].map((n) => placed(n, n, n))} muted={false} />);
    expect(screen.queryByTestId('new-order-alert-1')).toBeNull();
    for (const n of [2, 3, 4]) expect(screen.getByTestId(`new-order-alert-${n}`)).toBeInTheDocument();
  });

  it('a sound plays after the first tap and only when not muted; the banner shows either way', () => {
    const beeps = vi.fn();
    class Ctx {
      createOscillator() {
        beeps();
        return { type: '', frequency: { value: 0 }, connect() {}, start() {}, stop() {}, onended: null };
      }
      createGain() {
        return { gain: { value: 0 }, connect() {} };
      }
      destination = {};
      currentTime = 0;
      close() {}
    }
    vi.stubGlobal('AudioContext', Ctx);
    Object.defineProperty(window, 'AudioContext', { value: Ctx, configurable: true });

    const { rerender } = render(<NewOrderBanner events={[]} muted={false} />);
    fireEvent.pointerDown(document.body); // the first tap
    rerender(<NewOrderBanner events={[placed(1, 1, 1)]} muted={false} />);
    expect(beeps).toHaveBeenCalledTimes(1);

    rerender(<NewOrderBanner events={[placed(1, 1, 1), placed(2, 2, 2)]} muted />);
    expect(screen.getByTestId('new-order-alert-2')).toBeInTheDocument();
    expect(beeps).toHaveBeenCalledTimes(1); // muted: no second sound
  });
});

describe('the Sound on / Muted switch (BR3.1)', () => {
  it('shows both words and announces the current one', () => {
    render(<SoundSwitch muted={false} setMuted={() => {}} />);
    expect(screen.getByRole('group', { name: 'Sound' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sound on' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Muted' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('calls setMuted with the choice', () => {
    const setMuted = vi.fn();
    render(<SoundSwitch muted={false} setMuted={setMuted} />);
    fireEvent.click(screen.getByRole('button', { name: 'Muted' }));
    expect(setMuted).toHaveBeenLastCalledWith(true);
    cleanup();
    render(<SoundSwitch muted setMuted={setMuted} />);
    fireEvent.click(screen.getByRole('button', { name: 'Sound on' }));
    expect(setMuted).toHaveBeenLastCalledWith(false);
  });
});

describe('the call pulse (BR3.2)', () => {
  const waiter = { id: 'c1', kind: 'waiter' as const, opened_at: '2026-11-08T12:00:00Z' };
  const bill = { id: 'c2', kind: 'bill' as const, opened_at: '2026-11-08T12:01:00Z' };

  it('shows nothing for a table with no open request', () => {
    render(<CallPulse tableId={5} calls={[]} />);
    expect(screen.queryByTestId('call-pulse-5')).toBeNull();
  });

  it('says "Calling the waiter" for a waiter request and "Asking for the bill" for a bill request', () => {
    const { rerender } = render(<CallPulse tableId={5} calls={[waiter]} />);
    expect(screen.getByTestId('call-pulse-5')).toHaveTextContent('Calling the waiter');
    expect(screen.queryByText(/Asking for the bill/)).toBeNull();
    rerender(<CallPulse tableId={5} calls={[bill]} />);
    expect(screen.getByTestId('call-pulse-5')).toHaveTextContent('Asking for the bill');
  });

  it('shows both words when both are open', () => {
    render(<CallPulse tableId={5} calls={[waiter, bill]} />);
    expect(screen.getByTestId('call-pulse-5')).toHaveTextContent('Calling the waiter');
    expect(screen.getByTestId('call-pulse-5')).toHaveTextContent('Asking for the bill');
    expect(callLabels([bill, waiter])).toEqual(['Calling the waiter', 'Asking for the bill']);
  });

  it('Respond answers every open request of the table', async () => {
    const fetchMock = routeFetch({ '/api/service-calls/': () => ok({ id: 'x', status: 'responded' }) });
    render(<CallPulse tableId={5} calls={[waiter, bill]} />);
    fireEvent.click(screen.getByTestId('respond-5'));
    await waitFor(() => expect(calledWith(fetchMock, '/api/service-calls/', 'POST')).toHaveLength(2));
    expect(calledWith(fetchMock, '/api/service-calls/c1/respond', 'POST')).toHaveLength(1);
    expect(calledWith(fetchMock, '/api/service-calls/c2/respond', 'POST')).toHaveLength(1);
  });

  it('the pulse stays until the response event: pressing Respond does not itself remove the words', async () => {
    routeFetch({ '/api/service-calls/': () => ok({}) });
    render(<CallPulse tableId={5} calls={[waiter]} />);
    fireEvent.click(screen.getByTestId('respond-5'));
    await waitFor(() => expect(screen.getByTestId('respond-5')).not.toBeDisabled());
    expect(screen.getByTestId('call-pulse-5')).toHaveTextContent('Calling the waiter');
  });

  it('a failed response says so and leaves the request open', async () => {
    routeFetch({ '/api/service-calls/': () => failed(500) });
    render(<CallPulse tableId={5} calls={[waiter]} />);
    fireEvent.click(screen.getByTestId('respond-5'));
    expect(await screen.findByRole('alert')).toHaveTextContent('The response could not be sent');
    expect(screen.getByTestId('call-pulse-5')).toHaveTextContent('Calling the waiter');
  });

  it('respondToCalls counts a 404 (the request is already gone) as done, and a network error as not', async () => {
    routeFetch({ '/api/service-calls/gone': () => failed(404), '/api/service-calls/ok': () => ok({}) });
    expect(await respondToCalls([{ ...waiter, id: 'gone' }, { ...bill, id: 'ok' }])).toBe(true);
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new TypeError('offline'))));
    expect(await respondToCalls([waiter])).toBe(false);
  });
});
