// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import ReceiptScreen from '../ReceiptScreen';

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
      lines: [
        { menu_item_id: 'i-04', name: 'Classic Burger', quantity: 2, price_cents_each: 1450, subtotal_cents: 2900, options: [{ label: 'Large', price_delta_cents: 0 }] },
      ],
    },
  ],
  total_cents: 2900,
  payment_method: 'card',
};

function renderScreen() {
  return render(
    <MemoryRouter initialEntries={['/staff/receipt/v-1']}>
      <Routes>
        <Route path="/staff/receipt/:visitId" element={<ReceiptScreen />} />
      </Routes>
    </MemoryRouter>
  );
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('ReceiptScreen', () => {
  it('shows the table, the lines with their options, the total and how the table paid, and prints on request', async () => {
    const fetchMock = vi.fn(async (_url: string) => ({ ok: true, status: 200, json: async () => receipt }));
    vi.stubGlobal('fetch', fetchMock);
    const print = vi.fn();
    vi.stubGlobal('print', print);
    renderScreen();
    expect(await screen.findByTestId('receipt-table')).toHaveTextContent('Table 5');
    expect(screen.getByTestId('receipt-lines')).toHaveTextContent('2 × Classic Burger');
    expect(screen.getByTestId('receipt-lines')).toHaveTextContent('Large');
    expect(screen.getByTestId('receipt-total')).toHaveTextContent('$29.00');
    expect(screen.getByTestId('receipt-payment')).toHaveTextContent('Paid by: Card');
    expect(fetchMock.mock.calls[0][0]).toBe('/api/visits/v-1/receipt');
    await userEvent.click(screen.getByTestId('receipt-print'));
    expect(print).toHaveBeenCalledTimes(1);
  });

  it('says so when the receipt cannot be loaded, and Print stays off', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 404, json: async () => ({}) })));
    renderScreen();
    expect(await screen.findByTestId('receipt-error')).toBeInTheDocument();
    expect(screen.getByTestId('receipt-print')).toBeDisabled();
  });

  it('a payment that was never chosen reads "not recorded"', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ ...receipt, payment_method: null }) })));
    renderScreen();
    expect(await screen.findByTestId('receipt-payment')).toHaveTextContent('Paid by: not recorded');
  });
});
