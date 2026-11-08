// @vitest-environment jsdom
/// <reference types="vitest/globals" />
// U7 Step 11: the Kitchen Board with station tabs, the new-order alert and mute switch, ticket timers, options on
// tickets and the call pulse (BR1.1, BR1.4, BR2.1, BR2.3, BR3.1, BR3.2, BR4.1).
import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi, type Mock } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor, act, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import KitchenBoardScreen from '../KitchenBoardScreen';
import { MockEventSource, calledWith, failed, ok, stubStream } from '../../../staff/__tests__/u7Mocks';

const ago = (m: number) => new Date(Date.now() - m * 60_000).toISOString();
const burger = { menu_item_id: 'i-04', name: 'Classic Burger', quantity: 1, price_cents_each: 1750, subtotal_cents: 1750, station: 'Grill', options: [{ label: 'Large', price_delta_cents: 300 }, { label: 'Extra cheese', price_delta_cents: 100 }, { label: 'No onions', price_delta_cents: 0 }] };
const order = (n: number, status: string, placedAt: string, extra: object = {}) => ({ order_number: n, status, placed_at: placedAt, visit_id: 'v', lines: [burger], subtotal_cents: 1750, completed_at: null, ...extra });

let tableRows: Array<{ id: number; label: string; open_calls: Array<{ id: string; kind: string; opened_at: string }> }>;
let ordersByTable: Record<number, object[]>;
let stationBoard: object[];
let fetchMock: Mock<any[], any>;

function wire() {
  fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.startsWith('/api/staff/tables')) return ok({ tables: tableRows });
    if (url.startsWith('/api/staff/stations/')) return ok({ station: 'Grill', orders: stationBoard });
    if (url.startsWith('/api/service-calls/')) return ok({ status: 'responded' });
    const m = /\/api\/tables\/(\d+)\/orders/.exec(url);
    if (m) return ok({ orders: ordersByTable[Number(m[1])] ?? [] });
    if (url.startsWith('/api/menu')) return ok({ categories: [], items: [] });
    void init;
    return failed(404);
  });
  vi.stubGlobal('fetch', fetchMock);
}

const renderBoard = () => render(<MemoryRouter><KitchenBoardScreen /></MemoryRouter>);

