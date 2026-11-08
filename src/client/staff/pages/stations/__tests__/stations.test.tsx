// @vitest-environment jsdom
/// <reference types="vitest/globals" />
// U7 Step 13: the station page reached by link, /staff/stations/<station> (BR1.1, BR1.2).
import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, cleanup, act, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import StationPage from '../index';
import { MockEventSource, calledWith, failed, ok, stubStream } from '../../../__tests__/u7Mocks';

let board: object[];
let fetchMock: import('vitest').Mock<any[], any>;
const ticket = { order_number: 3, table_id: 8, status: 'Pending', placed_at: new Date().toISOString(), lines: [{ menu_item_id: 'i-11', name: 'Fresh Orange Juice', quantity: 2, options: [] }], other_stations: [] };
const at = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/staff/stations/:station" element={<StationPage />} />
        <Route path="/staff" element={<div data-testid="board-page" />} />
      </Routes>
    </MemoryRouter>
  );

beforeEach(() => {
  stubStream();
  board = [ticket];
  fetchMock = vi.fn(async (input: RequestInfo | URL) => (String(input).startsWith('/api/staff/stations/Bar/board') ? ok({ station: 'Bar', orders: board }) : failed(404)));
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('the station page', () => {
  it('shows the station\'s name and the same station board, read from the same route', async () => {
    at('/staff/stations/Bar');
    expect(screen.getByRole('heading', { name: 'Bar station' })).toBeInTheDocument();
    expect(await screen.findByTestId('station-ticket-3')).toHaveTextContent('2 × Fresh Orange Juice');
    expect(screen.getByTestId('bar-done-3')).toHaveTextContent('Bar done');
    expect(calledWith(fetchMock, '/api/staff/stations/Bar/board')).toHaveLength(1);
  });

  it('follows the live events: a station done by another cook takes the ticket off', async () => {
    at('/staff/stations/Bar');
    await screen.findByTestId('station-ticket-3');
    board = [];
    act(() => MockEventSource.last.emit('STATION_DONE', { order_number: 3, table_id: 8, station: 'Bar', remaining: [] }));
    expect(await screen.findByTestId('station-empty')).toBeInTheDocument();
  });

  it('a station name that does not exist says so, and reads nothing', async () => {
    at('/staff/stations/Pantry');
    expect(screen.getByTestId('station-unknown')).toHaveTextContent('There is no station called "Pantry". The stations are Grill, Cold, Bar, Desserts.');
    await new Promise((r) => setTimeout(r, 20));
    expect(calledWith(fetchMock, '/api/staff/stations/')).toHaveLength(0);
  });

  it('has a way back to the Kitchen Board', async () => {
    at('/staff/stations/Bar');
    await screen.findByTestId('station-ticket-3');
    screen.getByRole('link', { name: /Kitchen Board/ }).click();
    await waitFor(() => expect(screen.getByTestId('board-page')).toBeInTheDocument());
  });
});
