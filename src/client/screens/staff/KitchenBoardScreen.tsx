import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useBoardOrders } from '../../hooks/useBoardOrders';
import type { Order, OrderStatus } from '../../hooks/useBoardOrders';
import OrderCard from '../../components/staff/OrderCard';
import MenuAvailabilityPanel from '../../components/staff/MenuAvailabilityPanel';

function BoardShimmer() {
  return (
    <div data-testid="board-loading" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className="skeleton"
          style={{
            height: '120px',
            borderRadius: '0.5rem',
          }}
        />
      ))}
    </div>
  );
}

function BoardEmptyState() {
  return (
    <div
      data-testid="board-empty"
      className="pop-in"
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '40vh',
        gap: '0.75rem',
        color: 'var(--text-muted, #64748b)',
      }}
    >
      <span className="float" style={{ fontSize: '2.5rem' }}>⚪</span>
      <p style={{ fontSize: '0.95rem', textAlign: 'center', maxWidth: '24rem', margin: 0 }}>
        No open orders right now. Orders will appear here within 2 seconds of placement.
      </p>
    </div>
  );
}

export default function KitchenBoardScreen() {
  const { ordersByTable, loading, connected } = useBoardOrders();
  const [panelOpen, setPanelOpen] = useState(false);
  const [showReconnectBanner, setShowReconnectBanner] = useState(false);

  // Show reconnect banner after the connection has been down for more than 3 seconds
  useEffect(() => {
    if (connected) {
      setShowReconnectBanner(false);
      return;
    }
    const timer = setTimeout(() => {
      setShowReconnectBanner(true);
    }, 3000);
    return () => clearTimeout(timer);
  }, [connected]);

  const closePanel = useCallback(() => setPanelOpen(false), []);

  // A table is on the board while its current visit has any order, whatever its status, and leaves it
  // when the table is closed. (A table whose orders are all finished stays, so staff can open its bill.)
  // Use ordersByTable directly as the single source of truth (SSE-driven).
  const activeTables = Array.from(ordersByTable.entries())
    .filter(([, orders]) => orders.length > 0)
    .sort(([a], [b]) => a - b);

  return (
    <div data-testid="kitchen-board" data-sse={connected ? 'connected' : 'disconnected'} style={{ padding: '1rem', paddingBottom: '2rem' }}>
      {/* Reconnect banner */}
      {showReconnectBanner && (
        <div
          data-testid="reconnect-banner"
          className="fade-in"
          style={{
            padding: '0.5rem 1rem',
            marginBottom: '1rem',
            borderRadius: '0.375rem',
            background: 'rgba(245,158,11,0.15)',
            border: '1px solid rgba(245,158,11,0.3)',
            color: '#f59e0b',
            fontSize: '0.875rem',
            textAlign: 'center',
          }}
        >
          Reconnecting… Updates will resume shortly.
        </div>
      )}

      {/* Board header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '1.25rem',
        }}
      >
        <h1 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0 }}>Kitchen Board</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <span
              aria-hidden="true"
              className={connected ? 'live-dot' : undefined}
              style={{
                width: '0.45rem',
                height: '0.45rem',
                borderRadius: '50%',
                background: connected ? '#22c55e' : '#ef4444',
              }}
            />
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary, #94a3b8)' }}>Updated live</span>
          </span>
          <button
            onClick={() => setPanelOpen(true)}
            style={{
              padding: '0.4rem 0.9rem',
              borderRadius: '0.375rem',
              border: '1px solid var(--border, rgba(255,255,255,0.15))',
              background: 'none',
              color: 'var(--text-primary, #f8fafc)',
              fontSize: '0.85rem',
              cursor: 'pointer',
            }}
          >
            Menu availability
          </button>
        </div>
      </div>

      {/* Content */}
      {loading && <BoardShimmer />}
      {!loading && activeTables.length === 0 && <BoardEmptyState />}
      {!loading && activeTables.length > 0 && (
        <div
          data-testid="board-grid"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(20rem, 1fr))',
            gap: '1rem',
            alignItems: 'start',
          }}
        >
          {activeTables.map(([tableId, orders], index) => (
            <TableSection
              key={tableId}
              index={index}
              tableId={tableId}
              orders={orders}
            />
          ))}
        </div>
      )}

      {/* Menu availability side panel */}
      {panelOpen && <MenuAvailabilityPanel onClose={closePanel} />}
    </div>
  );
}

interface TableSectionProps {
  index: number;
  tableId: number;
  orders: Order[];
}

function TableSection({ index, tableId, orders }: TableSectionProps) {
  const hasOpenOrder = orders.some((o) => o.status === 'Pending' || o.status === 'Preparing');

  // The card lists the table's orders newest first by placed_at. While the table has an open order,
  // cancelled orders are left off the card; once nothing is open, every order shows as it is.
  const visibleOrders = [...orders]
    .filter((o) => !hasOpenOrder || o.status !== 'Cancelled')
    .sort((a, b) => b.placed_at.localeCompare(a.placed_at) || b.order_number - a.order_number);

  return (
    <section
      data-testid={`table-section-${tableId}`}
      className="stagger"
      style={{
        '--i': index,
        background: 'var(--bg-secondary, #1e1e2e)',
        borderRadius: '0.75rem',
        padding: '0.875rem',
        border: '1px solid rgba(255,255,255,0.08)',
        boxShadow: 'var(--shadow-card)',
      } as React.CSSProperties}
    >
      {/* Table card header */}
      <div style={{ marginBottom: '0.75rem' }}>
        <Link
          to={`/staff/tables/${tableId}`}
          aria-label={`Open bill for Table ${tableId}`}
          className="table-link"
          style={{
            fontSize: '1rem',
            fontWeight: 700,
            color: 'var(--accent, #f59e0b)',
            textDecoration: 'none',
          }}
        >
          Table {tableId} →
        </Link>
      </div>
      {!hasOpenOrder && (
        <p
          data-testid={`table-ready-to-close-${tableId}`}
          style={{ margin: '0 0 0.75rem', fontSize: '0.85rem', color: 'var(--text-secondary, #94a3b8)' }}
        >
          No open orders. Open the bill to close this table.
        </p>
      )}
      {visibleOrders.map((order) => (
        <OrderCard
          key={order.order_number}
          order={order}
        />
      ))}
    </section>
  );
}