beforeEach(() => {
  window.localStorage.clear();
  stubStream();
  tableRows = [1, 2, 3].map((id) => ({ id, label: `Table ${id}`, open_calls: [] }));
  ordersByTable = {};
  stationBoard = [];
  wire();
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('the station tabs on the board', () => {
  it('shows the tabs under the header, All stations selected, with v1\'s cards below', async () => {
    ordersByTable = { 2: [order(10, 'Pending', ago(1))] };
    renderBoard();
    expect(screen.getByRole('tab', { name: 'All stations' })).toHaveAttribute('aria-selected', 'true');
    expect(await screen.findByTestId('order-card-10')).toBeInTheDocument();
    expect(within(screen.getByTestId('order-card-10')).getByTestId('btn-preparing-10')).toHaveTextContent('Start preparing');
  });

  it('a station tab shows that station\'s tickets, with "<Station> done", and hides v1\'s table cards', async () => {
    ordersByTable = { 2: [order(10, 'Pending', ago(1))] };
    stationBoard = [{ order_number: 10, table_id: 2, status: 'Pending', placed_at: ago(1), lines: [{ menu_item_id: 'i-04', name: 'Classic Burger', quantity: 1, options: burger.options }], other_stations: [] }];
    renderBoard();
    await screen.findByTestId('order-card-10');
    fireEvent.click(screen.getByRole('tab', { name: 'Grill' }));
    expect(await screen.findByTestId('station-ticket-10')).toBeInTheDocument();
    expect(screen.getByTestId('grill-done-10')).toBeInTheDocument();
    expect(screen.queryByTestId('order-card-10')).toBeNull();
    expect(calledWith(fetchMock, '/api/staff/stations/Grill/board')).toHaveLength(1);
    fireEvent.click(screen.getByRole('tab', { name: 'All stations' }));
    expect(await screen.findByTestId('order-card-10')).toBeInTheDocument();
  });

  it('All stations keeps v1\'s Start preparing, Complete and Cancel (BR1.4)', async () => {
    ordersByTable = { 1: [order(1, 'Pending', ago(1))], 2: [order(2, 'Preparing', ago(2))] };
    renderBoard();
    expect(await screen.findByTestId('btn-preparing-1')).toBeInTheDocument();
    expect(screen.getByTestId('btn-complete-2')).toBeInTheDocument();
    expect(screen.getByTestId('btn-cancel-1')).toBeInTheDocument();
  });
});

describe('ticket timers and options on the board (BR2.1, BR2.3)', () => {
  it('shows a timer on each open ticket: green, amber "Slow" from 8 and red "Late" from 15', async () => {
    ordersByTable = { 1: [order(1, 'Pending', ago(2))], 2: [order(2, 'Preparing', ago(9))], 3: [order(3, 'Preparing', ago(16))] };
    renderBoard();
    expect(await screen.findByTestId('timer-1')).toHaveAttribute('data-tone', 'green');
    expect(screen.getByTestId('timer-2')).toHaveTextContent('Slow');
    expect(screen.getByTestId('timer-2')).toHaveAttribute('data-tone', 'amber');
    expect(screen.getByTestId('timer-3')).toHaveTextContent('Late');
    expect(screen.getByTestId('timer-3')).toHaveAttribute('data-tone', 'red');
  });

  it('a Completed ticket shows the time it took, and a Cancelled one "Cancelled"', async () => {
    ordersByTable = { 1: [order(1, 'Completed', ago(30), { completed_at: ago(20) })], 2: [order(2, 'Cancelled', ago(30)), order(3, 'Pending', ago(1))] };
    renderBoard();
    expect(await screen.findByTestId('timer-1')).toHaveTextContent('Took 10 min');
    expect(screen.queryByTestId('timer-2')).toBeNull(); // a Cancelled card is left off while the table has an open order (v1)
  });

  it('shows the chosen options under each item', async () => {
    ordersByTable = { 1: [order(1, 'Pending', ago(1))] };
    renderBoard();
    expect(await screen.findByTestId('line-options-1-0')).toHaveTextContent('Large, Extra cheese, No onions');
  });

  it('a line with no options shows nothing extra', async () => {
    ordersByTable = { 1: [order(1, 'Pending', ago(1), { lines: [{ ...burger, options: [] }] })] };
    renderBoard();
    await screen.findByTestId('order-card-1');
    expect(screen.queryByTestId('line-options-1-0')).toBeNull();
  });
});

describe('the new-order alert and the mute switch in the header (BR3.1)', () => {
  it('an ORDER_PLACED event shows the banner within the same moment', async () => {
    renderBoard();
    await screen.findByTestId('board-empty');
    act(() => MockEventSource.last.emit('ORDER_PLACED', { order_number: 14, table_id: 2, status: 'Pending', placed_at: new Date(Date.now() + 500).toISOString(), visit_id: 'v', lines: [burger] }));
    expect(await screen.findByTestId('new-order-alert-14')).toHaveTextContent('New order #14 from Table 2');
    expect(await screen.findByTestId('order-card-14')).toBeInTheDocument();
  });

  it('the Sound on / Muted switch is in the header, starts on, and Muted is remembered', async () => {
    renderBoard();
    const sound = screen.getByRole('group', { name: 'Sound' });
    expect(within(sound).getByRole('button', { name: 'Sound on' })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(within(sound).getByRole('button', { name: 'Muted' }));
    expect(within(sound).getByRole('button', { name: 'Muted' })).toHaveAttribute('aria-pressed', 'true');
    expect(window.localStorage.getItem('table-order.sound')).toBe('muted');
    await screen.findByTestId('board-empty');
  });

  it('a muted board still shows the banner', async () => {
    window.localStorage.setItem('table-order.sound', 'muted');
    renderBoard();
    await screen.findByTestId('board-empty');
    act(() => MockEventSource.last.emit('ORDER_PLACED', { order_number: 15, table_id: 1, status: 'Pending', placed_at: new Date(Date.now() + 500).toISOString(), visit_id: 'v', lines: [burger] }));
    expect(await screen.findByTestId('new-order-alert-15')).toBeInTheDocument();
  });
});

describe('a table that calls (BR3.2)', () => {
  it('pulses with the words and a Respond button; the pulse stops when the response event arrives', async () => {
    ordersByTable = { 2: [order(10, 'Pending', ago(1))] };
    tableRows[1].open_calls = [{ id: 'c1', kind: 'waiter', opened_at: ago(1) }];
    renderBoard();
    const section = await screen.findByTestId('table-section-2');
    expect(section).toHaveClass('u7-pulse');
    expect(section).toHaveTextContent('Calling the waiter');
    fireEvent.click(screen.getByTestId('respond-2'));
    await waitFor(() => expect(calledWith(fetchMock, '/api/service-calls/c1/respond', 'POST')).toHaveLength(1));
    // the button press alone does not stop it
    expect(screen.getByTestId('table-section-2')).toHaveClass('u7-pulse');
    act(() => MockEventSource.last.emit('SERVICE_CALL_RESPONDED', { call_id: 'c1', table_id: 2, kind: 'waiter', responded_at: new Date().toISOString() }));
    await waitFor(() => expect(screen.getByTestId('table-section-2')).not.toHaveClass('u7-pulse'));
    expect(screen.queryByText('Calling the waiter')).toBeNull();
  });

  it('a new request shows the words at once', async () => {
    ordersByTable = { 3: [order(11, 'Completed', ago(20), { completed_at: ago(10) })] };
    renderBoard();
    await screen.findByTestId('table-section-3');
    act(() => MockEventSource.last.emit('SERVICE_CALL_OPENED', { call_id: 'b1', table_id: 3, kind: 'bill', opened_at: new Date().toISOString() }));
    expect(await screen.findByText(/Asking for the bill/)).toBeInTheDocument();
  });

  it('a table that calls with no order on the card is still on the board', async () => {
    tableRows[3 - 1].open_calls = [{ id: 'c9', kind: 'bill', opened_at: ago(1) }];
    renderBoard();
    expect(await screen.findByTestId('table-section-3')).toHaveTextContent('Asking for the bill');
  });

  it('closing the table clears the pulse', async () => {
    ordersByTable = { 2: [order(10, 'Completed', ago(5), { completed_at: ago(1) })] };
    tableRows[1].open_calls = [{ id: 'c1', kind: 'bill', opened_at: ago(1) }];
    renderBoard();
    await screen.findByTestId('table-section-2');
    act(() => MockEventSource.last.emit('TABLE_CLOSED', { table_id: 2, archived_visit_id: 'v' }));
    await waitFor(() => expect(screen.queryByTestId('table-section-2')).toBeNull());
  });
});

describe('the table list (BR4.1)', () => {
  it('when the table list cannot be read, the board says so and Retry reads it again', async () => {
    let fail = true;
    fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.startsWith('/api/staff/tables')) return fail ? failed(500) : ok({ tables: tableRows });
      return ok({ orders: [] });
    });
    vi.stubGlobal('fetch', fetchMock);
    renderBoard();
    expect(await screen.findByTestId('board-error')).toHaveTextContent('The tables could not be loaded. Try again.');
    fail = false;
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByTestId('board-empty')).toBeInTheDocument();
  });

  it('reads only the tables the server lists', async () => {
    tableRows = [{ id: 21, label: 'Patio 1', open_calls: [] }];
    ordersByTable = { 21: [order(1, 'Pending', ago(1))] };
    renderBoard();
    expect(await screen.findByTestId('table-section-21')).toBeInTheDocument();
    expect(calledWith(fetchMock, '/api/tables/').map((c) => String(c[0]))).toEqual(['/api/tables/21/orders?visit=current']);
  });
});
