// U5 Step 14: the staff shell, its page registry and the way back to the PIN screen (BR1.7, BR1.8, BR14.2).
import React from 'react';
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

// The v1 screens fetch and listen to streams; the shell is tested on its own, so they are stood in for.
vi.mock('../../screens/staff/KitchenBoardScreen.js', () => ({ default: () => <div data-testid="kitchen-board">board</div> }));
vi.mock('../../screens/staff/TableBillScreen.js', () => ({ default: () => <div data-testid="table-bill-screen">bill</div> }));

import StaffShell from '../StaffShell.js';
import StaffView from '../../views/StaffView.js';
import { STAFF_PAGES } from '../pages/registry.js';
import { staffFetch } from '../staffAuth.js';

const json = (status: number, body?: unknown) => ({
  ok: status >= 200 && status < 300,
  status,
  json: () => Promise.resolve(body ?? {}),
});

beforeEach(() => {
  window.localStorage.clear();
  document.documentElement.removeAttribute('data-theme');
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('the page registry (BR14.2)', () => {
  it('lists every staff page once, each with a route, a label and a page', () => {
    expect(STAFF_PAGES.map((p) => p.key)).toEqual(['board', 'floor', 'menu', 'special', 'sales', 'qr', 'stations', 'bill']);
    expect(new Set(STAFF_PAGES.map((p) => p.path)).size).toBe(STAFF_PAGES.length);
    for (const p of STAFF_PAGES) {
      expect(p.label).toBeTruthy();
      expect(React.isValidElement(p.element)).toBe(true);
    }
  });

  it('the Kitchen Board is the index page and the bill stays at tables/:id', () => {
    expect(STAFF_PAGES.find((p) => p.key === 'board')!.path).toBe('');
    expect(STAFF_PAGES.find((p) => p.key === 'bill')!.path).toBe('tables/:id');
  });

  it('the navigation has the mockup\'s words, in order, and leaves out the pages reached from other pages', () => {
    expect(STAFF_PAGES.filter((p) => p.inNav).map((p) => p.label)).toEqual([
      'Kitchen Board',
      'Floor map',
      'Menu management',
      "Chef's special",
      'Past visits and sales',
      'QR codes',
    ]);
    expect(STAFF_PAGES.filter((p) => !p.inNav).map((p) => p.key)).toEqual(['stations', 'bill']);
  });
});

describe('StaffShell', () => {
  function shell(path = '/staff', onSignOut = vi.fn()) {
    // As in the app: the shell sits under the /staff/* route, so its own routes are relative to /staff.
    render(
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/staff/*" element={<StaffShell onSignOut={onSignOut} />} />
        </Routes>
      </MemoryRouter>
    );
    return onSignOut;
  }

  it('shows the side navigation with every page, and Sign out', () => {
    shell();
    for (const label of ['Kitchen Board', 'Floor map', 'Menu management', "Chef's special", 'Past visits and sales', 'QR codes', 'Sign out']) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
    expect(screen.getByRole('navigation', { name: 'Staff navigation' })).toBeInTheDocument();
  });

  it('the index address shows the Kitchen Board and marks it current', () => {
    shell('/staff');
    expect(screen.getByTestId('kitchen-board')).toBeInTheDocument();
    expect(screen.getByTestId('nav-board')).toHaveAttribute('aria-current', 'page');
  });

  it('the bill address shows the bill, with no navigation item current', () => {
    shell('/staff/tables/5');
    expect(screen.getByTestId('table-bill-screen')).toBeInTheDocument();
    expect(screen.getByTestId('nav-board')).not.toHaveAttribute('aria-current');
  });

  it.each([
    ['/staff/floor', 'Floor map'],
    ['/staff/menu', 'Menu management'],
    ['/staff/special', "Chef's special"],
    ['/staff/sales', 'Past visits and sales'],
    ['/staff/qr', 'QR codes'],
    ['/staff/stations/Grill', 'Grill station'],
  ])('%s shows its placeholder page "%s"', (path, title) => {
    shell(path);
    expect(screen.getByTestId('page-placeholder')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: title })).toBeInTheDocument();
  });

  it('following a navigation link changes the page', async () => {
    shell('/staff');
    await userEvent.click(screen.getByTestId('nav-floor'));
    expect(screen.getByRole('heading', { name: 'Floor map' })).toBeInTheDocument();
    expect(screen.getByTestId('nav-floor')).toHaveAttribute('aria-current', 'page');
  });

  it('on a narrow screen the navigation is behind a Menu button: it opens, and closes after a link is followed', async () => {
    shell('/staff');
    const wrap = screen.getByTestId('staff-nav-wrap');
    const button = screen.getByTestId('staff-menu-button');
    expect(wrap).not.toHaveClass('open');
    expect(button).toHaveAttribute('aria-expanded', 'false');
    await userEvent.click(button);
    expect(wrap).toHaveClass('open');
    expect(button).toHaveAttribute('aria-expanded', 'true');
    await userEvent.click(screen.getByTestId('nav-sales'));
    expect(wrap).not.toHaveClass('open');
  });

  it('Sign out calls the handler', async () => {
    const onSignOut = shell();
    await userEvent.click(screen.getByTestId('sign-out'));
    expect(onSignOut).toHaveBeenCalledTimes(1);
  });

  it('the header has the theme control: Light and Dark set data-theme and the choice is remembered; Follow device removes it', async () => {
    shell();
    expect(screen.getByRole('group', { name: 'Theme' })).toBeInTheDocument();
    expect(screen.getByTestId('staff-theme-device')).toHaveAttribute('aria-pressed', 'true');
    await userEvent.click(screen.getByTestId('staff-theme-dark'));
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(window.localStorage.getItem('table-order.theme')).toBe('dark');
    expect(screen.getByTestId('staff-theme-dark')).toHaveAttribute('aria-pressed', 'true');
    await userEvent.click(screen.getByTestId('staff-theme-light'));
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    await userEvent.click(screen.getByTestId('staff-theme-device'));
    expect(document.documentElement.hasAttribute('data-theme')).toBe(false);
    expect(window.localStorage.getItem('table-order.theme')).toBeNull();
  });
});

describe('StaffView: the PIN screen in front of every staff address (BR1.7, BR1.8)', () => {
  function view(path: string) {
    render(
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/staff/*" element={<StaffView />} />
        </Routes>
      </MemoryRouter>
    );
  }

  it('shows only the PIN screen when the server says signed out', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json(401)));
    view('/staff/tables/5');
    expect(await screen.findByTestId('pin-screen')).toBeInTheDocument();
    expect(screen.queryByTestId('table-bill-screen')).toBeNull();
    expect(screen.queryByTestId('side-nav')).toBeNull();
  });

  it('shows "Checking sign-in…" first, and the page when signed in', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json(200, { signed_in: true })));
    view('/staff/floor');
    expect(screen.getByTestId('staff-checking')).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: 'Floor map' })).toBeInTheDocument();
    expect(screen.queryByTestId('pin-screen')).toBeNull();
  });

  it('a server that does not answer shows a message and a Try again button that asks again', async () => {
    const fetchMock = vi.fn().mockRejectedValueOnce(new Error('offline'));
    vi.stubGlobal('fetch', fetchMock);
    view('/staff');
    expect(await screen.findByTestId('staff-unreachable')).toHaveTextContent('The server did not answer');
    fetchMock.mockResolvedValueOnce(json(200, { signed_in: true }));
    await userEvent.click(screen.getByTestId('staff-retry'));
    expect(await screen.findByTestId('kitchen-board')).toBeInTheDocument();
  });

  it('a correct PIN opens the page that was asked for, at the same address', async () => {
    const fetchMock = vi.fn(async (url: string) => (url === '/api/staff/login' ? json(204) : json(401)));
    vi.stubGlobal('fetch', fetchMock);
    view('/staff/tables/7');
    await screen.findByTestId('pin-screen');
    for (const d of '4242') await userEvent.click(screen.getByTestId(`pin-key-${d}`));
    await userEvent.click(screen.getByTestId('pin-submit'));
    expect(await screen.findByTestId('table-bill-screen')).toBeInTheDocument();
  });

  it('a 401 from any staff request returns to the PIN screen, and after a correct PIN the same page is back', async () => {
    let signedIn = true;
    const fetchMock = vi.fn(async (url: string) => {
      if (url === '/api/staff/session') return signedIn ? json(200, { signed_in: true }) : json(401);
      if (url === '/api/staff/login') {
        signedIn = true;
        return json(204);
      }
      return json(401);
    });
    vi.stubGlobal('fetch', fetchMock);
    view('/staff/sales');
    expect(await screen.findByRole('heading', { name: 'Past visits and sales' })).toBeInTheDocument();

    signedIn = false;
    await act(async () => {
      await staffFetch('/api/tables/5/bill'); // the server refuses
    });
    expect(await screen.findByTestId('pin-screen')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Past visits and sales' })).toBeNull();

    for (const d of '4242') await userEvent.click(screen.getByTestId(`pin-key-${d}`));
    await userEvent.click(screen.getByTestId('pin-submit'));
    expect(await screen.findByRole('heading', { name: 'Past visits and sales' })).toBeInTheDocument();
  });

  it('Sign out returns to the PIN screen', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string) => (url === '/api/staff/session' ? json(200, { signed_in: true }) : json(204))));
    view('/staff');
    await userEvent.click(await screen.findByTestId('sign-out'));
    await waitFor(() => expect(screen.getByTestId('pin-screen')).toBeInTheDocument());
  });
});
