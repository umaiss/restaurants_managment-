// @vitest-environment jsdom
/// <reference types="vitest/globals" />
// U7 Step 11: option lines under each item on a ticket and on the bill, and the frozen price (BR2.3, BR9.1, BR9.2).
import React from 'react';
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import OrderCard from '../OrderCard';
import BillOrderCard from '../BillOrderCard';
import type { Order } from '../../../hooks/useBoardOrders';
import type { BillOrder } from '../../../hooks/useBill';

afterEach(cleanup);

const opts = [{ label: 'Large', price_delta_cents: 300 }, { label: 'Extra cheese', price_delta_cents: 100 }, { label: 'No onions', price_delta_cents: 0 }];

describe('options on a ticket (BR2.3)', () => {
  const order = (lines: Order['lines']): Order => ({ order_number: 12, status: 'Preparing', placed_at: new Date().toISOString(), table_id: 5, visit_id: 'v', lines, subtotal_cents: 0 });

  it('shows the chosen options under the item name, in the order chosen', () => {
    render(<OrderCard order={order([{ menu_item_id: 'i-04', name: 'Classic Burger', quantity: 1, price_cents_each: 1750, subtotal_cents: 1750, options: opts }])} />);
    expect(screen.getByText('Classic Burger')).toBeInTheDocument();
    expect(screen.getByTestId('line-options-12-0')).toHaveTextContent('Large, Extra cheese, No onions');
  });

  it('a line with no options, or no options field (a v1-era order), shows nothing extra', () => {
    render(<OrderCard order={order([{ menu_item_id: 'a', name: 'Garlic Bread', quantity: 2, price_cents_each: 650, subtotal_cents: 1300, options: [] }, { menu_item_id: 'b', name: 'Soup', quantity: 1, price_cents_each: 500, subtotal_cents: 500 }])} />);
    expect(screen.queryByTestId('line-options-12-0')).toBeNull();
    expect(screen.queryByTestId('line-options-12-1')).toBeNull();
    expect(screen.getByText('Garlic Bread')).toBeInTheDocument();
  });

  it('shows option text as text, never as markup', () => {
    render(<OrderCard order={order([{ menu_item_id: 'a', name: 'X', quantity: 1, price_cents_each: 1, subtotal_cents: 1, options: [{ label: '<b>Hot</b>', price_delta_cents: 0 }] }])} />);
    expect(screen.getByTestId('line-options-12-0')).toHaveTextContent('<b>Hot</b>');
    expect(screen.getByTestId('line-options-12-0').querySelector('b')).toBeNull();
  });

  it('v1\'s words stay: Start preparing, Mark completed and Cancel', () => {
    render(<OrderCard order={{ ...order([]), status: 'Pending' }} />);
    expect(screen.getByTestId('btn-preparing-12')).toHaveTextContent('Start preparing');
    expect(screen.getByTestId('btn-cancel-12')).toHaveTextContent('Cancel');
  });
});

describe('options on the bill (BR9.1, BR9.2)', () => {
  const bill = (lines: BillOrder['lines']): BillOrder => ({ order_number: 12, status: 'Completed', placed_at: new Date().toISOString(), lines, subtotal_cents: lines.reduce((s, l) => s + l.subtotal_cents, 0) });

  it('shows the options under the item name and the frozen line price, which already includes them', () => {
    render(<BillOrderCard order={bill([{ menu_item_id: 'i-04', name: 'Classic Burger', quantity: 1, price_cents_each: 1850, subtotal_cents: 1850, options: opts }])} />);
    expect(screen.getByTestId('bill-line-options-12-0')).toHaveTextContent('Large, Extra cheese, No onions');
    expect(screen.getAllByText('$18.50').length).toBeGreaterThan(0);
  });

  it('a line with none shows nothing extra', () => {
    render(<BillOrderCard order={bill([{ menu_item_id: 'a', name: 'Sparkling Water', quantity: 2, price_cents_each: 350, subtotal_cents: 700 }])} />);
    expect(screen.queryByTestId('bill-line-options-12-0')).toBeNull();
    expect(screen.getByText('Sparkling Water', { exact: false })).toBeInTheDocument();
  });

  it('shows option text as text', () => {
    render(<BillOrderCard order={bill([{ menu_item_id: 'a', name: 'X', quantity: 1, price_cents_each: 1, subtotal_cents: 1, options: [{ label: '<img src=x>', price_delta_cents: 0 }] }])} />);
    expect(screen.getByTestId('bill-line-options-12-0')).toHaveTextContent('<img src=x>');
    expect(document.querySelector('img')).toBeNull();
  });
});
