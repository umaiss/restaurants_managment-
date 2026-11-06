// @vitest-environment jsdom
/// <reference types="vitest/globals" />
import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import OrderCard from '../OrderCard';
import type { Order } from '../../../hooks/useBoardOrders';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function makeOrder(overrides: Partial<Order> = {}): Order {
  return {
    order_number: 1,
    status: 'Pending',
    placed_at: '2026-01-01T12:00:00.000Z',
    table_id: 1,
    visit_id: 'v-1',
    lines: [
      { menu_item_id: 'i-01', name: 'Burger', quantity: 2, price_cents_each: 1000, subtotal_cents: 2000 },
    ],
    subtotal_cents: 2000,
    isNew: false,
    ...overrides,
  };
}

function setupFetchMock(opts: { fail?: boolean; status422?: boolean } = {}) {
  vi.stubGlobal('fetch', vi.fn(() => {
    if (opts.status422) {
      return Promise.resolve({ ok: false, status: 422, json: () => Promise.resolve({}) });
    }
    if (opts.fail) {
      return Promise.reject(new Error('Network error'));
    }
    return Promise.resolve({ ok: true, json: () => Promise.resolve({ order_number: 1, status: 'Preparing' }) });
  }));
}

describe('OrderCard', () => {
  it('renders order number, status pill, and line items', () => {
    render(<OrderCard order={makeOrder()} />);
    expect(screen.getByText('#1')).toBeTruthy();
    expect(screen.getByText('Pending')).toBeTruthy();
    expect(screen.getByText('Burger')).toBeTruthy();
    expect(screen.getByText('×2')).toBeTruthy();
  });

  it('"Start preparing" button present for Pending orders', () => {
    render(<OrderCard order={makeOrder({ status: 'Pending' })} />);
    expect(screen.getByTestId('btn-preparing-1')).toBeTruthy();
    expect(screen.queryByTestId('btn-complete-1')).toBeNull();
  });

  it('"Mark completed" button present for Preparing orders', () => {
    render(<OrderCard order={makeOrder({ status: 'Preparing' })} />);
    expect(screen.getByTestId('btn-complete-1').textContent).toBe('Mark completed');
    expect(screen.queryByTestId('btn-preparing-1')).toBeNull();
  });

  it('no action buttons for Completed orders', () => {
    render(<OrderCard order={makeOrder({ status: 'Completed' })} />);
    expect(screen.queryByTestId('btn-preparing-1')).toBeNull();
    expect(screen.queryByTestId('btn-complete-1')).toBeNull();
  });

  it('button click sends POST to transition endpoint and disables button during flight', async () => {
    setupFetchMock();
    const onStatusChange = vi.fn();
    render(<OrderCard order={makeOrder({ status: 'Pending' })} onStatusChange={onStatusChange} />);
    const btn = screen.getByTestId('btn-preparing-1');
    fireEvent.click(btn);
    // Button becomes disabled while in flight
    expect((btn as HTMLButtonElement).disabled).toBe(true);
    await waitFor(() => expect(onStatusChange).toHaveBeenCalledWith(1, 'Preparing'));
  });

  it('NewHighlight is active for Pending+isNew orders, inactive otherwise', () => {
    const { rerender } = render(<OrderCard order={makeOrder({ status: 'Pending', isNew: true })} />);
    const nh = screen.getByTestId('new-highlight');
    expect(nh.getAttribute('data-active')).toBe('true');

    rerender(<OrderCard order={makeOrder({ status: 'Preparing', isNew: false })} />);
    const nh2 = screen.getByTestId('new-highlight');
    expect(nh2.getAttribute('data-active')).toBe('false');
  });

  it('shows inline error on 422 response', async () => {
    setupFetchMock({ status422: true });
    render(<OrderCard order={makeOrder({ status: 'Pending' })} />);
    fireEvent.click(screen.getByTestId('btn-preparing-1'));
    await waitFor(() =>
      expect(screen.getByText(/no longer possible/i)).toBeTruthy()
    );
  });

  it('regression: a Pending order already on the board when it loads is highlighted "★ New"', () => {
    render(<OrderCard order={makeOrder({ status: 'Pending', isNew: false })} />);
    const nh = screen.getByTestId('new-highlight');
    expect(nh.getAttribute('data-active')).toBe('true');
    expect(screen.getByText('★ New')).toBeTruthy();
  });

  it('NewHighlight is off once the order is Preparing, even if it arrived as new', () => {
    render(<OrderCard order={makeOrder({ status: 'Preparing', isNew: true })} />);
    const nh = screen.getByTestId('new-highlight');
    expect(nh.getAttribute('data-active')).toBe('false');
  });

  // Fix 2: Cancel button
  it('Cancel button present for Pending orders', () => {
    render(<OrderCard order={makeOrder({ status: 'Pending' })} />);
    expect(screen.getByTestId('btn-cancel-1')).toBeTruthy();
  });

  it('Cancel button present for Preparing orders', () => {
    render(<OrderCard order={makeOrder({ status: 'Preparing' })} />);
    expect(screen.getByTestId('btn-cancel-1')).toBeTruthy();
  });

  it('Cancel button absent for Completed orders', () => {
    render(<OrderCard order={makeOrder({ status: 'Completed' })} />);
    expect(screen.queryByTestId('btn-cancel-1')).toBeNull();
  });

  it('Cancel confirmation modal appears and calls transition on confirm', async () => {
    setupFetchMock();
    const onStatusChange = vi.fn();
    render(<OrderCard order={makeOrder({ status: 'Pending' })} onStatusChange={onStatusChange} />);
    fireEvent.click(screen.getByTestId('btn-cancel-1'));
    expect(screen.getByTestId('cancel-confirm-1')).toBeTruthy();
    expect(screen.getByText(/Cancel order #1\?/)).toBeTruthy();
    fireEvent.click(screen.getByTestId('btn-cancel-confirm-1'));
    await waitFor(() => expect(onStatusChange).toHaveBeenCalledWith(1, 'Cancelled'));
  });

  it('Cancel confirmation modal dismisses on "Keep it"', () => {
    render(<OrderCard order={makeOrder({ status: 'Pending' })} />);
    fireEvent.click(screen.getByTestId('btn-cancel-1'));
    expect(screen.getByTestId('cancel-confirm-1')).toBeTruthy();
    fireEvent.click(screen.getByTestId('btn-cancel-keep-1'));
    expect(screen.queryByTestId('cancel-confirm-1')).toBeNull();
  });
});
