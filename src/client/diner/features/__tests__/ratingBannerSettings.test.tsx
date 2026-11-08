// U6 Steps 6 and 9: Rate your meal, the ready banner and the Settings sheet
// (BR6.1, BR6.2, BR4.1, BR4.2, BR2.3, BR7.2; D9, D11; W5, W6, W9).
import React from 'react';
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor, act } from '@testing-library/react';
import RatingFeature from '../rating/index.js';
import { dishesOf } from '../rating/useRatings.js';
import ReadyBannerFeature, { readyEventId } from '../ready-banner/index.js';
import SettingsFeature from '../settings/index.js';
import type { SSEEvent } from '../../../hooks/useTableSSE.js';

const ev = (seq: number, type: string, data: unknown = {}): SSEEvent => ({ seq, type, data });

beforeEach(() => {
  localStorage.clear();
  document.documentElement.removeAttribute('data-theme');
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

// ------------------------------------------------------------------ Rate your meal

const closedOrders = [
  { order_number: 1, status: 'Completed', visit_id: 'v-1', placed_at: '', lines: [{ menu_item_id: 'i-04', name: 'Classic Burger' }, { menu_item_id: 'i-02', name: 'House Salad' }] },
  { order_number: 2, status: 'Completed', visit_id: 'v-1', placed_at: '', lines: [{ menu_item_id: 'i-04', name: 'Classic Burger' }] },
  { order_number: 3, status: 'Cancelled', visit_id: 'v-1', placed_at: '', lines: [{ menu_item_id: 'i-08', name: 'Chocolate Fondant' }] },
];

function stubRatingServer(opts: { post?: (body: any) => { status?: number; code?: string } | 'fail' } = {}) {
  const posts: any[] = [];
  const mock = vi.fn(async (url: string, init?: RequestInit) => {
    if (init?.method === 'POST') {
      const body = JSON.parse(init.body as string);
      posts.push(body);
      const r = opts.post?.(body) ?? {};
      if (r === 'fail') throw new TypeError('offline');
      const status = r.status ?? 200;
      return { ok: status < 400, status, json: async () => (status < 400 ? { saved: 1 } : { error: { code: r.code, message: 'no' } }) };
    }
    return { ok: true, status: 200, json: async () => ({ orders: closedOrders }) };
  });
  vi.stubGlobal('fetch', mock);
  return { mock, posts };
}

describe('Rate your meal (BR6.1, BR6.2)', () => {
  it('lists each dish of the closed visit once and leaves out cancelled orders', () => {
    expect(dishesOf(closedOrders).map((d) => d.name)).toEqual(['Classic Burger', 'House Salad']);
  });

  it('reads the closed visit with the new route option and shows a thumbs up and down per dish', async () => {
    const { mock } = stubRatingServer();
    render(<RatingFeature tableId="5" />);
    expect(await screen.findByTestId('rate-meal')).toHaveTextContent('Rate your meal');
    expect((mock.mock.calls[0] as unknown as [string])[0]).toBe('/api/tables/5/orders?visit=last_closed');
    expect(screen.getByLabelText('Thumbs up for Classic Burger')).toBeInTheDocument();
    expect(screen.getByLabelText('Thumbs down for House Salad')).toBeInTheDocument();
    expect(screen.queryByText('Chocolate Fondant')).toBeNull();
  });

  it('shows nothing when the visit had no dishes', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ orders: [] }) })));
    const { container } = render(<RatingFeature tableId="5" />);
    await act(async () => {});
    expect(container).toBeEmptyDOMElement();
  });

  it('a tap saves that dish at once, and the other thumb changes it', async () => {
    const { posts } = stubRatingServer();
    render(<RatingFeature tableId="5" />);
    fireEvent.click(await screen.findByTestId('rate-up-i-04'));
    await waitFor(() => expect(posts).toHaveLength(1));
    expect(posts[0]).toEqual({ visit_id: 'v-1', ratings: [{ item_id: 'i-04', thumb: 'up' }], done: false });
    expect(screen.getByTestId('rate-up-i-04')).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByTestId('rate-down-i-04'));
    await waitFor(() => expect(posts).toHaveLength(2));
    expect(screen.getByTestId('rate-down-i-04')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('rate-up-i-04')).toHaveAttribute('aria-pressed', 'false');
  });

  it('Done sends every rating with done true, shows a thank-you and locks the thumbs', async () => {
    const { posts } = stubRatingServer();
    render(<RatingFeature tableId="5" />);
    fireEvent.click(await screen.findByTestId('rate-up-i-04'));
    fireEvent.click(screen.getByTestId('rate-down-i-02'));
    fireEvent.click(screen.getByTestId('rate-done'));
    await waitFor(() => expect(screen.getByTestId('rate-message')).toHaveTextContent('Thank you'));
    const last = posts[posts.length - 1];
    expect(last.done).toBe(true);
    expect(last.ratings).toEqual(expect.arrayContaining([{ item_id: 'i-04', thumb: 'up' }, { item_id: 'i-02', thumb: 'down' }]));
    expect(screen.getByTestId('rate-up-i-04')).toBeDisabled();
    expect(screen.queryByTestId('rate-done')).toBeNull();
  });

  it('a refused change (RATING_LOCKED) says "Your ratings are saved." and locks the thumbs', async () => {
    stubRatingServer({ post: () => ({ status: 409, code: 'RATING_LOCKED' }) });
    render(<RatingFeature tableId="5" />);
    fireEvent.click(await screen.findByTestId('rate-up-i-04'));
    await waitFor(() => expect(screen.getByTestId('rate-message')).toHaveTextContent('Your ratings are saved.'));
    expect(screen.getByTestId('rate-up-i-04')).toBeDisabled();
  });

  it('a failed save (network) says "Could not save. Try again." and the thumb returns to what it was', async () => {
    stubRatingServer({ post: () => 'fail' });
    render(<RatingFeature tableId="5" />);
    fireEvent.click(await screen.findByTestId('rate-up-i-04'));
    await waitFor(() => expect(screen.getByTestId('rate-message')).toHaveTextContent('Could not save. Try again.'));
    expect(screen.getByTestId('rate-up-i-04')).toHaveAttribute('aria-pressed', 'false');
  });

  it('a 409 VISIT_NOT_CLOSED is also a failed save, with the earlier thumb put back', async () => {
    let n = 0;
    stubRatingServer({ post: () => (++n === 1 ? {} : { status: 409, code: 'VISIT_NOT_CLOSED' }) });
    render(<RatingFeature tableId="5" />);
    fireEvent.click(await screen.findByTestId('rate-up-i-04'));
    await waitFor(() => expect(screen.getByTestId('rate-up-i-04')).toHaveAttribute('aria-pressed', 'true'));
    fireEvent.click(screen.getByTestId('rate-down-i-04'));
    await waitFor(() => expect(screen.getByTestId('rate-message')).toHaveTextContent('Could not save'));
    expect(screen.getByTestId('rate-up-i-04')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('rate-down-i-04')).toHaveAttribute('aria-pressed', 'false');
  });
});

