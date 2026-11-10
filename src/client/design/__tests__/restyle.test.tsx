// U5 Step 16: the five v1 screens take the new look (BR10.1, BR10.3, BR10.4).
import React from 'react';
import fs from 'fs';
import path from 'path';
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

// The board and the bill read their data through hooks; they are given fixed data here so the screens can render.
const boardOrders = new Map([
  [3, [{ order_number: 11, table_id: 3, status: 'Pending', placed_at: '2026-11-08T12:00:00Z', visit_id: 'v', lines: [{ menu_item_id: 'i-01', name: 'Garlic Bread', quantity: 2, price_cents_each: 650, subtotal_cents: 1300 }] }]],
  [4, [{ order_number: 12, table_id: 4, status: 'Completed', placed_at: '2026-11-08T12:01:00Z', visit_id: 'w', lines: [{ menu_item_id: 'i-02', name: 'House Salad', quantity: 1, price_cents_each: 850, subtotal_cents: 850 }] }]],
]);
// U7 (BR4.1, BR3.1, BR3.2): the hook also returns the table list, the open requests and the live events.
const boardHook = { ordersByTable: boardOrders, loading: false, connected: true, tables: [], error: false, callsByTable: new Map(), events: [], reload: () => {} };
vi.mock('../../hooks/useBoardOrders.js', () => ({ useBoardOrders: () => boardHook }));
vi.mock('../../hooks/useBoardOrders', () => ({ useBoardOrders: () => boardHook }));
vi.mock('../../hooks/useBill', () => ({
  useBill: () => ({
    bill: {
      table_id: 5,
      orders: [{ order_number: 15, status: 'Completed', placed_at: '2026-11-08T19:04:00Z', lines: [{ menu_item_id: 'i-04', name: 'Classic Burger', quantity: 1, price_cents_each: 1450, subtotal_cents: 1450 }], subtotal_cents: 1450 }],
      combined_total_cents: 1450,
      close_available: true,
      blocking_orders: [],
    },
    loading: false,
    error: false,
    closed: false,
    reload: () => undefined,
  }),
}));
vi.mock('../../hooks/useMenuAvailability', () => ({
  useMenuAvailability: () => ({
    items: [{ id: 'i-01', name: 'Garlic Bread', image: '🍞', available: true }, { id: 'i-02', name: 'House Salad', image: '🥗', available: false }],
    loading: false,
    error: null,
    toggleAvailability: async () => undefined,
  }),
}));

import MenuScreen from '../../screens/diner/MenuScreen.js';
import CartScreen from '../../screens/diner/CartScreen.js';
import MyOrdersScreen from '../../screens/diner/MyOrdersScreen.js';
import KitchenBoardScreen from '../../screens/staff/KitchenBoardScreen.js';
import TableBillScreen from '../../screens/staff/TableBillScreen.js';
import DinerTabBar from '../../components/diner/DinerTabBar.js';
import ConfirmModal from '../../components/ConfirmModal.js';
import TableClosedTakeover from '../../components/diner/TableClosedTakeover.js';
import MenuAvailabilityPanel from '../../components/staff/MenuAvailabilityPanel.js';
import TableView from '../../views/TableView.js';

const CLIENT = 'src/client';

function sourceFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) return e.name === '__tests__' ? [] : sourceFiles(full);
    return /\.(tsx?|css)$/.test(e.name) ? [full] : [];
  });
}

