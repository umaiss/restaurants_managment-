// U5 Step 14: one folder and one mount point per U6 feature area (BR14.2).
import React from 'react';
import fs from 'fs';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup, act } from '@testing-library/react';
import * as registry from '../features/registry.js';

afterEach(cleanup);

const COMPONENTS: Array<[string, string]> = [
  ['options', 'OptionsFeature'],
  ['allergies', 'AllergiesFeature'],
  ['estimate', 'EstimateFeature'],
  ['tracker', 'TrackerFeature'],
  ['ready-banner', 'ReadyBannerFeature'],
  ['same-again', 'SameAgainFeature'],
  ['help-card', 'HelpCardFeature'],
  ['special-card', 'SpecialCardFeature'],
  ['rating', 'RatingFeature'],
  ['settings', 'SettingsFeature'],
];

describe('diner feature mount points', () => {
  it('there is one folder per feature area, each with its own index file', () => {
    expect([...registry.DINER_FEATURE_FOLDERS].sort()).toEqual(COMPONENTS.map(([folder]) => folder).sort());
    for (const [folder] of COMPONENTS) {
      expect(fs.existsSync(`src/client/diner/features/${folder}/index.tsx`), folder).toBe(true);
    }
  });

  it('the registry exports one mount point per folder', () => {
    for (const [, name] of COMPONENTS) {
      expect(typeof (registry as Record<string, unknown>)[name], name).toBe('function');
    }
  });

  it.each(COMPONENTS)('the %s placeholder renders nothing, whatever it is given', (_folder, name) => {
    const Feature = (registry as unknown as Record<string, React.ComponentType<{ tableId: string; events?: never[] }>>)[name];
    const { container } = render(<Feature tableId="5" events={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe('the screens mount them', () => {
  // Each screen is rendered with the registry's components replaced by recorders.
  const mounted: Array<{ name: string; tableId: string }> = [];

  async function renderWithRecorders() {
    vi.resetModules();
    mounted.length = 0;
    vi.doMock('../features/registry.js', () => {
      const make = (name: string) => (props: { tableId: string }) => {
        mounted.push({ name, tableId: props.tableId });
        return null;
      };
      return Object.fromEntries(COMPONENTS.map(([, n]) => [n, make(n)]));
    });
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ items: [], categories: [], orders: [], last_closed_visit_id: null }) })));
    vi.stubGlobal('IntersectionObserver', class { observe() {} disconnect() {} unobserve() {} });
    vi.stubGlobal('EventSource', class { addEventListener() {} close() {} });
    window.localStorage.clear();
  }
  afterEach(() => {
    vi.doUnmock('../features/registry.js');
    vi.unstubAllGlobals();
  });

  it('the Menu mounts the special card, allergies and options', async () => {
    await renderWithRecorders();
    const { default: MenuScreen } = await import('../../screens/diner/MenuScreen.js');
    const { findByTestId } = render(<MenuScreen tableId="5" />);
    await findByTestId('menu-screen');
    expect(mounted.map((m) => m.name)).toEqual(expect.arrayContaining(['SpecialCardFeature', 'AllergiesFeature', 'OptionsFeature']));
    expect(mounted.every((m) => m.tableId === '5')).toBe(true);
  });

  it('the Cart mounts the estimate once it has items, and not while it is empty', async () => {
    await renderWithRecorders();
    const { default: CartScreen } = await import('../../screens/diner/CartScreen.js');
    render(<CartScreen tableId="5" />);
    expect(mounted.map((m) => m.name)).not.toContain('EstimateFeature'); // nothing to estimate yet
    cleanup();

    window.localStorage.setItem('cart:table:5', JSON.stringify([{ menuItemId: 'i-01', name: 'Garlic Bread', priceCents: 650, quantity: 1 }]));
    const { findByTestId } = render(<CartScreen tableId="5" />);
    await findByTestId('cart-item-i-01');
    expect(mounted).toContainEqual({ name: 'EstimateFeature', tableId: '5' });
  });

  it('My orders mounts the call card, the tracker and Same again', async () => {
    await renderWithRecorders();
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => ({ orders: [{ order_number: 1, status: 'Pending', placed_at: '2026-11-08T12:00:00Z', lines: [{ menu_item_id: 'i-01', name: 'Garlic Bread', quantity: 1, price_cents_each: 650, subtotal_cents: 650 }] }] }),
      }))
    );
    const { default: MyOrdersScreen } = await import('../../screens/diner/MyOrdersScreen.js');
    const { findByTestId } = render(<MyOrdersScreen tableId="5" lastSSEEvent={null} />);
    await findByTestId('orders-screen');
    expect(mounted.map((m) => m.name)).toEqual(expect.arrayContaining(['HelpCardFeature', 'TrackerFeature', 'SameAgainFeature']));
  });

  it('the diner page mounts Settings and the ready banner, and Rating only once the table is closed', async () => {
    await renderWithRecorders();
    const { MemoryRouter, Route, Routes } = await import('react-router-dom');
    const { default: TableView } = await import('../../views/TableView.js');
    const view = (
      <MemoryRouter initialEntries={['/table/5']}>
        <Routes>
          <Route path="/table/:id" element={<TableView />} />
        </Routes>
      </MemoryRouter>
    );
    const streams: Array<{ handlers: Record<string, (e: MessageEvent) => void> }> = [];
    vi.stubGlobal(
      'EventSource',
      class {
        handlers: Record<string, (e: MessageEvent) => void> = {};
        constructor() {
          streams.push(this);
        }
        addEventListener(type: string, handler: (e: MessageEvent) => void) {
          this.handlers[type] = handler;
        }
        close() {}
      }
    );
    render(view);
    expect(mounted.map((m) => m.name)).toEqual(expect.arrayContaining(['SettingsFeature', 'ReadyBannerFeature']));
    expect(mounted.map((m) => m.name)).not.toContain('RatingFeature');

    // The table is closed from the staff side: Rate your meal is mounted
    act(() => {
      streams[0].handlers.TABLE_CLOSED(new MessageEvent('TABLE_CLOSED', { data: JSON.stringify({ table_id: 5, archived_visit_id: 'v-1' }) }));
    });
    expect(mounted).toContainEqual({ name: 'RatingFeature', tableId: '5' });
  });
});
