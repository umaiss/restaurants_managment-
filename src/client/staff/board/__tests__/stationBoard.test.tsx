// @vitest-environment jsdom
/// <reference types="vitest/globals" />
// U7 Step 11: a station's board and the "<Station> done" button (BR1.1, BR1.2).
import React from 'react';
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor, act } from '@testing-library/react';
import StationBoard, { type StationTicket } from '../StationBoard';
import { calledWith, failed, ok, routeFetch } from '../../__tests__/u7Mocks';

const ticket = (over: Partial<StationTicket> = {}): StationTicket => ({
  order_number: 12,
  table_id: 5,
  status: 'Pending',
  placed_at: new Date().toISOString(),
  lines: [{ menu_item_id: 'i-04', name: 'Classic Burger', quantity: 1, options: [{ label: 'Large', price_delta_cents: 300 }, { label: 'Extra cheese', price_delta_cents: 100 }, { label: 'No onions', price_delta_cents: 0 }] }],
  other_stations: [{ station: 'Bar', state: 'waiting' }],
  ...over,
});

let board: StationTicket[] = [];
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
beforeEach(() => {
  board = [ticket()];
});

const events = (...list: Array<{ type: string; data?: unknown }>) => list.map((e, i) => ({ type: e.type, data: e.data ?? {}, seq: i + 1 }));

