// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup, within } from '@testing-library/react';
import BillOrderCard from '../BillOrderCard';
import { formatMoney, formatPlacedTime } from '../money';
import type { BillOrder } from '../../../hooks/useBill';

afterEach(cleanup);

const order: BillOrder = {
  order_number: 15,
  status: 'Completed',
  placed_at: '2026-11-05T19:04:00',
  lines: [
    { menu_item_id: 'i-04', name: 'Classic Burger', quantity: 2, price_cents_each: 1050, subtotal_cents: 2100, image: '🍔' },
    { menu_item_id: 'i-10', name: 'Sparkling Water', quantity: 1, price_cents_each: 300, subtotal_cents: 300 },
  ],
  subtotal_cents: 2400,
};

describe('BillOrderCard', () => {
  it('shows the order number and the status as icon plus word', () => {
    render(<BillOrderCard order={order} />);
    const card = screen.getByTestId('bill-order-15');
    expect(within(card).getByText('Order #15')).toBeInTheDocument();
    expect(within(card).getByText('Completed')).toBeInTheDocument();
    expect(within(card).getByText('✓')).toBeInTheDocument();
  });

  it('shows every line with quantity, price each and line subtotal', () => {
    render(<BillOrderCard order={order} />);
    const card = screen.getByTestId('bill-order-15');
    expect(card).toHaveTextContent('Classic Burger');
    expect(card).toHaveTextContent('× 2');
    expect(card).toHaveTextContent('$10.50 each');
    expect(card).toHaveTextContent('$21.00');
    expect(card).toHaveTextContent('$3.00 each');
  });

  it('shows the emoji when the line has one', () => {
    render(<BillOrderCard order={order} />);
    expect(screen.getByTestId('bill-order-15')).toHaveTextContent('🍔');
  });

  it('shows the order subtotal', () => {
    render(<BillOrderCard order={order} />);
    const card = screen.getByTestId('bill-order-15');
    expect(card).toHaveTextContent('Subtotal');
    expect(card).toHaveTextContent('$24.00');
  });

  it('shows the Pending and Preparing words with their icons', () => {
    render(
      <>
        <BillOrderCard order={{ ...order, order_number: 1, status: 'Pending' }} />
        <BillOrderCard order={{ ...order, order_number: 2, status: 'Preparing' }} />
      </>
    );
    expect(screen.getByTestId('bill-order-1')).toHaveTextContent('⏳Pending');
    expect(screen.getByTestId('bill-order-2')).toHaveTextContent('🔥Preparing');
  });

  it('shows the placed time', () => {
    render(<BillOrderCard order={order} />);
    expect(screen.getByTestId('bill-order-15')).toHaveTextContent('Placed 7:04pm');
  });
});

describe('money helpers', () => {
  it('formats cents as dollars', () => {
    expect(formatMoney(1050)).toBe('$10.50');
    expect(formatMoney(0)).toBe('$0.00');
    expect(formatMoney(3500)).toBe('$35.00');
    expect(formatMoney(5)).toBe('$0.05');
  });

  it('formats a placed time and tolerates a bad date', () => {
    expect(formatPlacedTime('2026-11-05T00:09:00')).toBe('12:09am');
    expect(formatPlacedTime('nonsense')).toBe('');
  });
});
