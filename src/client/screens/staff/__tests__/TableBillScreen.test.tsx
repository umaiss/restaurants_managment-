// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi, type Mock } from 'vitest';
import { render, screen, cleanup, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import TableBillScreen from '../TableBillScreen';
import type { Bill } from '../../../hooks/useBill';

class MockEventSource {
  static instance: MockEventSource | null = null;
  listeners: Record<string, ((e: MessageEvent) => void)[]> = {};
  constructor(public url: string) {
    MockEventSource.instance = this;
  }
  addEventListener(type: string, handler: (e: MessageEvent) => void) {
    (this.listeners[type] ??= []).push(handler);
  }
  close() {}
  triggerMessage(type: string, data: unknown) {
    for (const h of this.listeners[type] ?? []) h({ data: JSON.stringify(data) } as MessageEvent);
  }
}

const line = { menu_item_id: 'i-04', name: 'Classic Burger', quantity: 2, price_cents_each: 1050, subtotal_cents: 2100 };
const closableBill: Bill = {
  table_id: 5,
  orders: [
    { order_number: 15, status: 'Completed', placed_at: '2026-11-05T19:04:00', lines: [line], subtotal_cents: 2100 },
    { order_number: 18, status: 'Completed', placed_at: '2026-11-05T19:12:00', lines: [{ ...line, quantity: 1, subtotal_cents: 1050 }], subtotal_cents: 1050 },
  ],
  combined_total_cents: 3150,
  close_available: true,
  blocking_orders: [],
};

let billResponse: () => Promise<unknown>;
let closeResponse: () => Promise<unknown>;
let fetchMock: Mock<any[], any>;

function json(status: number, body: unknown) {
  return Promise.resolve({ ok: status >= 200 && status < 300, status, json: () => Promise.resolve(body) });
}

function renderScreen() {
  return render(
    <MemoryRouter initialEntries={['/staff/tables/5']}>
      <Routes>
        <Route path="/staff/tables/:id" element={<TableBillScreen />} />
        <Route path="/staff" element={<div data-testid="board-page">Board</div>} />
      </Routes>
    </MemoryRouter>
  );
}

beforeEach(() => {
  MockEventSource.instance = null;
  vi.stubGlobal('EventSource', MockEventSource);
  billResponse = () => json(200, closableBill);
  closeResponse = () => json(200, { closed: true, archived_visit_id: 'v-1' });
  fetchMock = vi.fn((url: string, init?: { method?: string }) =>
    init?.method === 'POST' ? closeResponse() : billResponse()
  );
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

async function openConfirm() {
  await screen.findByTestId('bill-order-15');
  await userEvent.click(screen.getByTestId('btn-close-table'));
  return screen.findByTestId('confirm-modal');
}

describe('TableBillScreen', () => {
  it('renders the heading, the orders, their subtotals and the combined total', async () => {
    renderScreen();
    expect(await screen.findByTestId('bill-order-15')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Table 5 — Bill' })).toBeInTheDocument();
    expect(screen.getByTestId('bill-order-18')).toBeInTheDocument();
    expect(screen.getByTestId('bill-combined-total')).toHaveTextContent('$31.50');
    expect(screen.getByTestId('btn-close-table')).toBeEnabled();
    expect(screen.getByTestId('bill-back-link')).toHaveAttribute('href', '/staff');
  });

  it('shows the loading state first', async () => {
    billResponse = () => new Promise(() => {});
    renderScreen();
    expect(screen.getByTestId('bill-loading')).toBeInTheDocument();
  });

  it('shows the fetch error with Retry, and Retry fetches again', async () => {
    billResponse = () => json(500, {});
    renderScreen();
    expect(await screen.findByTestId('bill-error')).toHaveTextContent('We cannot load the bill right now.');
    billResponse = () => json(200, closableBill);
    await userEvent.click(screen.getByTestId('bill-retry'));
    expect(await screen.findByTestId('bill-order-15')).toBeInTheDocument();
    expect(screen.queryByTestId('bill-error')).toBeNull();
  });

  it('an empty bill shows Close table disabled with the "no orders" note', async () => {
    billResponse = () =>
      json(200, { table_id: 5, orders: [], combined_total_cents: 0, close_available: false, blocking_orders: [] });
    renderScreen();
    expect(await screen.findByTestId('open-orders-note')).toHaveTextContent('This table has no orders to close.');
    expect(screen.getByTestId('btn-close-table')).toBeDisabled();
    expect(screen.getByTestId('bill-combined-total')).toHaveTextContent('$0.00');
  });

  it('Close table asks to confirm, then posts the close and goes to /staff', async () => {
    renderScreen();
    const modal = await openConfirm();
    expect(modal).toHaveTextContent('Close Table 5?');
    expect(modal).toHaveTextContent('Combined total: $31.50');
    await userEvent.click(screen.getByTestId('confirm-modal-confirm'));
    expect(await screen.findByTestId('board-page')).toBeInTheDocument();
    const post = fetchMock.mock.calls.find((c) => c[1]?.method === 'POST');
    expect(post?.[0]).toBe('/api/tables/5/close');
  });

  it('Cancel in the confirmation sends nothing', async () => {
    renderScreen();
    await openConfirm();
    await userEvent.click(screen.getByTestId('confirm-modal-cancel'));
    expect(screen.queryByTestId('confirm-modal')).toBeNull();
    expect(fetchMock.mock.calls.some((c) => c[1]?.method === 'POST')).toBe(false);
  });

  it('CLOSE_BLOCKED shows its banner, fetches the bill again and shows the blocking order with Close table disabled', async () => {
    const blockedBill: Bill = {
      ...closableBill,
      orders: [
        ...closableBill.orders,
        { order_number: 20, status: 'Pending', placed_at: '2026-11-05T19:30:00', lines: [line], subtotal_cents: 2100 },
      ],
      combined_total_cents: 5250,
      close_available: false,
      blocking_orders: [20],
    };
    closeResponse = () => {
      // A new order arrived just before the close: the next bill read shows it.
      billResponse = () => json(200, blockedBill);
      return json(422, { error: { code: 'CLOSE_BLOCKED', message: 'x', details: { blocking_orders: [20] } } });
    };
    renderScreen();
    await openConfirm();
    const billFetchesBefore = fetchMock.mock.calls.filter((c) => c[1]?.method !== 'POST').length;
    await userEvent.click(screen.getByTestId('confirm-modal-confirm'));

    expect(await screen.findByTestId('close-error-banner')).toHaveTextContent(
      'Close table is not available until every order is completed or cancelled.'
    );
    expect(screen.getByTestId('table-bill-screen')).toBeInTheDocument();
    await waitFor(() =>
      expect(fetchMock.mock.calls.filter((c) => c[1]?.method !== 'POST').length).toBe(billFetchesBefore + 1)
    );
    await waitFor(() => expect(screen.getByTestId('btn-close-table')).toBeDisabled());
    expect(screen.getByTestId('open-orders-note')).toHaveTextContent('One or more orders still open: #20');
    expect(screen.getByTestId('bill-order-20')).toBeInTheDocument();
  });

  it.each([
    ['CLOSE_BLOCKED', 422],
    ['TABLE_EMPTY', 422],
    ['INTERNAL_ERROR', 500],
  ])('after a failed close (%s) keyboard focus moves to the error banner', async (code, status) => {
    closeResponse = () => json(status, { error: { code, message: 'x' } });
    renderScreen();
    await openConfirm();
    await userEvent.click(screen.getByTestId('confirm-modal-confirm'));
    const banner = await screen.findByTestId('close-error-banner');
    expect(banner).toHaveAttribute('tabindex', '-1');
    await waitFor(() => expect(document.activeElement).toBe(banner));
  });

  it('TABLE_EMPTY shows its banner', async () => {
    closeResponse = () => json(422, { error: { code: 'TABLE_EMPTY', message: 'x' } });
    renderScreen();
    await openConfirm();
    await userEvent.click(screen.getByTestId('confirm-modal-confirm'));
    expect(await screen.findByTestId('close-error-banner')).toHaveTextContent('This table has no orders to close.');
  });

  it('TABLE_ALREADY_CLOSED goes to /staff', async () => {
    closeResponse = () => json(409, { error: { code: 'TABLE_ALREADY_CLOSED', message: 'x' } });
    renderScreen();
    await openConfirm();
    await userEvent.click(screen.getByTestId('confirm-modal-confirm'));
    expect(await screen.findByTestId('board-page')).toBeInTheDocument();
  });

  it('any other failure shows a retryable error and re-enables the button', async () => {
    closeResponse = () => json(500, { error: { code: 'INTERNAL_ERROR', message: 'x' } });
    renderScreen();
    await openConfirm();
    await userEvent.click(screen.getByTestId('confirm-modal-confirm'));
    expect(await screen.findByTestId('close-error-banner')).toHaveTextContent('We could not close the table');
    expect(screen.getByTestId('btn-close-table')).toBeEnabled();
  });

  it('a live status event for this table fetches the bill again', async () => {
    renderScreen();
    await screen.findByTestId('bill-order-15');
    const before = fetchMock.mock.calls.length;
    act(() => MockEventSource.instance!.triggerMessage('ORDER_STATUS_CHANGED', { order_number: 15, table_id: 5, status: 'Completed' }));
    await waitFor(() => expect(fetchMock.mock.calls.length).toBe(before + 1));
  });

  it('a TABLE_CLOSED event for this table goes to /staff', async () => {
    renderScreen();
    await screen.findByTestId('bill-order-15');
    act(() => MockEventSource.instance!.triggerMessage('TABLE_CLOSED', { table_id: 5, archived_visit_id: 'v-1' }));
    expect(await screen.findByTestId('board-page')).toBeInTheDocument();
  });
});
