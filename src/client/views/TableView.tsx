import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { useTableSSE } from '../hooks/useTableSSE.js';
import { useCart } from '../hooks/useCart.js';
import DinerTabBar, { type DinerTab } from '../components/diner/DinerTabBar.js';
import TableClosedTakeover from '../components/diner/TableClosedTakeover.js';
import MenuScreen from '../screens/diner/MenuScreen.js';
import CartScreen, { type PlacedOrder } from '../screens/diner/CartScreen.js';
import MyOrdersScreen from '../screens/diner/MyOrdersScreen.js';

export default function TableView() {
  const { id: tableId } = useParams<{ id: string }>();
  const [activeTab, setActiveTab] = useState<DinerTab>('menu');
  const [tableClosed, setTableClosed] = useState(false);
  const [showReconnectBanner, setShowReconnectBanner] = useState(false);
  const [placedOrder, setPlacedOrder] = useState<PlacedOrder | null>(null);

  // After an order is placed the diner lands on My orders; the confirmation stays for 3 seconds.
  useEffect(() => {
    if (!placedOrder) return;
    const timer = setTimeout(() => setPlacedOrder(null), 3000);
    return () => clearTimeout(timer);
  }, [placedOrder]);

  // SSE connection for live events
  const { lastEvent, events, connected } = useTableSSE(tableId);

  // Cart state: now synced via cart-updated CustomEvent from useCart.
  const { items, totalCents, clearCart } = useCart(tableId ?? '');

  // Derive a stable visitId from the session. The server uses the current open
  // visit for a table; we pass it through so screens can pass it in API calls.
  const [visitId] = useState<string>(() => {
    // Use sessionStorage so it persists for the tab session but resets on close.
    const key = `visit-id:table:${tableId}`;
    const existing = sessionStorage.getItem(key);
    if (existing) return existing;
    const newId = `visit-${Date.now()}`;
    sessionStorage.setItem(key, newId);
    return newId;
  });

  // Handle TABLE_CLOSED event: show takeover, clear cart. Read every event, so a
  // TABLE_CLOSED that arrives together with another event is not missed.
  const processedSeqRef = useRef(0);
  useEffect(() => {
    for (const ev of events) {
      const seq = ev.seq ?? 0;
      if (seq <= processedSeqRef.current) continue;
      processedSeqRef.current = seq;
      if (ev.type === 'TABLE_CLOSED') {
        setTableClosed(true);
        clearCart();
      }
    }
  }, [events, clearCart]);

  // Show reconnect banner after 3 s of SSE disconnection
  useEffect(() => {
    if (connected) {
      setShowReconnectBanner(false);
      return;
    }
    const timer = setTimeout(() => setShowReconnectBanner(true), 3000);
    return () => clearTimeout(timer);
  }, [connected]);

  const cartCount = items.reduce((sum, i) => sum + i.quantity, 0);
  // The Menu shows a sticky "View cart" summary above the tab bar while the cart has items.
  const showCartSummary = activeTab === 'menu' && cartCount > 0 && !tableClosed;

  if (!tableId) {
    return (
      <div style={{ padding: '2rem', color: 'var(--text-secondary)' }}>
        Invalid table URL
      </div>
    );
  }

  return (
    <div
      style={{
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--bg-primary)',
        color: 'var(--text-primary)',
        position: 'relative',
        overflowX: 'hidden',
      }}
    >
      {/* Header */}
      <header
        style={{
          padding: '1.25rem 1rem 0.75rem',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
          background: 'var(--bg-secondary)',
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <h1
            style={{
              fontSize: '1.25rem',
              fontWeight: 700,
              letterSpacing: '-0.01em',
              margin: 0,
              flex: 1,
            }}
          >
            Table {tableId}
          </h1>
          {/* SSE connection indicator */}
          <span
            title={connected ? 'Live' : 'Reconnecting…'}
            style={{
              width: '0.5rem',
              height: '0.5rem',
              borderRadius: '50%',
              background: connected ? '#22c55e' : '#ef4444',
              flexShrink: 0,
            }}
          />
        </div>
      </header>

      {/* Content area — grows to fill space above tab bar */}
      <main
        style={{
          flex: 1,
          overflowY: 'auto',
          // space for the fixed tab bar, and for the cart summary bar above it on the Menu
          paddingBottom: showCartSummary ? '7.5rem' : '56px',
        }}
      >
        {/* SSE reconnect banner */}
        {showReconnectBanner && (
          <div
            data-testid="reconnect-banner"
            role="status"
            style={{
              margin: '0.5rem 1rem',
              padding: '0.5rem 0.75rem',
              borderRadius: '0.5rem',
              background: 'rgba(234, 179, 8, 0.12)',
              border: '1px solid rgba(234, 179, 8, 0.25)',
              color: '#eab308',
              fontSize: '0.8rem',
              textAlign: 'center',
            }}
          >
            Reconnecting… Updates will resume shortly.
          </div>
        )}
        {activeTab === 'menu' && <MenuScreen tableId={tableId} events={events} />}
        {placedOrder && placedOrder.droppedLines.length === 0 && (
          <div
            data-testid="order-success-banner"
            role="status"
            style={{
              margin: '0.5rem 1rem',
              padding: '0.75rem 1rem',
              borderRadius: '0.75rem',
              background: 'rgba(34, 197, 94, 0.15)',
              border: '1px solid rgba(34, 197, 94, 0.3)',
              color: '#22c55e',
              fontWeight: 600,
              textAlign: 'center',
            }}
          >
            Order #{placedOrder.orderNumber} placed
          </div>
        )}
        {placedOrder && placedOrder.droppedLines.length > 0 && (
          <div
            data-testid="order-partial-banner"
            role="status"
            style={{
              margin: '0.5rem 1rem',
              padding: '0.75rem 1rem',
              borderRadius: '0.75rem',
              background: 'rgba(234, 179, 8, 0.15)',
              border: '1px solid rgba(234, 179, 8, 0.3)',
              color: '#eab308',
            }}
          >
            <p style={{ fontWeight: 600, margin: '0 0 0.25rem' }}>
              Order #{placedOrder.orderNumber} placed. The rest of your order went through.
            </p>
            <ul style={{ fontSize: '0.85rem', margin: 0, paddingLeft: '1.2rem' }}>
              {placedOrder.droppedLines.map((l) => (
                <li key={l.menu_item_id}>
                  {l.quantity}× {l.name} sold out and was removed
                </li>
              ))}
            </ul>
          </div>
        )}
        {activeTab === 'cart' && (
          <CartScreen
            tableId={tableId}
            visitId={visitId}
            onBackToMenu={() => setActiveTab('menu')}
            onOrderPlaced={(placed) => {
              setPlacedOrder(placed);
              setActiveTab('orders');
            }}
          />
        )}
        {activeTab === 'orders' && (
          <MyOrdersScreen
            tableId={tableId}
            visitId={visitId}
            lastSSEEvent={lastEvent}
          />
        )}
      </main>

      {/* Sticky cart summary above the tab bar (Menu only, while the cart has items) */}
      {showCartSummary && (
        <div
          data-testid="menu-cart-summary"
          style={{
            position: 'fixed',
            bottom: 'var(--tab-bar-height, 56px)',
            left: 0,
            right: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '0.75rem',
            padding: '0.6rem 1rem',
            background: 'var(--bg-tab-bar, rgba(15, 18, 22, 0.95))',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            borderTop: '1px solid var(--border, rgba(255,255,255,0.06))',
            zIndex: 90,
          }}
        >
          <button
            data-testid="menu-view-cart"
            onClick={() => setActiveTab('cart')}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-primary)',
              fontSize: '0.95rem',
              fontWeight: 600,
              cursor: 'pointer',
              textAlign: 'left',
              padding: '0.4rem 0',
            }}
          >
            View cart ({cartCount} item{cartCount !== 1 ? 's' : ''} · ${(totalCents / 100).toFixed(2)})
          </button>
          <button
            data-testid="menu-place-order"
            onClick={() => setActiveTab('cart')}
            style={{
              padding: '0.55rem 1.1rem',
              borderRadius: '999px',
              border: 'none',
              background: 'var(--accent, #ffb04a)',
              color: 'var(--accent-fg, #0f1216)',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Place →
          </button>
        </div>
      )}

      {/* Fixed bottom tab bar */}
      <DinerTabBar
        activeTab={activeTab}
        cartCount={cartCount}
        onTabChange={setActiveTab}
      />

      {/* Table closed overlay */}
      <TableClosedTakeover visible={tableClosed} />
    </div>
  );
}
