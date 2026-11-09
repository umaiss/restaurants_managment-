// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import ReceiptFeature from '../receipt/index';

const receipt = {
  visit_id: 'v-1',
  table_id: 5,
  table_label: 'Table 5',
  opened_at: '2026-11-09T18:00:00.000Z',
  closed_at: '2026-11-09T19:00:00.000Z',
  orders: [
    {
      order_number: 3,
      status: 'Completed',
      placed_at: '2026-11-09T18:05:00.000Z',
      subtotal_cents: 2900,
      lines: [{ menu_item_id: 'i-04', name: 'Classic Burger', quantity: 2, price_cents_each: 1450, subtotal_cents: 2900 }],
    },
  ],
  total_cents: 2900,
  payment_method: 'cash',
};

function stub(body: unknown, status = 200) {
  const mock = vi.fn(async (_url: string) => ({ ok: status < 400, status, json: async () => body }));
  vi.stubGlobal('fetch', mock);
  return mock;
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('the diner receipt on the table-closed screen', () => {
  it('shows the receipt at once, with a print button, when the diner asked for one at the bill', async () => {
    const mock = stub({ ...receipt, receipt_requested: true });
    const print = vi.fn();
    vi.stubGlobal('print', print);
    render(<ReceiptFeature tableId="5" />);
    expect(await screen.findByTestId('receipt-card')).toBeInTheDocument();
    expect(screen.getByTestId('receipt-total')).toHaveTextContent('$29.00');
    expect(screen.getByTestId('receipt-payment')).toHaveTextContent('Paid by: Cash');
    expect(mock.mock.calls[0][0]).toBe('/api/tables/5/receipt');
    fireEvent.click(screen.getByTestId('diner-receipt-print'));
    expect(print).toHaveBeenCalledTimes(1);
  });

  it('keeps the receipt behind "View receipt" when the diner did not ask for one', async () => {
    stub({ ...receipt, receipt_requested: false });
    render(<ReceiptFeature tableId="5" />);
    const view = await screen.findByTestId('diner-receipt-view');
    expect(screen.queryByTestId('receipt-card')).toBeNull();
    fireEvent.click(view);
    expect(screen.getByTestId('receipt-card')).toBeInTheDocument();
  });

  it('shows nothing when there is no receipt to read', async () => {
    const mock = stub({ error: { code: 'NO_CLOSED_VISIT' } }, 404);
    const { container } = render(<ReceiptFeature tableId="5" />);
    await waitFor(() => expect(mock).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });
});