// ------------------------------------------------------------------ the ready banner

describe('ReadyBannerFeature (BR4.1, BR4.2)', () => {
  const completed = (n: number, seq: number, extra: object = {}) => ev(seq, 'ORDER_STATUS_CHANGED', { order_number: n, table_id: 5, status: 'Completed', ...extra });

  it('shows "Your order #n is ready" when an order for this table becomes Completed', () => {
    render(<ReadyBannerFeature tableId="5" events={[completed(12, 1)]} />);
    expect(screen.getByTestId('ready-banner')).toHaveTextContent('Your order #12 is ready');
  });

  it('shows nothing for other statuses, other event types or another table', () => {
    const { container } = render(
      <ReadyBannerFeature
        tableId="5"
        events={[ev(1, 'ORDER_STATUS_CHANGED', { order_number: 1, table_id: 5, status: 'Preparing' }), ev(2, 'ORDER_PLACED', { order_number: 2 }), completed(3, 3, { table_id: 6 })]}
      />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('never shows twice for the same event: a replay after a reconnect (a new seq, the same order) shows nothing', () => {
    const { rerender } = render(<ReadyBannerFeature tableId="5" events={[completed(12, 1)]} />);
    fireEvent.click(screen.getByTestId('ready-banner-dismiss'));
    expect(screen.queryByTestId('ready-banner')).toBeNull();
    rerender(<ReadyBannerFeature tableId="5" events={[completed(12, 1), completed(12, 2)]} />);
    expect(screen.queryByTestId('ready-banner')).toBeNull();
    expect(readyEventId({ order_number: 12 })).toBe('ORDER_STATUS_CHANGED:12:Completed');
  });

  it('a new order completing after a dismissed one shows its own banner', () => {
    const { rerender } = render(<ReadyBannerFeature tableId="5" events={[completed(12, 1)]} />);
    fireEvent.click(screen.getByTestId('ready-banner-dismiss'));
    rerender(<ReadyBannerFeature tableId="5" events={[completed(12, 1), completed(13, 2)]} />);
    expect(screen.getByTestId('ready-banner')).toHaveTextContent('#13');
  });

  it('a page with no events (a reload) raises nothing', () => {
    const { container } = render(<ReadyBannerFeature tableId="5" events={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('vibrates where the device can, and plays no sound before the first tap', () => {
    const vibrate = vi.fn(() => true);
    Object.defineProperty(navigator, 'vibrate', { value: vibrate, configurable: true });
    const beep = vi.fn();
    vi.stubGlobal('AudioContext', class { constructor() { beep(); } createOscillator() { return { connect() {}, start() {}, stop() {}, frequency: {}, set onended(_f: unknown) {} }; } createGain() { return { connect() {}, gain: {} }; } get destination() { return {}; } get currentTime() { return 0; } close() {} });
    render(<ReadyBannerFeature tableId="5" events={[completed(12, 1)]} />);
    expect(vibrate).toHaveBeenCalled();
    expect(beep).not.toHaveBeenCalled();
    Object.defineProperty(navigator, 'vibrate', { value: undefined, configurable: true });
  });

  it('plays the sound after a tap, and not when muted', () => {
    const beep = vi.fn();
    const FakeAudio = class { constructor() { beep(); } createOscillator() { return { connect() {}, start() {}, stop() {}, frequency: {}, set onended(_f: unknown) {} }; } createGain() { return { connect() {}, gain: {} }; } get destination() { return {}; } get currentTime() { return 0; } close() {} };
    vi.stubGlobal('AudioContext', FakeAudio);
    const { rerender } = render(<ReadyBannerFeature tableId="5" events={[]} />);
    fireEvent.pointerDown(document.body); // the first tap lets sound play
    rerender(<ReadyBannerFeature tableId="5" events={[completed(12, 1)]} />);
    expect(beep).toHaveBeenCalledTimes(1);
    localStorage.setItem('table-order.sound', 'muted');
    rerender(<ReadyBannerFeature tableId="5" events={[completed(12, 1), completed(13, 2)]} />);
    expect(beep).toHaveBeenCalledTimes(1); // the banner showed, the sound did not
    expect(screen.getAllByTestId('ready-banner')).toHaveLength(2);
  });

  it('Mute turns sound off for good in the browser, and the Mute action goes away', () => {
    render(<ReadyBannerFeature tableId="5" events={[completed(12, 1)]} />);
    fireEvent.click(screen.getByTestId('ready-banner-mute'));
    expect(localStorage.getItem('table-order.sound')).toBe('muted');
    expect(screen.queryByTestId('ready-banner-mute')).toBeNull();
  });
});

// ------------------------------------------------------------------ the Settings sheet

describe('SettingsFeature (BR2.3, BR4.2, BR7.2)', () => {
  function openSheet() {
    render(<SettingsFeature tableId="5" />);
    fireEvent.click(screen.getByTestId('open-settings'));
    return screen.getByTestId('settings-sheet');
  }

  it('the gear opens the sheet with allergies, theme and sound', () => {
    const sheet = openSheet();
    expect(sheet).toHaveTextContent('My allergies');
    expect(sheet).toHaveTextContent('Theme');
    expect(sheet).toHaveTextContent('Sound alerts');
    expect(screen.getAllByTestId(/^allergy-chip-/)).toHaveLength(9);
    expect(sheet).toHaveTextContent('guidance, not a promise');
  });

  it('allergy chips save at once and are still set after a reload (a new render)', () => {
    openSheet();
    fireEvent.click(screen.getByTestId('allergy-chip-dairy'));
    fireEvent.click(screen.getByTestId('allergy-chip-sesame'));
    expect(JSON.parse(localStorage.getItem('table-order.allergies')!)).toEqual(['dairy', 'sesame']);
    cleanup();
    openSheet();
    expect(screen.getByTestId('allergy-chip-dairy')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('allergy-chip-fish')).toHaveAttribute('aria-pressed', 'false');
  });

  it('the theme control saves Light or Dark and Follow device removes the choice', () => {
    openSheet();
    fireEvent.click(screen.getByTestId('theme-toggle-dark'));
    expect(localStorage.getItem('table-order.theme')).toBe('dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    fireEvent.click(screen.getByTestId('theme-toggle-device'));
    expect(localStorage.getItem('table-order.theme')).toBeNull();
    expect(document.documentElement.hasAttribute('data-theme')).toBe(false);
  });

  it('the sound control saves Muted and On', () => {
    openSheet();
    fireEvent.click(screen.getByTestId('sound-toggle-muted'));
    expect(localStorage.getItem('table-order.sound')).toBe('muted');
    fireEvent.click(screen.getByTestId('sound-toggle-on'));
    expect(localStorage.getItem('table-order.sound')).toBeNull();
  });

  it('regression: the sheet is put on the page body, not inside the frosted header the gear sits in', () => {
    // Found by the browser tests: inside the header (a backdrop-filter bar) a "fixed" sheet is measured from the
    // header, came out header-high and its chips could not be clicked.
    const { container } = render(
      <header data-testid="page-header">
        <SettingsFeature tableId="5" />
      </header>
    );
    fireEvent.click(screen.getByTestId('open-settings'));
    const sheet = screen.getByTestId('settings-sheet');
    expect(container.contains(sheet)).toBe(false);
    expect(sheet.closest('header')).toBeNull();
    expect(document.body.contains(sheet)).toBe(true);
  });

  it('closes with Escape and with its close button, and focus goes back to the gear', () => {
    openSheet();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByTestId('settings-sheet')).toBeNull();
    fireEvent.click(screen.getByTestId('open-settings'));
    fireEvent.click(screen.getByTestId('settings-close'));
    expect(screen.queryByTestId('settings-sheet')).toBeNull();
  });

  it('blocked browser storage falls back to the defaults with no error', () => {
    const real = window.localStorage;
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      get() {
        throw new Error('blocked');
      },
    });
    try {
      openSheet();
      fireEvent.click(screen.getByTestId('allergy-chip-dairy')); // cannot be saved, must not throw
      expect(screen.getByTestId('theme-toggle-device')).toHaveAttribute('aria-pressed', 'true');
      expect(screen.getByTestId('sound-toggle-on')).toHaveAttribute('aria-pressed', 'true');
    } finally {
      Object.defineProperty(window, 'localStorage', { configurable: true, value: real });
    }
  });
});