describe('no component sets a colour that a token covers (BR10.1)', () => {
  const files = sourceFiles(CLIENT).filter((f) => !f.endsWith(path.join('design', 'tokens.css')));

  it('scans the whole client, so the check is not vacuous', () => {
    expect(files.length).toBeGreaterThan(40);
    expect(files.some((f) => f.endsWith('MenuScreen.tsx'))).toBe(true);
    expect(files.some((f) => f.endsWith('index.css'))).toBe(true);
    expect(files.some((f) => f.endsWith('components.css'))).toBe(true);
  });

  it('no file outside tokens.css has a hex colour or an rgb / rgba / hsl value', () => {
    const offenders: string[] = [];
    for (const file of files) {
      const lines = fs.readFileSync(file, 'utf8').split('\n');
      lines.forEach((line, i) => {
        if (/#[0-9a-fA-F]{3,8}\b/.test(line) || /\b(rgb|rgba|hsl|hsla)\(/.test(line)) offenders.push(`${file}:${i + 1}: ${line.trim()}`);
      });
    }
    expect(offenders).toEqual([]);
  });

  it('no var() carries a literal fallback colour', () => {
    const offenders: string[] = [];
    for (const file of files) {
      fs.readFileSync(file, 'utf8').split('\n').forEach((line, i) => {
        if (/var\(--[a-z0-9-]+,\s*(#|rgb|hsl)/.test(line)) offenders.push(`${file}:${i + 1}`);
      });
    }
    expect(offenders).toEqual([]);
  });

  it('the scan really finds a literal colour: it would flag one', () => {
    expect(/#[0-9a-fA-F]{3,8}\b/.test("color: '#ef4444'")).toBe(true);
    expect(/\b(rgb|rgba|hsl|hsla)\(/.test("background: 'rgba(0,0,0,0.5)'")).toBe(true);
  });

  it('every var(--name) the client uses is defined in tokens.css', () => {
    const tokens = fs.readFileSync(path.join(CLIENT, 'design', 'tokens.css'), 'utf8');
    const defined = new Set([...tokens.matchAll(/(--[a-z0-9-]+)\s*:/g)].map((m) => m[1]));
    // Set by a component itself, not by the design tokens
    const local = new Set(['--i', '--ease-spring', '--tab-bar-height']);
    const missing = new Set<string>();
    for (const file of files) {
      for (const m of fs.readFileSync(file, 'utf8').matchAll(/var\((--[a-z0-9-]+)/g)) {
        if (!defined.has(m[1]) && !local.has(m[1])) missing.add(`${m[1]} in ${file}`);
      }
    }
    expect([...missing]).toEqual([]);
  });
});

describe('the stylesheet keeps what v1 got right (BR10.4)', () => {
  const css = fs.readFileSync(path.join(CLIENT, 'index.css'), 'utf8');
  const components = fs.readFileSync(path.join(CLIENT, 'design', 'components.css'), 'utf8');

  it('index.css starts with the tokens and the shared components', () => {
    expect(css.indexOf("@import './design/tokens.css'")).toBeGreaterThanOrEqual(0);
    expect(css.indexOf("@import './design/components.css'")).toBeGreaterThan(css.indexOf("tokens.css"));
    // @import must come before any rule
    expect(css.slice(0, css.indexOf("@import './design/components.css'")).replace(/\/\*[\s\S]*?\*\//g, '').trim()).toMatch(/^@import '@fontsource-variable\/inter\/index\.css';\s*@import '\.\/design\/tokens\.css';$/);
  });

  it('the + Add pill is 34 px tall with a 44 px touch area', () => {
    expect(components).toMatch(/\.add-pill\s*\{[^}]*height:\s*34px/);
    expect(components).toMatch(/\.add-pill::after\s*\{[^}]*height:\s*44px/);
  });

  it('regression: the touch area is a fixed 44 px box, not an offset from the pill (a 1 px border made it 42 px)', () => {
    const rule = /\.add-pill::after\s*\{([^}]*)\}/.exec(components)![1];
    expect(rule).toMatch(/width:\s*max\(calc\(100% \+ 4px\),\s*44px\)/); // as wide as the pill, border included
    expect(rule).not.toMatch(/inset:/);
  });

  it('buttons and pills keep a visible keyboard focus ring and the touch size', () => {
    expect(css).toMatch(/button:focus-visible[\s\S]*outline:\s*2px solid var\(--accent\)/);
    expect(components).toMatch(/\.btn\s*\{[^}]*min-height:\s*var\(--touch\)/);
  });

  it('the frosted bars keep their blur', () => {
    expect(components).toMatch(/\.staff-topbar\s*\{[^}]*backdrop-filter:\s*var\(--glass\)/);
    expect(fs.readFileSync(path.join(CLIENT, 'design', 'tokens.css'), 'utf8')).toMatch(/--glass:[^;]*blur\(/);
  });

  it('prices use tabular numbers', () => {
    expect(components).toContain('.num { font-variant-numeric: tabular-nums; }');
  });
});

/** Every inline style on the page, as text. */
function allInlineStyles(): string {
  return Array.from(document.querySelectorAll<HTMLElement>('[style]')).map((el) => el.getAttribute('style') ?? '').join(';');
}
function expectOnlyTokens(styles: string) {
  expect(styles).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
  expect(styles).not.toMatch(/\brgba?\(/);
  expect(styles).toContain('var(--');
}

const ordersResponse = {
  orders: [{ order_number: 1, status: 'Pending', placed_at: '2026-11-08T12:00:00Z', lines: [{ menu_item_id: 'i-01', name: 'Garlic Bread', quantity: 1, price_cents_each: 650, subtotal_cents: 650 }] }],
};
const menuResponse = {
  categories: [{ id: 'c-01', name: 'Starters', order: 1 }, { id: 'c-02', name: 'Mains', order: 2 }],
  items: [
    { id: 'i-01', category_id: 'c-01', name: 'Garlic Bread', description: 'Toasted', price_cents: 650, image: '🍞', available: true },
    { id: 'i-02', category_id: 'c-01', name: 'House Salad', description: 'Mixed greens', price_cents: 850, image: '🥗', available: false },
  ],
};

beforeEach(() => {
  window.localStorage.clear();
  window.sessionStorage.clear();
  document.documentElement.removeAttribute('data-theme');
  vi.stubGlobal('IntersectionObserver', class { observe() {} disconnect() {} unobserve() {} });
  vi.stubGlobal('EventSource', class { addEventListener() {} close() {} });
  vi.stubGlobal('fetch', vi.fn(async (url: string) => ({
    ok: true,
    status: 200,
    json: async () => (String(url).includes('/api/menu') ? menuResponse : String(url).includes('/orders') ? ordersResponse : { last_closed_visit_id: null }),
  })));
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('the five screens use the design system (BR10.3)', () => {
  it('Menu: cards, category bar and + Add pills use tokens, in either theme, and keep the sticky pills', async () => {
    render(<MenuScreen tableId="5" />);
    await screen.findByTestId('menu-screen');
    expectOnlyTokens(allInlineStyles());
    const bar = screen.getByTestId('category-pill-bar');
    expect(bar.style.position).toBe('sticky');
    expect(bar.getAttribute('style')).toContain('var(--bg-bar)');
    expect(bar.style.getPropertyValue('backdrop-filter') || bar.getAttribute('style')).toContain('blur');
    // the + Add pill: the design-system class, a 44 px touch area through it
    expect(screen.getByTestId('add-item-i-01')).toHaveClass('add-pill');
    // a card uses the card tokens; the sold-out one is still marked in words
    expect(document.body.innerHTML).toContain('var(--shadow-card)');
    expect(screen.getByText('Sold out')).toBeInTheDocument();
  });

  it('Cart: lines, total and the Place order bar use tokens, and the bar sits above the tab bar', async () => {
    window.localStorage.setItem('cart:table:5', JSON.stringify([{ menuItemId: 'i-01', name: 'Garlic Bread', priceCents: 650, quantity: 2 }]));
    render(<CartScreen tableId="5" />);
    await screen.findByTestId('cart-item-i-01');
    expectOnlyTokens(allInlineStyles());
    const bar = screen.getByTestId('cart-sticky-bar');
    expect(bar.style.position).toBe('fixed');
    expect(bar.getAttribute('style')).toContain('var(--bg-bar)');
    expect(bar.getAttribute('style')).toContain('var(--tab-bar-height');
    expect(screen.getByTestId('place-order-button')).toHaveTextContent('Place order');
    expect(screen.getByText('Your cart')).toBeInTheDocument();
  });

  it('My orders: order cards use tokens, and the status is a word as well as a colour', async () => {
    render(<MyOrdersScreen tableId="5" lastSSEEvent={null} />);
    await screen.findByTestId('orders-screen');
    expectOnlyTokens(allInlineStyles());
    expect(screen.getByTestId('order-status-1')).toHaveTextContent('Pending');
    expect(screen.getByTestId('order-card-1').getAttribute('style')).toContain('var(--bg-raised)');
  });

  it('Kitchen Board: table cards, order cards and header use tokens, and keep v1\'s words', () => {
    render(
      <MemoryRouter>
        <KitchenBoardScreen />
      </MemoryRouter>
    );
    expectOnlyTokens(allInlineStyles());
    expect(screen.getByRole('heading', { name: 'Kitchen Board' })).toBeInTheDocument();
    expect(screen.getByText('Updated live')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Menu availability' })).toBeInTheDocument();
    expect(screen.getByTestId('table-section-3').getAttribute('style')).toContain('var(--bg-raised)');
    expect(screen.getByText('Start preparing')).toBeInTheDocument();
  });

  it('Table Bill and Close table: order cards, total and the close button use tokens, and keep v1\'s words', () => {
    render(
      <MemoryRouter initialEntries={['/staff/tables/5']}>
        <Routes>
          <Route path="/staff/tables/:id" element={<TableBillScreen />} />
        </Routes>
      </MemoryRouter>
    );
    expectOnlyTokens(allInlineStyles());
    expect(screen.getByRole('heading', { name: 'Table 5 — Bill' })).toBeInTheDocument();
    expect(screen.getByText('← Board')).toBeInTheDocument();
    expect(screen.getByText('Combined total')).toBeInTheDocument();
    expect(screen.getByTestId('btn-close-table')).toHaveTextContent('Close table');
    expect(screen.getByTestId('bill-order-15').getAttribute('style')).toContain('var(--bg-raised)');
  });
});

describe('the shared pieces around the screens use tokens', () => {
  it('the tab bar is fixed at the bottom, frosted, with the Cart count and a word under every icon', () => {
    render(<DinerTabBar activeTab="cart" cartCount={3} onTabChange={() => undefined} />);
    const bar = screen.getByTestId('tab-bar');
    expect(bar.style.position).toBe('fixed');
    expect(bar.style.bottom).toBe('0px');
    expect(bar.getAttribute('style')).toContain('var(--bg-bar)');
    expect(bar.getAttribute('style')).toContain('blur');
    expect(screen.getByTestId('cart-badge')).toHaveTextContent('3');
    for (const label of ['Menu', 'Cart', 'My orders']) expect(screen.getByText(label)).toBeInTheDocument();
    expectOnlyTokens(allInlineStyles());
  });

  it('the Cart count shows 9+ for more than nine, and nothing for an empty cart', () => {
    const { rerender } = render(<DinerTabBar activeTab="menu" cartCount={12} onTabChange={() => undefined} />);
    expect(screen.getByTestId('cart-badge')).toHaveTextContent('9+');
    rerender(<DinerTabBar activeTab="menu" cartCount={0} onTabChange={() => undefined} />);
    expect(screen.queryByTestId('cart-badge')).toBeNull();
  });

  it('the current tab is marked for assistive technology and filled with the accent tint', () => {
    render(<DinerTabBar activeTab="orders" cartCount={0} onTabChange={() => undefined} />);
    expect(screen.getByTestId('tab-orders')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('tab-orders').getAttribute('style')).toContain('var(--accent-soft)');
    expect(screen.getByTestId('tab-menu')).toHaveAttribute('aria-pressed', 'false');
  });

  it('the confirmation dialog, the closed screen and the availability panel use tokens', () => {
    render(
      <>
        <ConfirmModal open title="Place order?" message="2 items" onConfirm={() => undefined} onCancel={() => undefined} />
        <TableClosedTakeover visible />
        <MenuAvailabilityPanel onClose={() => undefined} />
      </>
    );
    expectOnlyTokens(allInlineStyles());
    expect(screen.getByTestId('confirm-modal').getAttribute('style')).toContain('var(--scrim)');
    expect(screen.getByTestId('table-closed-takeover').getAttribute('style')).toContain('var(--overlay-strong)');
    expect(screen.getByRole('dialog', { name: 'Menu availability' })).toBeInTheDocument();
  });
});

describe('the diner header (mockup diner-menu)', () => {
  function table() {
    return render(
      <MemoryRouter initialEntries={['/table/5']}>
        <Routes>
          <Route path="/table/:id" element={<TableView />} />
        </Routes>
      </MemoryRouter>
    );
  }

  it('shows "Table 5" and, in words, whether the page is updated live', () => {
    table();
    expect(screen.getByRole('heading', { name: 'Table 5' })).toBeInTheDocument();
    // The stream has not opened yet: the words say so, not only the dot's colour
    expect(screen.getByTestId('live-status')).toHaveTextContent('Reconnecting…');
  });

  it('uses tokens throughout and applies the saved theme to the page', () => {
    window.localStorage.setItem('table-order.theme', 'light');
    table();
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    expectOnlyTokens(allInlineStyles());
  });
});
