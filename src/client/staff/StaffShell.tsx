import React, { useState } from 'react';
import { Routes, Route } from 'react-router-dom';
import { SideNav, SegmentedControl, type SideNavItem } from '../components/ui/index.js';
import { useTheme, type ThemeMode } from '../hooks/useTheme.js';
import { STAFF_PAGES } from './pages/registry.js';

const THEME_OPTIONS: Array<{ value: ThemeMode; label: string }> = [
  { value: 'device', label: 'Follow device' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
];

interface StaffShellProps {
  onSignOut: () => void;
}

/**
 * The staff shell (BR14.2): the side navigation at 1024 px and wider, a top bar with a menu button below
 * that, the theme control in the header, and the pages of the registry. It is only shown after the session
 * check (BR1.8). Every page renders in place, so after a correct PIN the page that was open is still open.
 */
export default function StaffShell({ onSignOut }: StaffShellProps) {
  const [navOpen, setNavOpen] = useState(false);
  const { mode, setMode } = useTheme();

  const items: SideNavItem[] = STAFF_PAGES.filter((p) => p.inNav).map((p) => ({
    key: p.key,
    to: p.path === '' ? '/staff' : `/staff/${p.path}`,
    label: p.label,
    icon: p.icon,
    end: p.path === '',
  }));

  return (
    <div className="staff-shell" data-testid="staff-view">
      <div id="staff-nav-wrap" className={`staff-nav-wrap${navOpen ? ' open' : ''}`} data-testid="staff-nav-wrap">
        <SideNav
          items={items}
          onNavigate={() => setNavOpen(false)}
          footer={
            <button type="button" className="nav-item" data-testid="sign-out" onClick={onSignOut}>
              <span aria-hidden="true">🚪</span>
              <span>Sign out</span>
            </button>
          }
        />
      </div>
      <div style={{ minWidth: 0 }}>
        <header className="staff-topbar" data-testid="staff-topbar">
          <button
            type="button"
            className="btn btn-sm staff-menu-button"
            data-testid="staff-menu-button"
            aria-expanded={navOpen}
            aria-controls="staff-nav-wrap"
            onClick={() => setNavOpen((o) => !o)}
          >
            ☰ Menu
          </button>
          <span style={{ flex: 1 }} />
          <SegmentedControl ariaLabel="Theme" testId="staff-theme" options={THEME_OPTIONS} value={mode} onChange={setMode} />
        </header>
        <main className="staff-main">
          <Routes>
            {STAFF_PAGES.map((p) =>
              p.path === '' ? <Route key={p.key} index element={p.element} /> : <Route key={p.key} path={p.path} element={p.element} />
            )}
          </Routes>
        </main>
      </div>
    </div>
  );
}
