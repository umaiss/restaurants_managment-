import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { useTableSSE } from '../hooks/useTableSSE.js';
import { useCart, storedCartLineIds, readClosedMarker, writeClosedMarker } from '../hooks/useCart.js';
import DinerTabBar, { type DinerTab } from '../components/diner/DinerTabBar.js';
import { BrandMark } from '../components/ui/Icon.js';
import TableClosedTakeover from '../components/diner/TableClosedTakeover.js';
import MenuScreen from '../screens/diner/MenuScreen.js';
import CartScreen, { type PlacedOrder } from '../screens/diner/CartScreen.js';
import MyOrdersScreen from '../screens/diner/MyOrdersScreen.js';
import { SettingsFeature, ReadyBannerFeature, RatingFeature, ReceiptFeature } from '../diner/features/registry.js';
import { useTheme } from '../hooks/useTheme.js';

export default function TableView() {
  const { id: tableId } = useParams<{ id: string }>();
  const [activeTab, setActiveTab] = useState<DinerTab>('menu');
  const [tableClosed, setTableClosed] = useState(false);
  const [showReconnectBanner, setShowReconnectBanner] = useState(false);
  const [placedOrder, setPlacedOrder] = useState<PlacedOrder | null>(null);
  // The notice "Same again" leaves for the Cart (U6 BR8.2); it goes when the diner leaves the Cart.
  const [sameAgainNotice, setSameAgainNotice] = useState<string | null>(null);
  // Apply the saved theme on every diner page (BR10.2); U6's Settings sheet changes it through the same hook.
  useTheme();

  useEffect(() => {
    if (activeTab !== 'cart') setSameAgainNotice(null);
  }, [activeTab]);

  // After an order is placed the diner lands on My orders; the confirmation stays for 3 seconds.
  useEffect(() => {
    if (!placedOrder) return;
    const timer = setTimeout(() => setPlacedOrder(null), 3000);
    return () => clearTimeout(timer);
  }, [placedOrder]);

  // SSE connection for live events
  const { lastEvent, events, connected } = useTableSSE(tableId);

  // Cart state: now synced via cart-updated CustomEvent from useCart.
  const { items, totalCents, clearCart, removeLines } = useCart(tableId ?? '');

  // Each check of the table's last-closed value takes a number; only the newest check may act on its
  // answer. A live TABLE_CLOSED takes a number too, so an answer that was already on its way when the
  // table closed is ignored and can never overwrite the newer value.
  const checkSeqRef = useRef(0);

  // Handle TABLE_CLOSED event: show takeover, clear cart. Read every event, so a
  // TABLE_CLOSED that arrives together with another event is not missed.
  const processedSeqRef = useRef(0);
  useEffect(() => {
    for (const ev of events) {
      const seq = ev.seq ?? 0;
      if (seq <= processedSeqRef.current) continue;
      processedSeqRef.current = seq;
      if (ev.type === 'TABLE_CLOSED') {
        checkSeqRef.current += 1; // any check still waiting for its answer is now out of date
        setTableClosed(true);
        clearCart();
        // Remember this close, so reopening the page does not treat it as news.
        const archived = (ev.data as { archived_visit_id?: unknown } | null)?.archived_visit_id;
        if (tableId && typeof archived === 'string') writeClosedMarker(tableId, archived);
      }
    }
  }, [events, clearCart, tableId]);

  // A table can be closed while this device is away (tab closed, offline). The device keeps the
  // `last_closed_visit_id` it last saw; when the page opens, and again when the live stream comes
  // back, a different value means the table was closed meanwhile: the old cart goes and the
  // table-closed message shows, exactly as the live event does (FR3.6).
  const checkTableReset = useCallback(async () => {
    if (!tableId) return;
    const myCheck = ++checkSeqRef.current;
    // The lines the cart holds as this check starts. Only these can be old; a line added while the
    // answer is on its way belongs to the current visit.
    const linesAtStart = storedCartLineIds(tableId);
    let lastClosed: string | null;
    try {
      const res = await fetch(`/api/tables/${tableId}`);
      if (!res.ok) return;
      const data = (await res.json()) as { last_closed_visit_id?: string | null };
      if (data.last_closed_visit_id === undefined) return; // an older server: nothing to compare
      lastClosed = data.last_closed_visit_id;
    } catch {
      return; // offline: try again at the next reconnect
    }
    // A newer check, or a live TABLE_CLOSED, has happened since this one started: its answer is old.
    if (myCheck !== checkSeqRef.current) return;

    const seen = readClosedMarker(tableId);
    if (seen === undefined) {
      // This device has not seen the table before. A cart with no record of when it was started
      // cannot be trusted to belong to the current visit, so those lines go (quietly). This is decided
      // now, from the cart as it is now: a line added while the answer was on its way stays.
      removeLines(linesAtStart);
    } else if (seen !== lastClosed) {
      clearCart();
      setTableClosed(true);
    }
    writeClosedMarker(tableId, lastClosed);
  }, [tableId, clearCart, removeLines]);

  useEffect(() => {
    void checkTableReset();
  }, [checkTableReset]);

  const wasConnectedRef = useRef(false);
  const everConnectedRef = useRef(false);
  useEffect(() => {
    if (connected && !wasConnectedRef.current && everConnectedRef.current) void checkTableReset();
    if (connected) everConnectedRef.current = true;
    wasConnectedRef.current = connected;
  }, [connected, checkTableReset]);

  // Show reconnect banner after 3 s of SSE disconnection
  useEffect(() => {
    if (connected) {
      setShowReconnectBanner(false);
      return;
    }
    const timer = setTimeout(() => setShowReconnectBanner(true), 3000);
    return () => clearTimeout(timer);
  }, [connected]);

  // Feedback submitted: leave the closed screen and start again from the Menu.
  const backToMenu = useCallback(() => {
    setTableClosed(false);
    setPlacedOrder(null);
    setActiveTab('menu');
  }, []);

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
      className="diner-shell"
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
          borderBottom: '1px solid var(--border)',
          background: 'var(--bg-bar)',
          backdropFilter: 'blur(14px)',
          WebkitBackdropFilter: 'blur(14px)',
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <BrandMark size={40} />
          <div style={{ flex: 1 }}>
            <h1
              style={{
                fontSize: '1.25rem',
                fontWeight: 700,
                letterSpacing: '-0.01em',
                margin: 0,
              }}
            >
              Table {tableId}
            </h1>
            {/* SSE connection indicator, in words as well as colour */}
            <span
              data-testid="live-status"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontSize: 'var(--text-xs)', color: connected ? 'var(--completed)' : 'var(--danger)' }}
            >
              <span
                title={connected ? 'Live' : 'Reconnecting…'}
                className={connected ? 'live-dot' : undefined}
                style={{
                  width: '0.5rem',
                  height: '0.5rem',
                  borderRadius: '50%',
                  background: connected ? 'var(--completed)' : 'var(--danger)',
                  flexShrink: 0,
                }}
              />
              {connected ? 'Updated live' : 'Reconnecting…'}
            </span>
          </div>
          {/* Mount point U6 fills (BR14.2): the Settings gear and sheet */}
          <SettingsFeature tableId={tableId} events={events} />
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
            className="fade-in"
            role="status"
            style={{
              margin: '0.5rem 1rem',
              padding: '0.5rem 0.75rem',
              borderRadius: '0.5rem',
              background: 'var(--pending-soft)',
              border: '1px solid var(--pending)',
              color: 'var(--pending)',
              fontSize: '0.8rem',
              textAlign: 'center',
            }}
          >
            Reconnecting… Updates will resume shortly.
          </div>
        )}
        {/* Mount point U6 fills (BR14.2): the "Order is ready" banner, on every tab */}
        <ReadyBannerFeature tableId={tableId} events={events} />
        <div key={activeTab} className="screen-enter">
        {activeTab === 'menu' && <MenuScreen tableId={tableId} events={events} />}
        {placedOrder && placedOrder.droppedLines.length === 0 && (
          <div
            data-testid="order-success-banner"
            className="pop-in"
            role="status"
            style={{
              margin: '0.5rem 1rem',
              padding: '0.75rem 1rem',
              borderRadius: '0.75rem',
              background: 'var(--completed-soft)',
              border: '1px solid var(--completed)',
              color: 'var(--completed)',
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
              background: 'var(--pending-soft)',
              border: '1px solid var(--pending)',
              color: 'var(--pending)',
            }}
          >
            <p style={{ fontWeight: 600, margin: '0 0 0.25rem' }}>
              Order #{placedOrder.orderNumber} placed. The rest of your order went through.
            </p>
            <ul style={{ fontSize: '0.85rem', margin: 0, paddingLeft: '1.2rem' }}>
              {placedOrder.droppedLines.map((l) => (
                <li key={l.menu_item_id}>
                  {l.quantity}× {l.name} {l.reason ?? 'sold out'} and was removed
                </li>
              ))}
            </ul>
          </div>
        )}
        {activeTab === 'cart' && (
          <CartScreen
            tableId={tableId}
            events={events}
            notice={sameAgainNotice}
            onBackToMenu={() => setActiveTab('menu')}
            onOrderPlaced={(placed) => {
              setSameAgainNotice(null);
              setPlacedOrder(placed);
              setActiveTab('orders');
            }}
          />
        )}
        {activeTab === 'orders' && (
          <MyOrdersScreen
            tableId={tableId}
            lastSSEEvent={lastEvent}
            events={events}
            onSameAgain={(notice) => {
              // U6 BR8.2: the Cart opens with the one notice
              setSameAgainNotice(notice);
              setActiveTab('cart');
            }}
          />
        )}
        </div>
      </main>

      {/* Sticky cart summary above the tab bar (Menu only, while the cart has items) */}
      {showCartSummary && (
        <div
          data-testid="menu-cart-summary"
          className="diner-fixed slide-up"
          style={{
            // A frosted rounded card floating just above the tab bar (mockup cart-bar)
            position: 'fixed',
            bottom: 'calc(var(--tab-bar-height, 56px) + var(--space-2))',
            left: 0,
            right: 0,
            width: 'calc(100% - 2 * var(--space-4))',
            maxWidth: 'calc(var(--diner-max) - 2 * var(--space-4))',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '0.75rem',
            padding: '0.6rem 1rem',
            background: 'var(--bg-bar)',
            backdropFilter: 'blur(14px)',
            WebkitBackdropFilter: 'blur(14px)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-lg)',
            boxShadow: 'var(--shadow-card)',
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
            className="btn-primary"
            onClick={() => setActiveTab('cart')}
            style={{
              padding: '0.55rem 1.1rem',
              borderRadius: '999px',
              border: 'none',
              background: 'var(--accent)',
              color: 'var(--accent-fg)',
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
      {/* U6 BR6.2: Rate your meal sits below the closed message, once the table is closed */}
      <TableClosedTakeover visible={tableClosed}>
        {tableClosed && <ReceiptFeature tableId={tableId} events={events} />}
        {tableClosed && <RatingFeature tableId={tableId} events={events} onDone={backToMenu} />}
      </TableClosedTakeover>
    </div>
  );
}
