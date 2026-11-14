// U8 Step 8: the plain TV wall page's words (BR2.4 to BR2.6, BR3.3, BR3.5, BR4.1, BR4.2, BR7.6).
import React from 'react';
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import type { TvSummary } from '../../../../../shared/tvWall';
import type { TvWallState } from '../useTvWall';

const hook = vi.hoisted(() => ({ state: null as unknown as TvWallState }));
vi.mock('../useTvWall', () => ({ useTvWall: () => hook.state }));

// The shell's other pages fetch and listen to streams; they are stood in for, as in StaffShell.test.tsx.
vi.mock('../../../../screens/staff/KitchenBoardScreen.js', () => ({ default: () => <div data-testid="kitchen-board">board</div> }));

import { MemoryRouter, Routes, Route } from 'react-router-dom';
import TvWallPage from '../index';
import StaffShell from '../../../StaffShell';

const NOW = new Date('2026-11-10T12:00:00.000Z');
const minutesAgo = (m: number) => new Date(NOW.getTime() - m * 60_000).toISOString();

function summary(overrides: Partial<TvSummary> = {}): TvSummary {
  return {
    server_time: NOW.toISOString(),
    day: '2026-11-10',
    day_ends_at: '2026-11-11T00:00:00.000Z',
    show_takings: false,
    orders: [],
    busiest_table: null,
    top_dish: null,
    requests: [],
    ...overrides,
  };
}
function show(state: Partial<TvWallState>) {
  hook.state = { status: 'ready', connection: 'live', lastUpdatedAt: NOW, summary: summary(), now: NOW, ...state };
  render(<TvWallPage />);
}

