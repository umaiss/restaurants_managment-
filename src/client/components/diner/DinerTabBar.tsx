import React from 'react';

export type DinerTab = 'menu' | 'cart' | 'orders';

interface DinerTabBarProps {
  activeTab: DinerTab;
  cartCount: number;
  onTabChange: (tab: DinerTab) => void;
}

interface TabConfig {
  id: DinerTab;
  label: string;
  icon: string;
  testId: string;
}

const TABS: TabConfig[] = [
  { id: 'menu', label: 'Menu', icon: '🍽️', testId: 'tab-menu' },
  { id: 'cart', label: 'Cart', icon: '🛒', testId: 'tab-cart' },
  { id: 'orders', label: 'My orders', icon: '📋', testId: 'tab-orders' },
];

/**
 * Fixed-bottom tab bar for the diner view.
 * Always in reach of the thumb; active tab highlighted; Cart tab shows item count badge.
 */
export default function DinerTabBar({ activeTab, cartCount, onTabChange }: DinerTabBarProps) {
  return (
    <nav
      data-testid="tab-bar"
      aria-label="Diner navigation"
      className="diner-fixed"
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        display: 'flex',
        alignItems: 'stretch',
        background: 'var(--bg-tab-bar, rgba(18, 18, 30, 0.9))',
        borderTop: '1px solid rgba(255,255,255,0.08)',
        boxShadow: '0 -4px 24px rgba(0,0,0,0.3)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        zIndex: 100,
      }}
    >
      <span
        aria-hidden="true"
        className="tab-indicator"
        style={{ transform: `translateX(${TABS.findIndex((t) => t.id === activeTab) * 100}%)` }}
      />
      {TABS.map((tab) => {
        const isActive = activeTab === tab.id;
        const showBadge = tab.id === 'cart' && cartCount > 0;
        return (
          <button
            key={tab.id}
            data-testid={tab.testId}
            onClick={() => onTabChange(tab.id)}
            aria-pressed={isActive}
            aria-label={tab.label}
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '2px',
              padding: '0.6rem 0.5rem',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: isActive ? 'var(--accent, #6366f1)' : 'var(--text-secondary)',
              fontSize: '0.7rem',
              fontWeight: isActive ? 700 : 400,
              transition: 'color 150ms ease-out',
              position: 'relative',
              minHeight: '44px',
            }}
          >
            <span
              key={isActive ? 'on' : 'off'}
              className={isActive ? 'icon-hop' : undefined}
              style={{
                fontSize: '1.25rem',
                lineHeight: 1,
                filter: isActive ? 'drop-shadow(0 0 6px rgba(255,176,74,0.6))' : 'none',
                transition: 'filter 150ms ease-out',
              }}
            >
              {tab.icon}
            </span>
            <span>{tab.label}</span>
            {showBadge && (
              <span
                key={cartCount}
                className="bump"
                data-testid="cart-badge"
                aria-label={`${cartCount} items in cart`}
                style={{
                  position: 'absolute',
                  top: '0.3rem',
                  right: 'calc(50% - 1rem)',
                  background: 'var(--accent, #6366f1)',
                  color: 'var(--accent-fg, #0f1216)',
                  borderRadius: '50%',
                  width: '1.1rem',
                  height: '1.1rem',
                  fontSize: '0.65rem',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  pointerEvents: 'none',
                }}
              >
                {cartCount > 9 ? '9+' : cartCount}
              </span>
            )}
          </button>
        );
      })}
    </nav>
  );
}
