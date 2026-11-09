// @vitest-environment jsdom
/// <reference types="vitest/globals" />
// U7 Step 11: the new-order alert and mute switch (BR3.1) and the call pulse with Respond (BR3.2).
import React from 'react';
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import NewOrderBanner, { SoundSwitch } from '../NewOrderBanner';
import CallPulse, { callLabels, respondToCalls } from '../CallPulse';
import { calledWith, failed, ok, routeFetch } from '../../__tests__/u7Mocks';
import { _resetInteractionForTest } from '../../../alerts/alertLogic';
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
  _resetInteractionForTest();
});

/** A stand-in for the browser's audio: counts the rings (one audio context each) and the bell notes struck. */
function stubAudio() {
  const stats = { rings: 0, notes: 0, closed: 0 };
  const param = () => ({ value: 0, setValueAtTime() {}, exponentialRampToValueAtTime() {} });
  class Ctx {
    destination = {};
    currentTime = 0;
    constructor() {
      stats.rings++;
    }
    resume() {
      return Promise.resolve();
    }
    createOscillator() {
      stats.notes++;
      return { type: '', frequency: { value: 0 }, connect() {}, start() {}, stop() {} };
    }
    createGain() {
      return { gain: param(), connect() {} };
    }
    close() {
      stats.closed++;
      return Promise.resolve();
    }
  }
  vi.stubGlobal('AudioContext', Ctx);
  Object.defineProperty(window, 'AudioContext', { value: Ctx, configurable: true });
  return stats;
}
const calling = (callId: string, table: number, seq: number, kind: 'waiter' | 'bill' = 'waiter', extra: object = {}): StaffSSEEvent => ({
  type: 'SERVICE_CALL_OPENED',
  seq,
  data: { call_id: callId, table_id: table, kind, opened_at: new Date(Date.now() + 1000).toISOString(), ...extra },
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

  it('a bell rings (three strikes of three notes) for a new order after the first tap and only when not muted; the banner shows either way', () => {
    const audio = stubAudio();
    const { rerender } = render(<NewOrderBanner events={[]} muted={false} />);
    fireEvent.pointerDown(document.body); // the first tap
    rerender(<NewOrderBanner events={[placed(1, 1, 1)]} muted={false} />);
    expect(audio.rings).toBe(1);
    expect(audio.notes).toBe(9);

    rerender(<NewOrderBanner events={[placed(1, 1, 1), placed(2, 2, 2)]} muted />);
    expect(screen.getByTestId('new-order-alert-2')).toBeInTheDocument();
    expect(audio.rings).toBe(1); // muted: no second ring
  });

  it('a tap made before the board opened (on the PIN screen) already lets the bell ring', () => {
    const audio = stubAudio();
    fireEvent.pointerDown(document.body); // the PIN screen's tap, before the board is on screen
    const { rerender } = render(<NewOrderBanner events={[]} muted={false} />);
    rerender(<NewOrderBanner events={[placed(1, 1, 1)]} muted={false} />);
    expect(audio.rings).toBe(1);
  });

  it('with no tap at all the banner shows and the bell stays quiet', () => {
    const audio = stubAudio();
    const { rerender } = render(<NewOrderBanner events={[]} muted={false} />);
    rerender(<NewOrderBanner events={[placed(1, 1, 1)]} muted={false} />);
    expect(screen.getByTestId('new-order-alert-1')).toBeInTheDocument();
    expect(audio.rings).toBe(0);
  });

  it('a table calling the waiter shows "Table <n> is calling the waiter" and rings once', () => {
    const audio = stubAudio();
    fireEvent.pointerDown(document.body);
    const { rerender } = render(<NewOrderBanner events={[]} muted={false} />);
    rerender(<NewOrderBanner events={[calling('c-1', 4, 1)]} muted={false} />);
    expect(screen.getByTestId('call-alert-c-1')).toHaveTextContent('Table 4 is calling the waiter');
    rerender(<NewOrderBanner events={[calling('c-1', 4, 1)]} muted={false} />); // the same event again
    expect(audio.rings).toBe(1);
  });

  it('a table asking for the bill says how it will pay and whether it wants a receipt', () => {
    stubAudio();
    const { rerender } = render(<NewOrderBanner events={[]} muted={false} />);
    rerender(<NewOrderBanner events={[calling('c-2', 7, 1, 'bill', { payment_method: 'card', wants_receipt: true })]} muted={false} />);
    const banner = screen.getByTestId('call-alert-c-2');
    expect(banner).toHaveTextContent('Table 7 is asking for the bill');
    expect(banner).toHaveTextContent('Pays with card, wants a receipt.');
    rerender(<NewOrderBanner events={[calling('c-2', 7, 1, 'bill', { payment_method: 'card', wants_receipt: true }), calling('c-3', 8, 2, 'bill', { payment_method: 'cash' })]} muted={false} />);
    expect(screen.getByTestId('call-alert-c-3')).toHaveTextContent('Pays with cash.');
  });

  it('a muted call still shows its banner but does not ring, and a call from before the page loaded raises nothing', () => {
    const audio = stubAudio();
    fireEvent.pointerDown(document.body);
    const { rerender } = render(<NewOrderBanner events={[]} muted />);
    rerender(<NewOrderBanner events={[calling('c-4', 2, 1)]} muted />);
    expect(screen.getByTestId('call-alert-c-4')).toBeInTheDocument();
    expect(audio.rings).toBe(0);
    const old: StaffSSEEvent = { type: 'SERVICE_CALL_OPENED', seq: 2, data: { call_id: 'c-old', table_id: 3, kind: 'waiter', opened_at: new Date(Date.now() - 60_000).toISOString() } };
    rerender(<NewOrderBanner events={[calling('c-4', 2, 1), old]} muted={false} />);
    expect(screen.queryByTestId('call-alert-c-old')).toBeNull();
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
