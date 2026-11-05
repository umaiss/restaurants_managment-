import React, { useState } from 'react';
import { useParams } from 'react-router-dom';

type Tab = 'menu' | 'cart' | 'orders';

export default function TableView() {
  const { id } = useParams<{ id: string }>();
  const [activeTab, setActiveTab] = useState<Tab>('menu');
  // Cart item count — will be managed by U2
  const cartCount = 0;

  return (
    <div
      style={{
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--bg-primary)',
        color: 'var(--text-primary)',
        position: 'relative',
      }}
    >
      {/* Header */}
      <header
        style={{
          padding: '1.25rem 1rem 0.75rem',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
          background: 'var(--bg-secondary)',
        }}
      >
        <h1
          style={{
            fontSize: '1.25rem',
            fontWeight: 700,
            letterSpacing: '-0.01em',
          }}
        >
          Table {id}
        </h1>
      </header>

      {/* Content area — grows to fill space above tab bar */}
      <main
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '1rem',
          paddingBottom: '5rem', // space for tab bar
        }}
      >
        {activeTab === 'menu' && (
          <p style={{ color: 'var(--text-secondary)' }}>Menu — coming in U2</p>
        )}
        {activeTab === 'cart' && (
          <p style={{ color: 'var(--text-secondary)' }}>Cart — coming in U2</p>
        )}
        {activeTab === 'orders' && (
          <p style={{ color: 'var(--text-secondary)' }}>My orders — coming in U2</p>
        )}
      </main>

      {/* Fixed bottom tab bar */}
      <nav
        data-testid="tab-bar"
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          display: 'flex',
          alignItems: 'stretch',
          background: 'var(--bg-tab-bar)',
          borderTop: '1px solid rgba(255,255,255,0.08)',
          boxShadow: 'var(--shadow-tab-bar)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          zIndex: 100,
        }}
      >
        <TabButton
          label="Menu"
          icon="🍽️"
          testId="tab-menu"
          active={activeTab === 'menu'}
          onClick={() => setActiveTab('menu')}
        />
        <TabButton
          label="Cart"
          icon="🛒"
          testId="tab-cart"
          active={activeTab === 'cart'}
          badge={cartCount > 0 ? cartCount : undefined}
          onClick={() => setActiveTab('cart')}
        />
        <TabButton
          label="My orders"
          icon="📋"
          testId="tab-orders"
          active={activeTab === 'orders'}
          onClick={() => setActiveTab('orders')}
        />
      </nav>
    </div>
  );
}

interface TabButtonProps {
  label: string;
  icon: string;
  testId: string;
  active: boolean;
  badge?: number;
  onClick: () => void;
}

function TabButton({ label, icon, testId, active, badge, onClick }: TabButtonProps) {
  return (
    <button
      data-testid={testId}
      onClick={onClick}
      aria-pressed={active}
      aria-label={label}
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
        color: active ? 'var(--tab-active)' : 'var(--tab-inactive)',
        fontSize: '0.7rem',
        fontWeight: active ? 700 : 400,
        transition: 'color var(--transition-fast)',
        position: 'relative',
        minHeight: '44px', // 44px touch target
      }}
    >
      <span style={{ fontSize: '1.25rem', lineHeight: 1 }}>{icon}</span>
      <span>{label}</span>
      {badge !== undefined && badge > 0 && (
        <span
          style={{
            position: 'absolute',
            top: '0.3rem',
            right: 'calc(50% - 1rem)',
            background: 'var(--accent)',
            color: '#fff',
            borderRadius: '50%',
            width: '1.1rem',
            height: '1.1rem',
            fontSize: '0.65rem',
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          aria-label={`${badge} items in cart`}
        >
          {badge}
        </span>
      )}
    </button>
  );
}
