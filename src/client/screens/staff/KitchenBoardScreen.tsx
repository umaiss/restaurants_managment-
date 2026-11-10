import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useBoardOrders } from '../../hooks/useBoardOrders';
import type { Order, OpenCall } from '../../hooks/useBoardOrders';
import { useSoundPreference } from '../../hooks/useSoundPreference';
import OrderCard from '../../components/staff/OrderCard';
import MenuAvailabilityPanel from '../../components/staff/MenuAvailabilityPanel';
import StationTabs from '../../staff/board/StationTabs';
import StationBoard from '../../staff/board/StationBoard';
import NewOrderBanner, { SoundSwitch } from '../../staff/board/NewOrderBanner';
import { CallLabels, CallRespond } from '../../staff/board/CallPulse';
import { ALL_STATIONS, type BoardTab, type StationName } from '../../staff/board/constants';
import '../../staff/staff-u7.css';
import { Icon } from '../../components/ui/Icon.js';

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
        color: 'var(--text-muted)',
      }}
    >
      <span className="empty-ico float" aria-hidden="true"><Icon name="kitchen" size={30} /></span>
      <p style={{ fontSize: '0.95rem', textAlign: 'center', maxWidth: '24rem', margin: 0 }}>
        No open orders right now. Orders will appear here within 2 seconds of placement.
      </p>
    </div>
  );
}

export default function KitchenBoardScreen() {
  const { ordersByTable, loading, connected, error, callsByTable, events, reload } = useBoardOrders();
  const { muted, setMuted } = useSoundPreference();
  const [tab, setTab] = useState<BoardTab>(ALL_STATIONS);
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
  // A table that is calling is on the board too (BR3.2), even if it has no order left to show.
  const tableIds = new Set<number>([...ordersByTable.keys(), ...callsByTable.keys()]);
  const activeTables = Array.from(tableIds)
    .map((id): [number, Order[]] => [id, ordersByTable.get(id) ?? []])
    .filter(([id, orders]) => orders.length > 0 || (callsByTable.get(id)?.length ?? 0) > 0)
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
            background: 'var(--pending-soft)',
            border: '1px solid var(--pending)',
            color: 'var(--pending)',
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
                background: connected ? 'var(--completed)' : 'var(--danger)',
              }}
            />
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Updated live</span>
          </span>
          {/* U7 BR3.1: the Sound on / Muted switch is in the page header */}
          <SoundSwitch muted={muted} setMuted={setMuted} />
          <button
            onClick={() => setPanelOpen(true)}
            style={{
              padding: '0.4rem 0.9rem',
              borderRadius: '0.375rem',
              border: '1px solid var(--border-strong)',
              background: 'none',
              color: 'var(--text)',
              minHeight: 'var(--touch)',
              fontSize: '0.85rem',
              cursor: 'pointer',
            }}
          >
            Menu availability
          </button>
        </div>
      </div>

      {/* U7 BR3.1: the new-order alert; BR1.1: the station tabs */}
      <div className="stack" style={{ marginBottom: '1rem' }}>
        <NewOrderBanner events={events} muted={muted} />
        <StationTabs selected={tab} onSelect={setTab} />
      </div>

      {/* A station tab shows that station's tickets (BR1.1) */}
      {tab !== ALL_STATIONS && <StationBoard station={tab as StationName} events={events} connected={connected} />}

      {/* Content (All stations: v1's cards, BR1.4) */}
      {tab === ALL_STATIONS && loading && <BoardShimmer />}
      {tab === ALL_STATIONS && !loading && error && (
        <div data-testid="board-error" role="alert" className="stack">
          <p style={{ margin: 0 }}>The tables could not be loaded. Try again.</p>
          <button type="button" className="btn btn-sm" onClick={reload}>
            Retry
          </button>
        </div>
      )}
      {tab === ALL_STATIONS && !loading && !error && activeTables.length === 0 && <BoardEmptyState />}
      {tab === ALL_STATIONS && !loading && activeTables.length > 0 && (
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
              calls={callsByTable.get(tableId) ?? []}
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
  calls: OpenCall[];
}

function TableSection({ index, tableId, orders, calls }: TableSectionProps) {
  const calling = calls.length > 0;
  const hasOpenOrder = orders.some((o) => o.status === 'Pending' || o.status === 'Preparing');

  // The card lists the table's orders newest first by placed_at. While the table has an open order,
  // cancelled orders are left off the card; once nothing is open, every order shows as it is.
  const visibleOrders = [...orders]
    .filter((o) => !hasOpenOrder || o.status !== 'Cancelled')
    .sort((a, b) => b.placed_at.localeCompare(a.placed_at) || b.order_number - a.order_number);

  return (
    <section
      data-testid={`table-section-${tableId}`}
      className={calling ? 'stagger u7-pulse' : 'stagger'}
      style={{
        '--i': index,
        background: 'var(--bg-raised)',
        borderRadius: 'var(--radius-md)',
        padding: '0.875rem',
        border: calling ? '1px solid var(--danger)' : '1px solid var(--border)',
        boxShadow: 'var(--shadow-card)',
      } as React.CSSProperties}
    >
      {/* Table card header */}
      <div style={{ marginBottom: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', flexWrap: 'wrap' }}>
        <Link
          to={`/staff/tables/${tableId}`}
          aria-label={`Open bill for Table ${tableId}`}
          className="table-link"
          style={{
            fontSize: '1rem',
            fontWeight: 700,
            color: 'var(--accent-text)',
            textDecoration: 'none',
          }}
        >
          Table {tableId} →
        </Link>
        {/* U7 BR3.2: the words of the table's open requests sit on the card's header row */}
        <CallLabels tableId={tableId} calls={calls} />
      </div>
      {!hasOpenOrder && orders.length > 0 && (
        <p
          data-testid={`table-ready-to-close-${tableId}`}
          style={{ margin: '0 0 0.75rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}
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
      {/* U7 BR3.2: Respond, at the foot of the card; the pulse stops when the response event arrives */}
      <CallRespond tableId={tableId} calls={calls} />
    </section>
  );
}
