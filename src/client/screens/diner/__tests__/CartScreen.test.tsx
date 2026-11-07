/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import React from 'react';
import CartScreen from '../CartScreen.js';

const TABLE_ID = 'table-7';

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
    render(<CartScreen tableId={TABLE_ID} />);
    expect(screen.getByTestId('cart-empty')).toBeInTheDocument();
    const btn = screen.getByTestId('place-order-button');
    expect(btn).toBeDisabled();
  });

  it('shows cart lines and total with items', () => {
    seedCart();
    render(<CartScreen tableId={TABLE_ID} />);
    expect(screen.getByText('Burger')).toBeInTheDocument();
    expect(screen.getByText('Fries')).toBeInTheDocument();
    // Total = 2 * 1050 + 1 * 450 = 2550 cents = $25.50
    expect(screen.getByTestId('cart-total')).toHaveTextContent('$25.50');
  });

  it('Place order tap opens ConfirmModal', () => {
    seedCart();
    render(<CartScreen tableId={TABLE_ID} />);
    const btn = screen.getByTestId('place-order-button');
    expect(btn).not.toBeDisabled();
    fireEvent.click(btn);
    expect(screen.getByTestId('confirm-modal')).toBeInTheDocument();
  });

  it('confirms order: POSTs to API, clears cart and hands the order to the parent (which shows the confirmation)', async () => {
    seedCart();
    const onOrderPlaced = vi.fn();
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 201,
        json: async () => ({ order_number: 42 }),
      } as Response)
    );

    render(<CartScreen tableId={TABLE_ID} onOrderPlaced={onOrderPlaced} />);
    fireEvent.click(screen.getByTestId('place-order-button'));
    fireEvent.click(screen.getByTestId('confirm-modal-confirm'));

    await waitFor(() => expect(onOrderPlaced).toHaveBeenCalledWith({ orderNumber: 42, droppedLines: [] }));
    // Cart should be cleared
    const stored = JSON.parse(localStorage.getItem(`cart:table:${TABLE_ID}`) ?? '[]');
    expect(stored).toHaveLength(0);
    // The confirmation banners live in TableView, not on this screen
    expect(screen.queryByTestId('order-success-banner')).toBeNull();
    expect(screen.queryByTestId('order-partial-banner')).toBeNull();
  });

  it('hands over the existing order when the server answers a repeated placement_key with 200', async () => {
    seedCart();
    const onOrderPlaced = vi.fn();
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ order_number: 10, dropped_lines: [] }),
      } as Response)
    );

    render(<CartScreen tableId={TABLE_ID} onOrderPlaced={onOrderPlaced} />);
    fireEvent.click(screen.getByTestId('place-order-button'));
    fireEvent.click(screen.getByTestId('confirm-modal-confirm'));

    await waitFor(() => expect(onOrderPlaced).toHaveBeenCalledWith({ orderNumber: 10, droppedLines: [] }));
  });

  it('regression: Place order works for a cart restored with no placement key (a new tab)', async () => {
    seedCart();
    sessionStorage.removeItem(`cart-placement-key:${TABLE_ID}`);
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => ({ order_number: 51 }),
    } as Response);
    vi.stubGlobal('fetch', fetchMock);

    render(<CartScreen tableId={TABLE_ID} />);
    fireEvent.click(screen.getByTestId('place-order-button'));
    fireEvent.click(screen.getByTestId('confirm-modal-confirm'));

    // Opening the cart also reads the menu (GET); only the order request is a POST.
    const posts = () => fetchMock.mock.calls.filter((c) => (c[1] as RequestInit | undefined)?.method === 'POST');
    await waitFor(() => expect(posts()).toHaveLength(1));
    const body = JSON.parse((posts()[0][1] as RequestInit).body as string);
    expect(typeof body.placement_key).toBe('string');
    expect(body.placement_key.length).toBeGreaterThan(0);
  });

  it("regression: a sold-out line is named from the cart when the server sends { menu_item_id, reason }", async () => {
    seedCart();
    const onOrderPlaced = vi.fn();
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 201,
        json: async () => ({
          order_number: 52,
          dropped_lines: [{ menu_item_id: 'i-02', reason: 'SOLD_OUT_AT_SUBMIT' }],
        }),
      } as Response)
    );

    render(<CartScreen tableId={TABLE_ID} onOrderPlaced={onOrderPlaced} />);
    fireEvent.click(screen.getByTestId('place-order-button'));
    fireEvent.click(screen.getByTestId('confirm-modal-confirm'));

    await waitFor(() => expect(onOrderPlaced).toHaveBeenCalled());
    expect(onOrderPlaced).toHaveBeenCalledWith({
      orderNumber: 52,
      droppedLines: [{ menu_item_id: 'i-02', name: 'Fries', quantity: 1 }],
    });
  });

  it("regression: the server's own error message is shown", async () => {
    seedCart();
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        json: async () => ({ error: { code: 'INVALID_QUANTITY', message: 'quantity must be from 1 to 20' } }),
      } as Response)
    );

    render(<CartScreen tableId={TABLE_ID} />);
    fireEvent.click(screen.getByTestId('place-order-button'));
    fireEvent.click(screen.getByTestId('confirm-modal-confirm'));

    await waitFor(() => expect(screen.getByTestId('order-error-banner')).toHaveTextContent('quantity must be from 1 to 20'));
  });

  it('empty cart offers "Back to menu"; a filled cart offers "Clear all"', () => {
    const onBackToMenu = vi.fn();
    const { unmount } = render(<CartScreen tableId={TABLE_ID} onBackToMenu={onBackToMenu} />);
    expect(screen.getByText('Browse the menu to get started')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('back-to-menu'));
    expect(onBackToMenu).toHaveBeenCalled();
    unmount();

    seedCart();
    render(<CartScreen tableId={TABLE_ID} />);
    expect(screen.getByText('Your cart')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('clear-cart'));
    expect(screen.getByTestId('cart-empty')).toBeInTheDocument();
  });

  it('a line cannot go above 20', () => {
    seedCart();
    localStorage.setItem(
      `cart:table:${TABLE_ID}`,
      JSON.stringify([{ menuItemId: 'i-01', name: 'Burger', priceCents: 1050, quantity: 20 }])
    );
    render(<CartScreen tableId={TABLE_ID} />);
    fireEvent.click(screen.getByTestId('cart-increase-i-01'));
    expect(screen.getByTestId('cart-qty-i-01')).toHaveTextContent('20');
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

    render(<CartScreen tableId={TABLE_ID} />);
    fireEvent.click(screen.getByTestId('place-order-button'));
    fireEvent.click(screen.getByTestId('confirm-modal-confirm'));

    await waitFor(() => {
      expect(screen.getByTestId('order-error-banner')).toBeInTheDocument();
    });

    expect(screen.getByTestId('place-order-button')).not.toBeDisabled();
  });

  describe('prices are checked against the current menu when the cart opens', () => {
    function stubMenu(items: Array<{ id: string; name: string; price_cents: number }>) {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ items, categories: [] }) } as Response)
      );
    }

    it('regression: a price that changed after the item was added is refreshed, so the total matches the server', async () => {
      seedCart(); // Burger 2 x $10.50 and Fries 1 x $4.50 saved at the old prices
      stubMenu([
        { id: 'i-01', name: 'Burger', price_cents: 1200 },
        { id: 'i-02', name: 'Fries', price_cents: 450 },
      ]);
      render(<CartScreen tableId={TABLE_ID} />);

      // 2 x 12.00 + 4.50 = 28.50
      await waitFor(() => expect(screen.getByTestId('cart-total')).toHaveTextContent('$28.50'));
      expect(screen.getByTestId('cart-refresh-notice')).toHaveTextContent('Some prices changed');
      const stored = JSON.parse(localStorage.getItem(`cart:table:${TABLE_ID}`) ?? '[]');
      expect(stored.find((l: { menuItemId: string }) => l.menuItemId === 'i-01').priceCents).toBe(1200);
    });

    it('drops a line whose item is no longer on the menu and says so', async () => {
      seedCart();
      stubMenu([{ id: 'i-01', name: 'Burger', price_cents: 1050 }]);
      render(<CartScreen tableId={TABLE_ID} />);

      await waitFor(() => expect(screen.queryByTestId('cart-item-i-02')).toBeNull());
      expect(screen.getByTestId('cart-total')).toHaveTextContent('$21.00');
      expect(screen.getByTestId('cart-refresh-notice')).toHaveTextContent('Fries');
    });

    it('shows no notice when nothing changed', async () => {
      seedCart();
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          items: [
            { id: 'i-01', name: 'Burger', price_cents: 1050 },
            { id: 'i-02', name: 'Fries', price_cents: 450 },
          ],
        }),
      } as Response);
      vi.stubGlobal('fetch', fetchMock);
      render(<CartScreen tableId={TABLE_ID} />);

      await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/menu'));
      expect(screen.queryByTestId('cart-refresh-notice')).toBeNull();
      expect(screen.getByTestId('cart-total')).toHaveTextContent('$25.50');
    });

    it('keeps the cart as it is when the menu cannot be loaded', async () => {
      seedCart();
      const fetchMock = vi.fn().mockRejectedValue(new Error('offline'));
      vi.stubGlobal('fetch', fetchMock);
      render(<CartScreen tableId={TABLE_ID} />);

      await waitFor(() => expect(fetchMock).toHaveBeenCalled());
      expect(screen.getByTestId('cart-total')).toHaveTextContent('$25.50');
      expect(screen.queryByTestId('cart-refresh-notice')).toBeNull();
    });
  });
});
