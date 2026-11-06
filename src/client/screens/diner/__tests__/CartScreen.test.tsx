/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import React from 'react';
import CartScreen from '../CartScreen.js';

const TABLE_ID = 'table-7';
const VISIT_ID = 'visit-abc';

function seedCart(tableId = TABLE_ID) {
  const items = [
    { menuItemId: 'i-01', name: 'Burger', priceCents: 1050, quantity: 2 },
    { menuItemId: 'i-02', name: 'Fries', priceCents: 450, quantity: 1 },
  ];
  localStorage.setItem(`cart:table:${tableId}`, JSON.stringify(items));
  sessionStorage.setItem(`cart-placement-key:${tableId}`, 'pk-test-123');
}

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('CartScreen', () => {
  it('shows empty state and disables Place order when cart is empty', () => {
    render(<CartScreen tableId={TABLE_ID} visitId={VISIT_ID} />);
    expect(screen.getByTestId('cart-empty')).toBeInTheDocument();
    const btn = screen.getByTestId('place-order-button');
    expect(btn).toBeDisabled();
  });

  it('shows cart lines and total with items', () => {
    seedCart();
    render(<CartScreen tableId={TABLE_ID} visitId={VISIT_ID} />);
    expect(screen.getByText('Burger')).toBeInTheDocument();
    expect(screen.getByText('Fries')).toBeInTheDocument();
    // Total = 2 * 1050 + 1 * 450 = 2550 cents = $25.50
    expect(screen.getByTestId('cart-total')).toHaveTextContent('$25.50');
  });

  it('Place order tap opens ConfirmModal', () => {
    seedCart();
    render(<CartScreen tableId={TABLE_ID} visitId={VISIT_ID} />);
    const btn = screen.getByTestId('place-order-button');
    expect(btn).not.toBeDisabled();
    fireEvent.click(btn);
    expect(screen.getByTestId('confirm-modal')).toBeInTheDocument();
  });

  it('confirms order: POSTs to API, clears cart, shows success banner', async () => {
    seedCart();
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 201,
        json: async () => ({ order_number: 42 }),
      } as Response)
    );

    render(<CartScreen tableId={TABLE_ID} visitId={VISIT_ID} />);
    fireEvent.click(screen.getByTestId('place-order-button'));
    fireEvent.click(screen.getByTestId('confirm-modal-confirm'));

    await waitFor(() => {
      expect(screen.getByTestId('order-success-banner')).toBeInTheDocument();
    });

    expect(screen.getByTestId('order-success-banner')).toHaveTextContent('Order placed! #42');
    // Cart should be cleared
    const stored = JSON.parse(localStorage.getItem(`cart:table:${TABLE_ID}`) ?? '[]');
    expect(stored).toHaveLength(0);
  });

  it('shows the existing order when the server answers a repeated placement_key with 200', async () => {
    seedCart();
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ order_number: 10, dropped_lines: [] }),
      } as Response)
    );

    render(<CartScreen tableId={TABLE_ID} visitId={VISIT_ID} />);
    fireEvent.click(screen.getByTestId('place-order-button'));
    fireEvent.click(screen.getByTestId('confirm-modal-confirm'));

    await waitFor(() => {
      expect(screen.getByTestId('order-success-banner')).toBeInTheDocument();
    });

    expect(screen.getByTestId('order-success-banner')).toHaveTextContent('#10');
  });

  it('shows error banner on API error and re-enables Place order', async () => {
    seedCart();
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        json: async () => ({ message: 'Server error' }),
      } as Response)
    );

    render(<CartScreen tableId={TABLE_ID} visitId={VISIT_ID} />);
    fireEvent.click(screen.getByTestId('place-order-button'));
    fireEvent.click(screen.getByTestId('confirm-modal-confirm'));

    await waitFor(() => {
      expect(screen.getByTestId('order-error-banner')).toBeInTheDocument();
    });

    expect(screen.getByTestId('place-order-button')).not.toBeDisabled();
  });
});