describe('a station board', () => {
  it('shows each ticket with its order, table, only this station\'s lines, the options under the item, and the other stations', async () => {
    routeFetch({ '/api/staff/stations/Grill/board': () => ok({ station: 'Grill', orders: board }) });
    render(<StationBoard station="Grill" events={[]} connected />);
    const card = await screen.findByTestId('station-ticket-12');
    expect(card).toHaveTextContent('Order #12 · Table 5');
    expect(card).toHaveTextContent('1 × Classic Burger');
    expect(card).toHaveTextContent('Large, Extra cheese, No onions');
    expect(card).toHaveTextContent('Other stations on this order: Bar (waiting)');
    expect(screen.getByTestId('grill-done-12')).toHaveTextContent('Grill done');
  });

  it('shows a timer on each ticket', async () => {
    routeFetch({ '/api/staff/stations/Grill/board': () => ok({ orders: [ticket({ placed_at: new Date(Date.now() - 9 * 60_000).toISOString() })] }) });
    render(<StationBoard station="Grill" events={[]} connected />);
    expect(await screen.findByTestId('timer-12')).toHaveTextContent('9 min · Slow');
  });

  it('says so when nothing is waiting for the station', async () => {
    routeFetch({ '/api/staff/stations/Cold/board': () => ok({ orders: [] }) });
    render(<StationBoard station="Cold" events={[]} connected />);
    expect(await screen.findByTestId('station-empty')).toHaveTextContent('Nothing waiting for Cold');
  });

  it('says it could not load, and Try again reads it again', async () => {
    let fail = true;
    const fetchMock = routeFetch({ '/api/staff/stations/Grill/board': () => (fail ? failed(500) : ok({ orders: board })) });
    render(<StationBoard station="Grill" events={[]} connected />);
    expect(await screen.findByTestId('station-error')).toHaveTextContent('The Grill board could not be loaded.');
    fail = false;
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByTestId('station-ticket-12')).toBeInTheDocument();
    expect(calledWith(fetchMock, '/api/staff/stations/Grill/board').length).toBe(2);
  });

  it('"Grill done" sends the mark for that order and station, then reads the board again', async () => {
    const fetchMock = routeFetch({
      '/api/staff/stations/Grill/board': () => ok({ orders: board }),
      '/api/staff/orders/12/stations/Grill/done': () => {
        board = [];
        return ok({ order_number: 12, status: 'Preparing' });
      },
    });
    render(<StationBoard station="Grill" events={[]} connected />);
    fireEvent.click(await screen.findByTestId('grill-done-12'));
    await waitFor(() => expect(screen.getByTestId('station-empty')).toBeInTheDocument());
    expect(calledWith(fetchMock, '/api/staff/orders/12/stations/Grill/done', 'POST')).toHaveLength(1);
  });

  it('the button is disabled while the mark is on its way, so one press sends one mark', async () => {
    let release: (v: unknown) => void = () => {};
    const fetchMock = routeFetch({
      '/api/staff/stations/Bar/board': () => ok({ orders: [ticket({ other_stations: [] })] }),
      '/api/staff/orders/12/stations/Bar/done': () => new Promise((resolve) => (release = resolve)),
    });
    render(<StationBoard station="Bar" events={[]} connected />);
    const button = await screen.findByTestId('bar-done-12');
    fireEvent.click(button);
    await waitFor(() => expect(button).toBeDisabled());
    fireEvent.click(button);
    expect(calledWith(fetchMock, '/api/staff/orders/12/stations/Bar/done', 'POST')).toHaveLength(1);
    await act(async () => release(ok({})));
  });

  it('a refused mark (422) says why and keeps the ticket; another error says to try again', async () => {
    let status = 422;
    routeFetch({
      '/api/staff/stations/Grill/board': () => ok({ orders: board }),
      '/api/staff/orders/12/stations/Grill/done': () => failed(status),
    });
    render(<StationBoard station="Grill" events={[]} connected />);
    fireEvent.click(await screen.findByTestId('grill-done-12'));
    expect(await screen.findByRole('alert')).toHaveTextContent('This order can no longer be marked done');
    expect(screen.getByTestId('station-ticket-12')).toBeInTheDocument();
    status = 500;
    fireEvent.click(screen.getByTestId('grill-done-12'));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Grill could not be marked done. Try again.'));
  });

  it('a network error on the mark says so', async () => {
    routeFetch({
      '/api/staff/stations/Grill/board': () => ok({ orders: board }),
      '/api/staff/orders/12/stations/Grill/done': () => {
        throw new TypeError('offline');
      },
    });
    render(<StationBoard station="Grill" events={[]} connected />);
    fireEvent.click(await screen.findByTestId('grill-done-12'));
    expect(await screen.findByRole('alert')).toHaveTextContent('Network error');
  });

  it('reads again on STATION_DONE, ORDER_PLACED, ORDER_STATUS_CHANGED and TABLE_CLOSED, and not for other events', async () => {
    const fetchMock = routeFetch({ '/api/staff/stations/Grill/board': () => ok({ orders: board }) });
    const { rerender } = render(<StationBoard station="Grill" events={[]} connected />);
    await screen.findByTestId('station-ticket-12');
    const reads = () => calledWith(fetchMock, '/api/staff/stations/Grill/board').length;
    expect(reads()).toBe(1);

    rerender(<StationBoard station="Grill" events={events({ type: 'MENU_CHANGED' })} connected />);
    expect(reads()).toBe(1);
    for (const [i, type] of ['STATION_DONE', 'ORDER_PLACED', 'ORDER_STATUS_CHANGED', 'TABLE_CLOSED'].entries()) {
      const list = events({ type: 'MENU_CHANGED' }, ...Array.from({ length: i + 1 }, (_, k) => ({ type: k === i ? type : 'MENU_CHANGED' })));
      rerender(<StationBoard station="Grill" events={list} connected />);
      await waitFor(() => expect(reads()).toBe(2 + i));
    }
  });

  it('regression: opening a station tab while the stream is already connected reads the board once, not twice', async () => {
    const fetchMock = routeFetch({ '/api/staff/stations/Grill/board': () => ok({ orders: board }) });
    render(<StationBoard station="Grill" events={[]} connected />);
    await screen.findByTestId('station-ticket-12');
    await new Promise((r) => setTimeout(r, 20));
    expect(calledWith(fetchMock, '/api/staff/stations/Grill/board')).toHaveLength(1);
  });

  it('reads again after a reconnect', async () => {
    const fetchMock = routeFetch({ '/api/staff/stations/Grill/board': () => ok({ orders: board }) });
    const { rerender } = render(<StationBoard station="Grill" events={[]} connected={false} />);
    await screen.findByTestId('station-ticket-12');
    rerender(<StationBoard station="Grill" events={[]} connected />);
    await waitFor(() => expect(calledWith(fetchMock, '/api/staff/stations/Grill/board').length).toBe(2));
  });

  it('switching station reads that station\'s board', async () => {
    routeFetch({
      '/api/staff/stations/Grill/board': () => ok({ orders: board }),
      '/api/staff/stations/Bar/board': () => ok({ orders: [] }),
    });
    const { rerender } = render(<StationBoard station="Grill" events={[]} connected />);
    await screen.findByTestId('station-ticket-12');
    rerender(<StationBoard station="Bar" events={[]} connected />);
    expect(await screen.findByTestId('station-empty')).toHaveTextContent('Bar');
  });

  it('text with markup is shown as text', async () => {
    routeFetch({ '/api/staff/stations/Grill/board': () => ok({ orders: [ticket({ lines: [{ menu_item_id: 'x', name: '<b>Bold</b> burger', quantity: 1, options: [{ label: '<i>x</i>', price_delta_cents: 0 }] }] })] }) });
    render(<StationBoard station="Grill" events={[]} connected />);
    const card = await screen.findByTestId('station-ticket-12');
    expect(card).toHaveTextContent('<b>Bold</b> burger');
    expect(card.querySelector('b')).toBeNull();
  });
});
