// U6 Steps 6 and 9: the features that read from the server and react to live events:
// estimate, tracker, call card, Chef's special card (BR3.1 to BR3.5, BR5.1 to BR5.3, BR9.1, BR9.2).
import React from 'react';
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor, act } from '@testing-library/react';
import EstimateFeature from '../estimate/index.js';
import TrackerFeature from '../tracker/index.js';
import HelpCardFeature from '../help-card/index.js';
import SpecialCardFeature from '../special-card/index.js';
import { stateFromCalls } from '../help-card/useCalls.js';
import { formatCountdown } from '../special-card/useCurrentSpecial.js';
import type { SSEEvent } from '../../../hooks/useTableSSE.js';

const ev = (seq: number, type: string, data: unknown = {}): SSEEvent => ({ seq, type, data });

type Route = (url: string, init?: RequestInit) => { status?: number; body?: unknown } | 'fail';
function stubRoutes(route: Route) {
  const mock = vi.fn(async (url: string, init?: RequestInit) => {
    const r = route(url, init);
    if (r === 'fail') throw new TypeError('offline');
    const status = r.status ?? 200;
    return { ok: status < 400, status, json: async () => r.body ?? {} };
  });
  vi.stubGlobal('fetch', mock);
  return mock;
}

beforeEach(() => {
  localStorage.clear();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('EstimateFeature (BR3.1, BR3.2)', () => {
  it('shows "Estimated wait: about n min" labelled as an estimate', async () => {
    stubRoutes(() => ({ body: { estimate_minutes: 14, basis: 'today', open_orders: 2 } }));
    render(<EstimateFeature tableId="5" />);
    expect(await screen.findByTestId('wait-estimate')).toHaveTextContent('Estimated wait: about 14 min');
    expect(screen.getByTestId('wait-estimate')).toHaveTextContent('Estimate, based on');
  });

  it('shows the starting value as an estimate, never "0 min"', async () => {
    stubRoutes(() => ({ body: { estimate_minutes: 0, basis: 'default' } }));
    render(<EstimateFeature tableId="5" />);
    const banner = await screen.findByTestId('wait-estimate');
    expect(banner).toHaveTextContent('about 1 min');
    expect(banner).not.toHaveTextContent('0 min');
  });

  it('reads again when an order is placed or changes status', async () => {
    let minutes = 14;
    const mock = stubRoutes(() => ({ body: { estimate_minutes: minutes, basis: 'today' } }));
    const { rerender } = render(<EstimateFeature tableId="5" events={[]} />);
    await screen.findByText(/about 14 min/);
    minutes = 20;
    rerender(<EstimateFeature tableId="5" events={[ev(1, 'ORDER_PLACED')]} />);
    await screen.findByText(/about 20 min/);
    minutes = 9;
    rerender(<EstimateFeature tableId="5" events={[ev(1, 'ORDER_PLACED'), ev(2, 'ORDER_STATUS_CHANGED')]} />);
    await screen.findByText(/about 9 min/);
    expect(mock).toHaveBeenCalledTimes(3);
  });

  it('says "Estimate unavailable" when the read fails, and the order can still be placed', async () => {
    stubRoutes(() => 'fail');
    render(<EstimateFeature tableId="5" />);
    expect(await screen.findByText('Estimate unavailable')).toBeInTheDocument();
    expect(screen.getByText('You can still place your order.')).toBeInTheDocument();
  });

  it('keeps the estimate it has when a later read fails', async () => {
    let fail = false;
    stubRoutes(() => (fail ? 'fail' : { body: { estimate_minutes: 14, basis: 'today' } }));
    const { rerender } = render(<EstimateFeature tableId="5" events={[]} />);
    await screen.findByText(/about 14 min/);
    fail = true;
    rerender(<EstimateFeature tableId="5" events={[ev(1, 'ORDER_PLACED')]} />);
    await act(async () => {});
    expect(screen.getByText(/about 14 min/)).toBeInTheDocument();
  });
});

describe('TrackerFeature (BR3.3 to BR3.5)', () => {
  const NOW = new Date('2026-11-08T12:10:00Z');
  const order = (over: object) => ({ order_number: 12, status: 'Preparing' as const, placed_at: '2026-11-08T12:04:00Z', estimate_minutes: 14, ...over });

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  it('highlights the current step of Pending, Preparing, Completed', () => {
    render(<TrackerFeature tableId="5" order={order({})} />);
    const steps = screen.getByTestId('order-tracker-12').querySelectorAll('li');
    expect([...steps].map((s) => s.textContent)).toEqual(['Pending', 'Preparing', 'Completed']);
    expect([...steps].map((s) => s.getAttribute('data-state'))).toEqual(['done', 'current', 'coming']);
  });

  it('shows the minutes left from the stored estimate', () => {
    render(<TrackerFeature tableId="5" order={order({})} />); // 6 minutes elapsed of 14
    expect(screen.getByTestId('order-estimate-12')).toHaveTextContent('About 8 min left');
  });

  it('shows "Running late" once the wait passes the estimate, never a zero or negative time', () => {
    render(<TrackerFeature tableId="5" order={order({ estimate_minutes: 4 })} />);
    expect(screen.getByTestId('running-late-12')).toHaveTextContent('Running late');
    expect(screen.queryByTestId('order-estimate-12')).toBeNull();
  });

  it('shows no time for an order placed before v2 (no estimate)', () => {
    render(<TrackerFeature tableId="5" order={order({ estimate_minutes: null })} />);
    expect(screen.queryByTestId('order-estimate-12')).toBeNull();
    expect(screen.queryByTestId('running-late-12')).toBeNull();
    expect(screen.getByTestId('order-tracker-12')).toBeInTheDocument();
  });

  it('recalculates every 30 seconds', () => {
    render(<TrackerFeature tableId="5" order={order({})} />);
    expect(screen.getByTestId('order-estimate-12')).toHaveTextContent('About 8 min left');
    act(() => {
      vi.advanceTimersByTime(60_000);
    });
    expect(screen.getByTestId('order-estimate-12')).toHaveTextContent('About 7 min left');
  });

  it('a Cancelled order shows the word and no bar and no time', () => {
    render(<TrackerFeature tableId="5" order={order({ status: 'Cancelled' })} />);
    expect(screen.getByText('Cancelled')).toBeInTheDocument();
    expect(screen.queryByTestId('order-tracker-12')).toBeNull();
    expect(screen.queryByTestId('order-estimate-12')).toBeNull();
  });

  it('a Completed order shows the bar at its last step and no time', () => {
    render(<TrackerFeature tableId="5" order={order({ status: 'Completed' })} />);
    const steps = screen.getByTestId('order-tracker-12').querySelectorAll('li');
    expect(steps[2].getAttribute('data-state')).toBe('current');
    expect(screen.queryByTestId('order-estimate-12')).toBeNull();
    expect(screen.queryByTestId('running-late-12')).toBeNull();
  });
});

describe('call card (BR5.1 to BR5.3)', () => {
  it('derives each button from the newest request of its kind', () => {
    expect(stateFromCalls([], 'bill')).toBe('ready');
    expect(stateFromCalls([{ id: '1', kind: 'bill', status: 'open' }], 'bill')).toBe('sent');
    expect(stateFromCalls([{ id: '1', kind: 'bill', status: 'responded' }], 'bill')).toBe('answered');
    expect(stateFromCalls([{ id: '1', kind: 'bill', status: 'responded' }, { id: '2', kind: 'bill', status: 'open' }], 'bill')).toBe('sent');
    expect(stateFromCalls([{ id: '1', kind: 'waiter', status: 'open' }], 'bill')).toBe('ready');
  });

  it('shows both buttons ready, and a press makes one request and shows "Request sent"', async () => {
    const mock = stubRoutes((url, init) => (init?.method === 'POST' ? { status: 201, body: { id: 'c1', kind: 'waiter', status: 'open' } } : { body: { calls: [] } }));
    render(<HelpCardFeature tableId="5" events={[]} />);
    expect(screen.getByText('Need something?')).toBeInTheDocument();
    const waiter = screen.getByTestId('call-waiter');
    fireEvent.click(waiter);
    fireEvent.click(waiter); // a double tap
    await waitFor(() => expect(waiter).toHaveTextContent('Request sent'));
    expect(waiter).toBeDisabled();
    expect(screen.getByTestId('ask-bill')).not.toBeDisabled(); // the two kinds are independent
    expect(mock.mock.calls.filter((c) => (c[1] as RequestInit | undefined)?.method === 'POST')).toHaveLength(1);
  });

  it('regression: a calls read that started before the press cannot undo "Request sent" when it answers after the press', async () => {
    // Found by the first version of the test above: the opening read answered after the press and put the
    // button back to "Call the waiter".
    let releaseRead!: () => void;
    const slowRead = new Promise<void>((resolve) => (releaseRead = resolve));
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init?: RequestInit) => {
        if (init?.method === 'POST') return { ok: true, status: 201, json: async () => ({ id: 'c1', kind: 'waiter', status: 'open' }) };
        await slowRead;
        return { ok: true, status: 200, json: async () => ({ calls: [] }) };
      })
    );
    render(<HelpCardFeature tableId="5" events={[]} />);
    fireEvent.click(screen.getByTestId('call-waiter'));
    await waitFor(() => expect(screen.getByTestId('call-waiter')).toHaveTextContent('Request sent'));
    await act(async () => {
      releaseRead(); // the old read answers now, with no request in it
    });
    expect(screen.getByTestId('call-waiter')).toHaveTextContent('Request sent');
    expect(screen.getByTestId('call-waiter')).toBeDisabled();
  });

  it('starts from the open request the server already has', async () => {
    stubRoutes(() => ({ body: { calls: [{ id: 'c1', kind: 'bill', status: 'open' }] } }));
    render(<HelpCardFeature tableId="5" events={[]} />);
    await waitFor(() => expect(screen.getByTestId('ask-bill')).toHaveTextContent('Request sent'));
    expect(screen.getByTestId('call-waiter')).toHaveTextContent('Call the waiter');
  });

  it('shows "Help is on the way." after staff respond, and the button is available again', async () => {
    let calls: object[] = [{ id: 'c1', kind: 'bill', status: 'open' }];
    stubRoutes(() => ({ body: { calls } }));
    const { rerender } = render(<HelpCardFeature tableId="5" events={[]} />);
    await waitFor(() => expect(screen.getByTestId('ask-bill')).toBeDisabled());
    calls = [{ id: 'c1', kind: 'bill', status: 'responded' }];
    rerender(<HelpCardFeature tableId="5" events={[ev(1, 'SERVICE_CALL_RESPONDED')]} />);
    await waitFor(() => expect(screen.getByTestId('help-status')).toHaveTextContent('Help is on the way.'));
    expect(screen.getByTestId('ask-bill')).not.toBeDisabled();
  });

  it('a network failure says "Could not send. Try again." and changes nothing', async () => {
    stubRoutes((url, init) => (init?.method === 'POST' ? 'fail' : { body: { calls: [] } }));
    render(<HelpCardFeature tableId="5" events={[]} />);
    fireEvent.click(screen.getByTestId('call-waiter'));
    expect(await screen.findByTestId('help-error')).toHaveTextContent('Could not send. Try again.');
    expect(screen.getByTestId('call-waiter')).not.toBeDisabled();
  });

  it('"Ask for the bill" opens the pay sheet; Cash or Card sends the request with that choice', async () => {
    const mock = stubRoutes((url, init) => (init?.method === 'POST' ? { status: 201, body: { id: 'c2', kind: 'bill', status: 'open', payment_method: 'card' } } : { body: { calls: [] } }));
    render(<HelpCardFeature tableId="5" events={[]} />);
    expect(screen.queryByTestId('pay-sheet')).toBeNull();
    fireEvent.click(screen.getByTestId('ask-bill'));
    expect(screen.getByTestId('pay-sheet')).toBeInTheDocument();
    expect(screen.getByTestId('pay-cash')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('pay-receipt'));
    fireEvent.click(screen.getByTestId('pay-card'));
    await waitFor(() => expect(screen.getByTestId('ask-bill')).toHaveTextContent('Request sent'));
    expect(screen.queryByTestId('pay-sheet')).toBeNull();
    const posts = mock.mock.calls.filter((c) => (c[1] as RequestInit | undefined)?.method === 'POST');
    expect(posts).toHaveLength(1);
    expect(JSON.parse((posts[0][1] as RequestInit).body as string)).toEqual({ kind: 'bill', payment_method: 'card', wants_receipt: true });
  });

  it('Cancel on the pay sheet sends nothing and leaves the bill button ready', async () => {
    const mock = stubRoutes(() => ({ body: { calls: [] } }));
    render(<HelpCardFeature tableId="5" events={[]} />);
    fireEvent.click(screen.getByTestId('ask-bill'));
    fireEvent.click(screen.getByTestId('pay-cancel'));
    expect(screen.queryByTestId('pay-sheet')).toBeNull();
    expect(screen.getByTestId('ask-bill')).not.toBeDisabled();
    expect(mock.mock.calls.filter((c) => (c[1] as RequestInit | undefined)?.method === 'POST')).toHaveLength(0);
  });

  it('"Ask for the bill" is disabled, with a line saying why, while an order is not completed', async () => {
    stubRoutes(() => ({ body: { calls: [] } }));
    render(<HelpCardFeature tableId="5" events={[]} canAskBill={false} />);
    expect(screen.getByTestId('ask-bill')).toBeDisabled();
    expect(screen.getByTestId('bill-wait')).toBeInTheDocument();
    expect(screen.getByTestId('call-waiter')).not.toBeDisabled();
  });

  it('a 409 NO_OPEN_VISIT hides the card', async () => {
    stubRoutes((url, init) => (init?.method === 'POST' ? { status: 409, body: { error: { code: 'NO_OPEN_VISIT', message: 'x' } } } : { body: { calls: [] } }));
    render(<HelpCardFeature tableId="5" events={[]} />);
    fireEvent.click(screen.getByTestId('ask-bill'));
    fireEvent.click(screen.getByTestId('pay-cash'));
    await waitFor(() => expect(screen.queryByTestId('help-card')).toBeNull());
  });

  it('regression: the card comes back when an order is placed after a 409 NO_OPEN_VISIT hid it', async () => {
    stubRoutes((url, init) => (init?.method === 'POST' ? { status: 409, body: { error: { code: 'NO_OPEN_VISIT', message: 'x' } } } : { body: { calls: [] } }));
    const { rerender } = render(<HelpCardFeature tableId="5" events={[]} />);
    fireEvent.click(screen.getByTestId('ask-bill'));
    fireEvent.click(screen.getByTestId('pay-cash'));
    await waitFor(() => expect(screen.queryByTestId('help-card')).toBeNull());
    rerender(<HelpCardFeature tableId="5" events={[ev(1, 'ORDER_PLACED', { order_number: 4, table_id: 5 })]} />);
    await waitFor(() => expect(screen.getByTestId('help-card')).toBeInTheDocument());
    expect(screen.getByTestId('call-waiter')).not.toBeDisabled();
  });

  it('regression: after the table is closed the card is hidden, and a new visit (an order placed) shows it again with both buttons ready', async () => {
    let calls: object[] = [{ id: 'c1', kind: 'waiter', status: 'open' }];
    stubRoutes(() => ({ body: { calls } }));
    const { rerender } = render(<HelpCardFeature tableId="5" events={[]} />);
    await waitFor(() => expect(screen.getByTestId('call-waiter')).toBeDisabled());
    rerender(<HelpCardFeature tableId="5" events={[ev(1, 'TABLE_CLOSED')]} />);
    await waitFor(() => expect(screen.queryByTestId('help-card')).toBeNull());
    calls = []; // the server cleared the old requests
    rerender(<HelpCardFeature tableId="5" events={[ev(1, 'TABLE_CLOSED'), ev(2, 'ORDER_PLACED', { order_number: 9 })]} />);
    await waitFor(() => expect(screen.getByTestId('help-card')).toBeInTheDocument());
    expect(screen.getByTestId('call-waiter')).not.toBeDisabled();
    expect(screen.getByTestId('call-waiter')).toHaveTextContent('Call the waiter');
  });

  it('the card stays hidden while there is no open visit: events that are not about a visit do not bring it back', async () => {
    stubRoutes(() => ({ body: { calls: [] } }));
    const { rerender } = render(<HelpCardFeature tableId="5" events={[]} />);
    rerender(<HelpCardFeature tableId="5" events={[ev(1, 'TABLE_CLOSED')]} />);
    await waitFor(() => expect(screen.queryByTestId('help-card')).toBeNull());
    rerender(<HelpCardFeature tableId="5" events={[ev(1, 'TABLE_CLOSED'), ev(2, 'MENU_CHANGED'), ev(3, 'ORDER_STATUS_CHANGED', {})]} />);
    await act(async () => {});
    expect(screen.queryByTestId('help-card')).toBeNull();
  });

  it('closing the table removes the card', async () => {
    stubRoutes(() => ({ body: { calls: [] } }));
    const { rerender } = render(<HelpCardFeature tableId="5" events={[]} />);
    expect(screen.getByTestId('help-card')).toBeInTheDocument();
    rerender(<HelpCardFeature tableId="5" events={[ev(1, 'TABLE_CLOSED')]} />);
    await waitFor(() => expect(screen.queryByTestId('help-card')).toBeNull());
  });
});

