// @vitest-environment jsdom
/// <reference types="vitest/globals" />
import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import MenuAvailabilityPanel from '../MenuAvailabilityPanel';

// Mock EventSource so the useStaffSSE hook's SSE connection doesn't fail
class MockEventSource {
  static instance: MockEventSource | null = null;
  listeners: Record<string, Array<(e: MessageEvent) => void>> = {};
  onopen: (() => void) | null = null;
  onerror: (() => void) | null = null;
  constructor() { MockEventSource.instance = this; }
  addEventListener() {}
  removeEventListener() {}
  close() {}
}

const seedItems = [
  { id: 'i-01', category_id: 'c1', name: 'Burger', description: '', image: '', price_cents: 1000, available: true },
  { id: 'i-02', category_id: 'c1', name: 'Fries', description: '', image: '', price_cents: 500, available: false },
];

function setupFetchMock(opts: { failToggle?: boolean } = {}) {
  vi.stubGlobal('fetch', vi.fn((url: string, init?: RequestInit) => {
    if (init?.method === 'POST') {
      if (opts.failToggle) {
        return Promise.resolve({
          ok: false,
          json: () => Promise.resolve({ error: { message: 'Toggle failed' } }),
        });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    }
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve({ categories: [], items: seedItems }),
    });
  }));
}

beforeEach(() => {
  vi.stubGlobal('EventSource', MockEventSource);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('MenuAvailabilityPanel', () => {
  it('regression: each row shows the item picture and "On" or "Sold out" beside its switch, as the mockup does', async () => {
    seedItems[0].image = '🍔';
    seedItems[1].image = '🍟';
    try {
      setupFetchMock();
      render(<MenuAvailabilityPanel onClose={() => {}} />);
      await waitFor(() => expect(screen.getByText('Burger')).toBeTruthy());

      expect(screen.getByTestId('availability-toggle-i-01').textContent).toBe('On');
      expect(screen.getByTestId('availability-toggle-i-02').textContent).toBe('Sold out');
      expect(screen.queryByText('Available')).toBeNull();
      expect(document.body.textContent).toContain('🍔');
      expect(document.body.textContent).toContain('🍟');
    } finally {
      seedItems[0].image = '';
      seedItems[1].image = '';
    }
  });

  it('renders items with correct availability state using role="switch"', async () => {
    setupFetchMock();
    render(<MenuAvailabilityPanel onClose={() => {}} />);
    await waitFor(() => expect(screen.getByText('Burger')).toBeTruthy());
    expect(screen.getByText('Fries')).toBeTruthy();

    // Fix 7: availability controls use role="switch"
    const friesToggle = screen.getByTestId('availability-toggle-i-02');
    expect(friesToggle.getAttribute('role')).toBe('switch');
    // Fries is unavailable → aria-checked should be false (switch is OFF)
    expect(friesToggle.getAttribute('aria-checked')).toBe('false');

    const burgerToggle = screen.getByTestId('availability-toggle-i-01');
    expect(burgerToggle.getAttribute('role')).toBe('switch');
    // Burger is available → aria-checked should be true (switch is ON)
    expect(burgerToggle.getAttribute('aria-checked')).toBe('true');
  });

  it('toggle calls toggleAvailability with correct args', async () => {
    setupFetchMock();
    render(<MenuAvailabilityPanel onClose={() => {}} />);
    await waitFor(() => expect(screen.getByText('Burger')).toBeTruthy());
    const burgerToggle = screen.getByTestId('availability-toggle-i-01');
    fireEvent.click(burgerToggle);
    await waitFor(() =>
      expect(vi.mocked(fetch)).toHaveBeenCalledWith(
        expect.stringContaining('/api/menu/items/i-01/availability'),
        expect.objectContaining({ method: 'POST' })
      )
    );
  });

  it('error state shown on failed toggle', async () => {
    setupFetchMock({ failToggle: true });
    render(<MenuAvailabilityPanel onClose={() => {}} />);
    await waitFor(() => expect(screen.getByText('Burger')).toBeTruthy());
    const burgerToggle = screen.getByTestId('availability-toggle-i-01');
    fireEvent.click(burgerToggle);
    await waitFor(() => expect(screen.getByRole('alert')).toBeTruthy());
  });

  it('calls onClose when Done button is clicked', async () => {
    setupFetchMock();
    const onClose = vi.fn();
    render(<MenuAvailabilityPanel onClose={onClose} />);
    fireEvent.click(screen.getByText('Done'));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('calls onClose when Escape key is pressed', async () => {
    setupFetchMock();
    const onClose = vi.fn();
    render(<MenuAvailabilityPanel onClose={onClose} />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledOnce();
  });

  // Fix 9: Tab wraps focus within panel
  it('Tab key wraps focus from last focusable element to first', async () => {
    setupFetchMock();
    render(<MenuAvailabilityPanel onClose={() => {}} />);
    await waitFor(() => expect(screen.getByText('Burger')).toBeTruthy());

    // Get all focusable elements inside the panel
    const panel = screen.getByRole('dialog');
    const focusable = Array.from(
      panel.querySelectorAll<HTMLElement>('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')
    ).filter((el) => !el.hasAttribute('disabled'));

    expect(focusable.length).toBeGreaterThan(1);

    const lastFocusable = focusable[focusable.length - 1];
    const firstFocusable = focusable[0];

    // Focus the last focusable element
    lastFocusable.focus();
    expect(document.activeElement).toBe(lastFocusable);

    // Press Tab — focus should wrap to first
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: false });
    expect(document.activeElement).toBe(firstFocusable);
  });
});
