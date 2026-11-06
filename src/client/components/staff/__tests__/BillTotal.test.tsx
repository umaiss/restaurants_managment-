// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import BillTotal from '../BillTotal';

afterEach(cleanup);

describe('BillTotal', () => {
  it('shows the Combined total label and the amount', () => {
    render(<BillTotal totalCents={3500} />);
    expect(screen.getByText('Combined total')).toBeInTheDocument();
    expect(screen.getByTestId('bill-combined-total')).toHaveTextContent('$35.00');
  });

  it('shows $0.00 for an empty bill', () => {
    render(<BillTotal totalCents={0} />);
    expect(screen.getByTestId('bill-combined-total')).toHaveTextContent('$0.00');
  });

  it('keeps cents with two digits', () => {
    render(<BillTotal totalCents={1050} />);
    expect(screen.getByTestId('bill-combined-total')).toHaveTextContent('$10.50');
  });
});
