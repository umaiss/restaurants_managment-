/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup, act, fireEvent } from '@testing-library/react';
import React, { useState } from 'react';
import MyOrdersScreen from '../MyOrdersScreen.js';
import type { SSEEvent } from '../../../hooks/useTableSSE.js';

// ---------------------------------------------------------------------------
// Seed data
// ---------------------------------------------------------------------------

const PENDING_ORDER = {
  order_number: 1,
  status: 'Pending',
  placed_at: new Date().toISOString(),
  lines: [{ menu_item_id: 'i-01', name: 'Burger', quantity: 1, price_cents_each: 1050, subtotal_cents: 1050 }],
};

const PREPARING_ORDER = {
  order_number: 2,
  status: 'Preparing',
  placed_at: new Date().toISOString(),
  lines: [{ menu_item_id: 'i-02', name: 'Fries', quantity: 2, price_cents_each: 450, subtotal_cents: 900 }],
};

function mockFetchOrders(orders: object[]) {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ orders }),
    } as Response)
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

// ---------------------------------------------------------------------------
// Helper: wrapper that lets us push SSE events
// ---------------------------------------------------------------------------

function RenderWithSSE({ initialEvent = null }: { initialEvent?: SSEEvent | null }) {
  const [event, setEvent] = useState<SSEEvent | null>(initialEvent);
  return (
    <>
      <MyOrdersScreen tableId="5" lastSSEEvent={event} />
      <button
        data-testid="trigger-sse"
        onClick={() => setEvent({ type: 'ORDER_STATUS_CHANGED', data: { order_number: 1 } })}
      >
        Trigger SSE
      </button>
    </>
  );
}