describe("Chef's special card (BR9.1, BR9.2)", () => {
  const NOW = new Date('2026-11-08T12:00:00Z');
  const special = (over: object = {}) => ({ id: 'sp-1', item_id: 'i-04', name: 'Lobster Linguine', special_price_cents: 2400, stock_left: 6, ends_at: '2026-11-08T12:12:40Z', ...over });

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'] });
    vi.setSystemTime(NOW);
  });

  it('formats the countdown as mm:ss', () => {
    expect(formatCountdown(12 * 60_000 + 40_000)).toBe('12:40');
    expect(formatCountdown(-5)).toBe('00:00');
  });

  it('shows the name, the price, the stock left and "Ends in mm:ss"', async () => {
    stubRoutes(() => ({ body: { special: special() } }));
    render(<SpecialCardFeature tableId="5" events={[]} />);
    const card = await screen.findByTestId('chef-special');
    expect(card).toHaveTextContent("Chef's special");
    expect(card).toHaveTextContent('Lobster Linguine');
    expect(card).toHaveTextContent('$24.00');
    expect(card).toHaveTextContent('6 left');
    expect(screen.getByTestId('special-countdown')).toHaveTextContent('Ends in 12:40');
  });

  it('counts down every second and removes the card the moment the time is up, without the server', async () => {
    stubRoutes(() => ({ body: { special: special({ ends_at: '2026-11-08T12:00:03Z' }) } }));
    render(<SpecialCardFeature tableId="5" events={[]} />);
    await screen.findByTestId('chef-special');
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(screen.getByTestId('special-countdown')).toHaveTextContent('Ends in 00:02');
    act(() => {
      vi.advanceTimersByTime(2500);
    });
    expect(screen.queryByTestId('chef-special')).toBeNull();
  });

  it('+ Add hands the special to the Menu', async () => {
    stubRoutes(() => ({ body: { special: special() } }));
    const onAdd = vi.fn();
    render(<SpecialCardFeature tableId="5" events={[]} onAdd={onAdd} />);
    fireEvent.click(await screen.findByTestId('special-add'));
    expect(onAdd).toHaveBeenCalledWith(expect.objectContaining({ id: 'sp-1', stock_left: 6 }));
  });

  it('is removed live when a SPECIAL_CHANGED event says there is none, and shown when one is launched', async () => {
    stubRoutes(() => ({ body: { special: special() } }));
    const { rerender } = render(<SpecialCardFeature tableId="5" events={[]} />);
    await screen.findByTestId('chef-special');
    rerender(<SpecialCardFeature tableId="5" events={[ev(1, 'SPECIAL_CHANGED', { special: null })]} />);
    await waitFor(() => expect(screen.queryByTestId('chef-special')).toBeNull());
    rerender(<SpecialCardFeature tableId="5" events={[ev(1, 'SPECIAL_CHANGED', { special: null }), ev(2, 'SPECIAL_CHANGED', { special: special({ name: 'Crab Cakes' }) })]} />);
    expect(await screen.findByText('Crab Cakes')).toBeInTheDocument();
  });

  it('is removed when the stock reaches zero', async () => {
    stubRoutes(() => ({ body: { special: special() } }));
    const { rerender } = render(<SpecialCardFeature tableId="5" events={[]} />);
    await screen.findByTestId('chef-special');
    rerender(<SpecialCardFeature tableId="5" events={[ev(1, 'SPECIAL_CHANGED', { special: special({ stock_left: 0 }) })]} />);
    await waitFor(() => expect(screen.queryByTestId('chef-special')).toBeNull());
  });

  it('shows no card when there is no special, or when the read fails', async () => {
    stubRoutes(() => ({ body: { special: null } }));
    const { container, unmount } = render(<SpecialCardFeature tableId="5" events={[]} />);
    await act(async () => {});
    expect(container).toBeEmptyDOMElement();
    unmount();
    stubRoutes(() => 'fail');
    const second = render(<SpecialCardFeature tableId="5" events={[]} />);
    await act(async () => {});
    expect(second.container).toBeEmptyDOMElement();
  });
});
