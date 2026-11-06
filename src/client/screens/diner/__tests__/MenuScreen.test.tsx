/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import React from 'react';
import MenuScreen from '../MenuScreen.js';

// ---------------------------------------------------------------------------
// Seed data
// ---------------------------------------------------------------------------

const MENU_RESPONSE = {
  categories: [
    { id: 'starters', name: 'Starters', display_order: 1 },
    { id: 'mains', name: 'Mains', display_order: 2 },
    { id: 'desserts', name: 'Desserts', display_order: 3 },
    { id: 'drinks', name: 'Drinks', display_order: 4 },
  ],
  items: [
    { id: 'i-01', name: 'Burger', description: 'Classic beef burger', price_cents: 1050, category: 'Mains', available: true },
    { id: 'i-02', name: 'Fries', description: 'Crispy fries', price_cents: 450, category: 'Starters', available: true },
    { id: 'i-03', name: 'Cake', description: 'Chocolate cake', price_cents: 600, category: 'Desserts', available: false },
    { id: 'i-04', name: 'Cola', description: 'Cold drink', price_cents: 300, category: 'Drinks', available: true },
  ],
};

function mockFetchSuccess() {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: true,
      json: async () => MENU_RESPONSE,
    } as Response)
  );
}

function mockFetchError() {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({}),
    } as Response)
  );
}

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  // Stub IntersectionObserver (not available in jsdom)
  const observerMock = {
    observe: vi.fn(),
    unobserve: vi.fn(),
    disconnect: vi.fn(),
  };
  vi.stubGlobal('IntersectionObserver', vi.fn(() => observerMock));
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('MenuScreen', () => {
  it('shows loading shimmer while fetching menu', async () => {
    // Keep fetch pending
    vi.stubGlobal(
      'fetch',
      vi.fn().mockReturnValue(new Promise(() => {}))
    );

    render(<MenuScreen tableId="5" />);
    expect(screen.getByTestId('menu-loading')).toBeInTheDocument();
  });

  it('renders menu items after successful fetch', async () => {
    mockFetchSuccess();
    render(<MenuScreen tableId="5" />);

    await waitFor(() => {
      expect(screen.getByTestId('menu-screen')).toBeInTheDocument();
    });

    expect(screen.getByText('Burger')).toBeInTheDocument();
    expect(screen.getByText('Fries')).toBeInTheDocument();
    expect(screen.getByText('$10.50')).toBeInTheDocument();
    expect(screen.getByText('$4.50')).toBeInTheDocument();
  });

  it('shows error state and Retry button on fetch failure', async () => {
    mockFetchError();
    render(<MenuScreen tableId="5" />);

    await waitFor(() => {
      expect(screen.getByTestId('menu-error')).toBeInTheDocument();
    });

    expect(screen.getByTestId('menu-retry')).toBeInTheDocument();
    expect(screen.getByText(/failed to load menu/i)).toBeInTheDocument();
  });

  it('retries fetch when Retry button is clicked', async () => {
    mockFetchError();
    render(<MenuScreen tableId="5" />);

    await waitFor(() => {
      expect(screen.getByTestId('menu-retry')).toBeInTheDocument();
    });

    // Switch to success on retry
    mockFetchSuccess();
    fireEvent.click(screen.getByTestId('menu-retry'));

    await waitFor(() => {
      expect(screen.getByTestId('menu-screen')).toBeInTheDocument();
    });
    expect(screen.getByText('Burger')).toBeInTheDocument();
  });

  it('renders category pills', async () => {
    mockFetchSuccess();
    render(<MenuScreen tableId="5" />);

    await waitFor(() => {
      expect(screen.getByTestId('category-pill-bar')).toBeInTheDocument();
    });

    expect(screen.getByTestId('category-pill-starters')).toBeInTheDocument();
    expect(screen.getByTestId('category-pill-mains')).toBeInTheDocument();
    expect(screen.getByTestId('category-pill-desserts')).toBeInTheDocument();
    expect(screen.getByTestId('category-pill-drinks')).toBeInTheDocument();
  });

  it('calls addItem when + Add is tapped', async () => {
    mockFetchSuccess();
    render(<MenuScreen tableId="5" />);

    await waitFor(() => {
      expect(screen.getByTestId('add-item-i-01')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('add-item-i-01'));

    // After adding, the localStorage should have the item
    const stored = JSON.parse(localStorage.getItem('cart:table:5') ?? '[]');
    expect(stored).toHaveLength(1);
    expect(stored[0].menuItemId).toBe('i-01');
  });

  it('shows Sold out pill for unavailable items and no Add button', async () => {
    mockFetchSuccess();
    render(<MenuScreen tableId="5" />);

    await waitFor(() => {
      expect(screen.getByTestId('menu-screen')).toBeInTheDocument();
    });

    // Cake (i-03) is unavailable
    expect(screen.getByText('Sold out')).toBeInTheDocument();
    expect(screen.queryByTestId('add-item-i-03')).not.toBeInTheDocument();
  });

  it('disables Add button at max quantity 20', async () => {
    // Pre-populate cart with 20 of item i-01
    localStorage.setItem(
      'cart:table:5',
      JSON.stringify([{ menuItemId: 'i-01', name: 'Burger', priceCents: 1050, quantity: 20 }])
    );

    mockFetchSuccess();
    render(<MenuScreen tableId="5" />);

    await waitFor(() => {
      expect(screen.getByTestId('add-item-i-01')).toBeInTheDocument();
    });

    const addBtn = screen.getByTestId('add-item-i-01');
    expect(addBtn).toBeDisabled();
    expect(addBtn).toHaveTextContent('Max');
  });
});