describe('MyOrdersScreen', () => {
  it('shows loading shimmer while fetching orders', async () => {
    vi.stubGlobal('fetch', vi.fn().mockReturnValue(new Promise(() => {})));
    render(<MyOrdersScreen tableId="5" lastSSEEvent={null} />);
    expect(screen.getByTestId('orders-loading')).toBeInTheDocument();
  });

  it('regression: line prices use the contract fields and never show $NaN', async () => {
    mockFetchOrders([PREPARING_ORDER]);
    const { container } = render(<MyOrdersScreen tableId="5" lastSSEEvent={null} />);
    await waitFor(() => expect(screen.getByText(/2× Fries/)).toBeInTheDocument());
    expect(container.textContent).toContain('$9.00');
    expect(container.textContent).not.toContain('NaN');
  });

  it('renders orders from API', async () => {
    mockFetchOrders([PENDING_ORDER, PREPARING_ORDER]);
    render(<MyOrdersScreen tableId="5" lastSSEEvent={null} />);

    await waitFor(() => {
      expect(screen.getByTestId('orders-screen')).toBeInTheDocument();
    });

    expect(screen.getByTestId('order-card-1')).toBeInTheDocument();
    expect(screen.getByTestId('order-card-2')).toBeInTheDocument();
    expect(screen.getByText(/Burger/)).toBeInTheDocument();
    expect(screen.getByText(/Fries/)).toBeInTheDocument();
  });

  it('shows correct status pill for each order status', async () => {
    mockFetchOrders([PENDING_ORDER, PREPARING_ORDER]);
    render(<MyOrdersScreen tableId="5" lastSSEEvent={null} />);

    await waitFor(() => {
      expect(screen.getByTestId('orders-screen')).toBeInTheDocument();
    });

    expect(screen.getByTestId('order-status-1')).toHaveTextContent('Pending');
    expect(screen.getByTestId('order-status-2')).toHaveTextContent('Preparing');
  });

  it('shows empty state when no orders', async () => {
    mockFetchOrders([]);
    render(<MyOrdersScreen tableId="5" lastSSEEvent={null} />);

    await waitFor(() => {
      expect(screen.getByTestId('orders-empty')).toBeInTheDocument();
    });

    expect(screen.getByText('No orders yet')).toBeInTheDocument();
  });

  it('shows Cancelled pill for cancelled orders', async () => {
    const cancelledOrder = { ...PENDING_ORDER, order_number: 99, status: 'Cancelled' };
    mockFetchOrders([PENDING_ORDER, cancelledOrder]);
    render(<MyOrdersScreen tableId="5" lastSSEEvent={null} />);

    await waitFor(() => {
      expect(screen.getByTestId('orders-screen')).toBeInTheDocument();
    });

    expect(screen.getByTestId('order-card-1')).toBeInTheDocument();
    expect(screen.getByTestId('order-card-99')).toBeInTheDocument();
    expect(screen.getByTestId('order-status-99')).toHaveTextContent('Cancelled');
  });

  it('re-fetches orders on ORDER_STATUS_CHANGED SSE event', async () => {
    // First fetch: pending order
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ orders: [PENDING_ORDER] }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ orders: [{ ...PENDING_ORDER, status: 'Preparing' }] }),
      } as Response);

    vi.stubGlobal('fetch', fetchMock);

    render(<RenderWithSSE />);

    await waitFor(() => {
      expect(screen.getByTestId('order-status-1')).toHaveTextContent('Pending');
    });

    // Trigger SSE event
    act(() => {
      screen.getByTestId('trigger-sse').click();
    });

    await waitFor(() => {
      expect(screen.getByTestId('order-status-1')).toHaveTextContent('Preparing');
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('regression: a cancel refused because staff already started the order says so', async () => {
    const preparing = { ...PENDING_ORDER, status: 'Preparing' };
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ orders: [PENDING_ORDER] }) } as Response)
      // The cancel is refused: staff moved the order to Preparing first
      .mockResolvedValueOnce({ ok: false, status: 422, json: async () => ({ error: { code: 'ILLEGAL_TRANSITION' } }) } as Response)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ orders: [preparing] }) } as Response);
    vi.stubGlobal('fetch', fetchMock);

    render(<MyOrdersScreen tableId="5" lastSSEEvent={null} />);
    await waitFor(() => expect(screen.getByTestId('btn-cancel-order-1')).toBeInTheDocument());
    fireEvent.click(screen.getByTestId('btn-cancel-order-1'));
    await act(async () => {
      fireEvent.click(screen.getByTestId('btn-confirm-cancel-1'));
    });

    await waitFor(() => expect(screen.getByTestId('cancel-notice')).toHaveTextContent('can no longer be cancelled'));
    expect(screen.getByTestId('order-status-1')).toHaveTextContent('Preparing');
  });

  it('regression: a network failure while cancelling shows a clear error in that order\'s card', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ orders: [PENDING_ORDER, PREPARING_ORDER] }) } as Response)
      // The cancel request never reaches the server
      .mockRejectedValueOnce(new TypeError('Failed to fetch'));
    vi.stubGlobal('fetch', fetchMock);

    render(<MyOrdersScreen tableId="5" lastSSEEvent={null} />);
    await waitFor(() => expect(screen.getByTestId('btn-cancel-order-1')).toBeInTheDocument());
    fireEvent.click(screen.getByTestId('btn-cancel-order-1'));
    await act(async () => {
      fireEvent.click(screen.getByTestId('btn-confirm-cancel-1'));
    });

    const message = await screen.findByTestId('cancel-error-1');
    expect(message).toHaveTextContent("We couldn't cancel this order. Check your connection and try again.");
    // It sits in the card of the order that failed, the list stays, and the diner can try again
    expect(screen.getByTestId('order-card-1')).toContainElement(message);
    expect(screen.queryByTestId('cancel-error-2')).toBeNull();
    expect(screen.getByTestId('order-status-1')).toHaveTextContent('Pending');
    expect(screen.getByTestId('btn-cancel-order-1')).toBeEnabled();
  });

  it('the cancel error goes away when the diner tries again', async () => {
    const cancelled = { ...PENDING_ORDER, status: 'Cancelled' };
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ orders: [PENDING_ORDER] }) } as Response)
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce({ ok: true, json: async () => ({ order_number: 1, status: 'Cancelled' }) } as Response)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ orders: [cancelled] }) } as Response);
    vi.stubGlobal('fetch', fetchMock);

    render(<MyOrdersScreen tableId="5" lastSSEEvent={null} />);
    await waitFor(() => expect(screen.getByTestId('btn-cancel-order-1')).toBeInTheDocument());
    fireEvent.click(screen.getByTestId('btn-cancel-order-1'));
    await act(async () => {
      fireEvent.click(screen.getByTestId('btn-confirm-cancel-1'));
    });
    await screen.findByTestId('cancel-error-1');

    fireEvent.click(screen.getByTestId('btn-cancel-order-1'));
    await act(async () => {
      fireEvent.click(screen.getByTestId('btn-confirm-cancel-1'));
    });
    await waitFor(() => expect(screen.getByTestId('order-status-1')).toHaveTextContent('Cancelled'));
    expect(screen.queryByTestId('cancel-error-1')).toBeNull();
  });

  it('shows cancel button for Pending orders and completes cancel flow', async () => {
    const cancelledOrder = { ...PENDING_ORDER, status: 'Cancelled' };
    // First fetch: pending order; subsequent fetches (after cancel): cancelled order
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ orders: [PENDING_ORDER] }),
      } as Response)
      // POST /api/orders/1/transition — cancel call
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ order_number: 1, status: 'Cancelled' }),
      } as Response)
      // Re-fetch after cancel
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ orders: [cancelledOrder] }),
      } as Response);

    vi.stubGlobal('fetch', fetchMock);

    render(<MyOrdersScreen tableId="5" lastSSEEvent={null} />);

    // Wait for order to appear
    await waitFor(() => {
      expect(screen.getByTestId('btn-cancel-order-1')).toBeInTheDocument();
    });

    // Click cancel — should show inline confirm
    fireEvent.click(screen.getByTestId('btn-cancel-order-1'));
    expect(screen.getByTestId('cancel-confirm-1')).toBeInTheDocument();

    // Click "Yes, cancel"
    await act(async () => {
      fireEvent.click(screen.getByTestId('btn-confirm-cancel-1'));
    });

    // After cancel, order should show Cancelled status
    await waitFor(() => {
      expect(screen.getByTestId('order-status-1')).toHaveTextContent('Cancelled');
    });
  });

  it('hides cancel confirm when Keep it is clicked', async () => {
    mockFetchOrders([PENDING_ORDER]);
    render(<MyOrdersScreen tableId="5" lastSSEEvent={null} />);

    await waitFor(() => {
      expect(screen.getByTestId('btn-cancel-order-1')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('btn-cancel-order-1'));
    expect(screen.getByTestId('cancel-confirm-1')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('btn-keep-order-1'));
    expect(screen.queryByTestId('cancel-confirm-1')).not.toBeInTheDocument();
    expect(screen.getByTestId('btn-cancel-order-1')).toBeInTheDocument();
  });
});
