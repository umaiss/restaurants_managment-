// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CloseTableSection from '../CloseTableSection';

afterEach(cleanup);

describe('CloseTableSection', () => {
  it('is disabled with a note that lists the open orders', () => {
    render(<CloseTableSection closeAvailable={false} blockingOrders={[15, 18]} empty={false} onClose={() => {}} />);
    const button = screen.getByTestId('btn-close-table');
    expect(button).toBeDisabled();
    expect(button).not.toHaveAttribute('aria-disabled');
    expect(screen.getByTestId('open-orders-note')).toHaveTextContent('One or more orders still open: #15, #18');
  });

  it('is disabled with the "no orders" note when the table has none', () => {
    render(<CloseTableSection closeAvailable={false} blockingOrders={[]} empty onClose={() => {}} />);
    expect(screen.getByTestId('btn-close-table')).toBeDisabled();
    expect(screen.getByTestId('open-orders-note')).toHaveTextContent('This table has no orders to close.');
  });

  it('is enabled with no note when closing is available', async () => {
    const onClose = vi.fn();
    render(<CloseTableSection closeAvailable blockingOrders={[]} empty={false} onClose={onClose} />);
    const button = screen.getByTestId('btn-close-table');
    expect(button).toBeEnabled();
    expect(screen.queryByTestId('open-orders-note')).toBeNull();
    await userEvent.click(button);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('is disabled while a close request is in flight', () => {
    render(<CloseTableSection closeAvailable blockingOrders={[]} empty={false} busy onClose={() => {}} />);
    expect(screen.getByTestId('btn-close-table')).toBeDisabled();
  });

  it('does not call onClose when disabled', async () => {
    const onClose = vi.fn();
    render(<CloseTableSection closeAvailable={false} blockingOrders={[3]} empty={false} onClose={onClose} />);
    await userEvent.click(screen.getByTestId('btn-close-table'));
    expect(onClose).not.toHaveBeenCalled();
  });
});