beforeEach(() => {
  // The page shows whether the shared staff stream is open; here it never opens.
  vi.stubGlobal('EventSource', class { addEventListener() {} close() {} });
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('the plain TV wall page', () => {
  it('with takings hidden shows "Takings hidden" in both places and no amount', () => {
    show({});
    expect(screen.getByTestId('tv-wall-closed')).toHaveTextContent('Takings hidden');
    expect(screen.getByTestId('tv-wall-open')).toHaveTextContent('Takings hidden');
    expect(screen.getByTestId('tv-wall')).not.toHaveTextContent('$');
    expect(screen.getByRole('heading', { name: "Today's takings" })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'On open tables' })).toBeInTheDocument();
  });

  it('with nothing yet shows the empty words, and zero takings as amounts', () => {
    show({ summary: summary({ show_takings: true, takings: { closed_cents: 0, open_cents: 0 } }) });
    expect(screen.getByTestId('tv-wall-title')).toHaveTextContent('TV wall');
    expect(screen.getByTestId('tv-wall-connection')).toHaveTextContent('Live');
    expect(screen.getByTestId('tv-wall-no-orders')).toHaveTextContent('No open orders');
    expect(screen.getByTestId('tv-wall-oldest')).toHaveTextContent('No open orders');
    expect(screen.getByTestId('tv-wall-busiest')).toHaveTextContent('No orders yet');
    expect(screen.getByTestId('tv-wall-top-dish')).toHaveTextContent('No dishes yet');
    expect(screen.getByTestId('tv-wall-closed')).toHaveTextContent('$0.00');
    expect(screen.getByTestId('tv-wall-open')).toHaveTextContent('$0.00');
  });

  it('lists open orders with table, number, portions, minutes and the Slow or Late word; the oldest wait is the first order', () => {
    show({
      summary: summary({
        show_takings: true,
        takings: { closed_cents: 31250, open_cents: 4350 },
        orders: [
          { order_number: 11, table_id: 3, status: 'Preparing', placed_at: minutesAgo(16), portions: 4 },
          { order_number: 12, table_id: 5, status: 'Pending', placed_at: minutesAgo(9), portions: 1 },
          { order_number: 13, table_id: 7, status: 'Pending', placed_at: minutesAgo(2), portions: 0 },
        ],
        busiest_table: { table_id: 3, orders: 2 },
        top_dish: { item_id: 'i-04', name: 'Classic Burger', portions: 5 },
        requests: [{ call_id: 'c-1', table_id: 5, kind: 'bill', opened_at: minutesAgo(3) }],
      }),
    });
    expect(screen.getByTestId('tv-order-11')).toHaveTextContent('Table 3');
    expect(screen.getByTestId('tv-order-11')).toHaveTextContent('Order #11');
    expect(screen.getByTestId('tv-order-11-portions')).toHaveTextContent('4 portions');
    expect(screen.getByTestId('tv-order-11-minutes')).toHaveTextContent('16 min');
    expect(screen.getByTestId('tv-order-11-label')).toHaveTextContent('Late');
    expect(screen.getByTestId('tv-order-12-label')).toHaveTextContent('Slow');
    expect(screen.queryByTestId('tv-order-13-label')).toBeNull();
    expect(screen.getByTestId('tv-order-12-portions')).toHaveTextContent('1 portion');
    expect(screen.getByTestId('tv-wall-oldest')).toHaveTextContent('Oldest wait: 16 min');
    expect(screen.getByTestId('tv-wall-closed')).toHaveTextContent('$312.50');
    expect(screen.getByTestId('tv-wall-open')).toHaveTextContent('$43.50');
    expect(screen.getByTestId('tv-wall-busiest')).toHaveTextContent('Table 3 · 2 orders');
    expect(screen.getByTestId('tv-wall-top-dish')).toHaveTextContent('Classic Burger · 5 portions');
    expect(screen.getByTestId('tv-request-c-1')).toHaveTextContent('Asking for the bill');
  });

  it('says Reconnecting with the last update time, and shows the error words before any summary', () => {
    const lastUpdatedAt = new Date(2026, 10, 10, 18, 7);
    show({ connection: 'reconnecting', lastUpdatedAt });
    expect(screen.getByTestId('tv-wall-connection')).toHaveTextContent('Reconnecting… last update 18:07');
    expect(screen.getByTestId('tv-wall-orders-panel')).toBeInTheDocument(); // the last summary stays
    cleanup();
    show({ status: 'error', connection: 'reconnecting', summary: null, lastUpdatedAt: null });
    expect(screen.getByTestId('tv-wall-connection')).toHaveTextContent("Can't reach the restaurant server. Trying again…");
    expect(screen.queryByTestId('tv-wall-orders-panel')).toBeNull();
  });
});

describe('the staff shell with the TV wall (BR9.1, BR9.2)', () => {
  function shell(path: string) {
    vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})));
    render(
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/staff/*" element={<StaffShell onSignOut={() => undefined} />} />
        </Routes>
      </MemoryRouter>
    );
  }
  it('/staff/tv fills the screen: the TV wall only, with no navigation and no top bar', () => {
    hook.state = { status: 'ready', connection: 'live', lastUpdatedAt: NOW, summary: summary(), now: NOW };
    shell('/staff/tv');
    expect(screen.getByTestId('staff-fullscreen')).toContainElement(screen.getByTestId('tv-wall'));
    expect(screen.queryByTestId('side-nav')).toBeNull();
    expect(screen.queryByTestId('staff-topbar')).toBeNull();
    expect(screen.queryByTestId('staff-menu-button')).toBeNull();
  });

  it('every other page has the "TV wall" link, with the takings switch directly under it', () => {
    shell('/staff');
    const link = screen.getByTestId('nav-tv');
    expect(link).toHaveTextContent('TV wall');
    expect(link).toHaveAttribute('href', '/staff/tv');
    expect(link.nextElementSibling).toBe(screen.getByTestId('tv-takings-switch-wrap'));
    expect(screen.getByRole('switch', { name: 'Show takings on TV' })).toHaveAttribute('aria-checked', 'false');
    expect(screen.getByTestId('kitchen-board')).toBeInTheDocument();
  });
});
