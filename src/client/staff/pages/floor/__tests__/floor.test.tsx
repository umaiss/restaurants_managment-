// @vitest-environment jsdom
/// <reference types="vitest/globals" />
// U7 Step 13: the Floor map page (BR4.1 to BR4.4).
import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor, act } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import FloorPage from '../index';
import { FLOOR_EVENTS } from '../useFloorTables';
import { MockEventSource, calledWith, failed, ok, stubStream } from '../../../__tests__/u7Mocks';

type Row = { id: number; label: string; state: string; connected: number; last_activity_at: string | null; open_calls: unknown[] };
const row = (id: number, state: string): Row => ({ id, label: `Table ${id}`, state, connected: 0, last_activity_at: null, open_calls: [] });

let tables: Row[];
let fetchMock: import('vitest').Mock<any[], any>;
const renderPage = () =>
  render(
    <MemoryRouter initialEntries={['/staff/floor']}>
      <Routes>
        <Route path="/staff/floor" element={<FloorPage />} />
        <Route path="/staff/tables/:id" element={<div data-testid="bill-opened" />} />
      </Routes>
    </MemoryRouter>
  );

beforeEach(() => {
  stubStream();
  tables = [row(1, 'waiting'), row(2, 'empty'), row(3, 'eating'), row(4, 'browsing'), row(5, 'needs_bill')];
  fetchMock = vi.fn(async (input: RequestInfo | URL) => (String(input).startsWith('/api/staff/tables') ? ok({ tables }) : failed(404)));
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('the Floor map page', () => {
  it('shows each table with its state as a WORD, for all five states', async () => {
    renderPage();
    expect(await screen.findByTestId('floor-table-1')).toHaveTextContent('Waiting');
    expect(screen.getByTestId('floor-table-2')).toHaveTextContent('Empty');
    expect(screen.getByTestId('floor-table-3')).toHaveTextContent('Eating');
    expect(screen.getByTestId('floor-table-4')).toHaveTextContent('Browsing');
    expect(screen.getByTestId('floor-table-5')).toHaveTextContent('Needs the bill');
  });

  it('each state also has its own colour class and data-state, so colour is never the only signal', async () => {
    renderPage();
    await screen.findByTestId('floor-table-1');
    expect(screen.getByTestId('floor-table-1')).toHaveClass('waiting');
    expect(screen.getByTestId('floor-table-2')).toHaveClass('empty');
    expect(screen.getByTestId('floor-table-3')).toHaveClass('eating');
    expect(screen.getByTestId('floor-table-4')).toHaveClass('browsing');
    expect(screen.getByTestId('floor-table-5')).toHaveClass('bill');
    expect(screen.getByTestId('floor-table-5')).toHaveAttribute('data-state', 'needs_bill');
  });

  it('has a legend with the five words and the note that colour is not the only signal', async () => {
    renderPage();
    const legend = await screen.findByTestId('floor-legend');
    for (const w of ['Empty', 'Browsing', 'Waiting', 'Eating', 'Needs the bill']) expect(legend).toHaveTextContent(w);
    expect(screen.getByText(/colour is never the only signal/)).toBeInTheDocument();
  });

  it('lists the tables the server lists, however many (no fixed 10)', async () => {
    tables = Array.from({ length: 12 }, (_, i) => row(i + 1, 'empty'));
    renderPage();
    await screen.findByTestId('floor-table-12');
    expect(screen.getAllByTestId(/^floor-table-/)).toHaveLength(12);
  });

  it('selecting a table opens its bill at /staff/tables/<id>', async () => {
    renderPage();
    fireEvent.click(await screen.findByTestId('floor-table-5'));
    expect(await screen.findByTestId('bill-opened')).toBeInTheDocument();
  });

  it('reads the table list again on each of the six floor events, and shows the change', async () => {
    renderPage();
    await screen.findByTestId('floor-table-1');
    const reads = () => calledWith(fetchMock, '/api/staff/tables').length;
    const before = reads();
    for (const [i, type] of FLOOR_EVENTS.entries()) {
      tables = [row(1, i % 2 === 0 ? 'eating' : 'waiting'), ...tables.slice(1)];
      act(() => MockEventSource.last.emit(type, { table_id: 1 }));
      await waitFor(() => expect(reads()).toBe(before + i + 1));
      await waitFor(() => expect(screen.getByTestId('floor-table-1')).toHaveTextContent(i % 2 === 0 ? 'Eating' : 'Waiting'));
    }
    expect(FLOOR_EVENTS).toEqual(['ORDER_PLACED', 'ORDER_STATUS_CHANGED', 'TABLE_CLOSED', 'TABLE_PRESENCE_CHANGED', 'SERVICE_CALL_OPENED', 'SERVICE_CALL_RESPONDED']);
  });

  it('does not read again for an event that cannot change the map', async () => {
    renderPage();
    await screen.findByTestId('floor-table-1');
    const before = calledWith(fetchMock, '/api/staff/tables').length;
    act(() => MockEventSource.last.emit('MENU_CHANGED', { reason: 'item', ids: [] }));
    act(() => MockEventSource.last.emit('SPECIAL_CHANGED', { special: null }));
    await new Promise((r) => setTimeout(r, 30));
    expect(calledWith(fetchMock, '/api/staff/tables').length).toBe(before);
  });

  it('reads the list again after a reconnect', async () => {
    renderPage();
    await screen.findByTestId('floor-table-1');
    act(() => MockEventSource.last.open());
    const after = calledWith(fetchMock, '/api/staff/tables').length;
    expect(after).toBeGreaterThanOrEqual(2);
  });

  it('while loading it says so; a failed first read says so with Retry, and Retry works', async () => {
    let fail = true;
    fetchMock = vi.fn(async () => (fail ? failed(500) : ok({ tables })));
    vi.stubGlobal('fetch', fetchMock);
    renderPage();
    expect(screen.getByTestId('floor-loading')).toHaveTextContent('Loading the floor map');
    expect(await screen.findByTestId('floor-error')).toHaveTextContent('The tables could not be loaded. Try again.');
    fail = false;
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByTestId('floor-table-1')).toBeInTheDocument();
  });

  it('a failed refresh keeps the last good map and says it could not refresh', async () => {
    renderPage();
    await screen.findByTestId('floor-table-1');
    fetchMock.mockImplementation(async () => failed(500));
    act(() => MockEventSource.last.emit('ORDER_PLACED', { table_id: 1 }));
    expect(await screen.findByTestId('floor-stale')).toBeInTheDocument();
    expect(screen.getByTestId('floor-table-1')).toBeInTheDocument();
  });

  it('an older answer that arrives after a newer one does not undo it', async () => {
    const answers: Array<() => void> = [];
    let n = 0;
    vi.stubGlobal('fetch', vi.fn((input: RequestInfo | URL) => {
      if (!String(input).startsWith('/api/staff/tables')) return Promise.resolve(failed(404));
      const mine = ++n;
      const body = { tables: [row(1, mine === 1 ? 'empty' : 'eating')] };
      if (mine === 1) return new Promise((resolve) => answers.push(() => resolve(ok(body))));
      return Promise.resolve(ok(body));
    }));
    renderPage();
    act(() => MockEventSource.last.emit('ORDER_PLACED', { table_id: 1 })); // a second read, answered at once
    await waitFor(() => expect(screen.getByTestId('floor-table-1')).toHaveTextContent('Eating'));
    act(() => answers.forEach((a) => a())); // the first, older answer lands late
    await new Promise((r) => setTimeout(r, 20));
    expect(screen.getByTestId('floor-table-1')).toHaveTextContent('Eating');
  });
});
