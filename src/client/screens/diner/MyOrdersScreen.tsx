import React, { useState, useEffect, useCallback } from 'react';
import { SSEEvent } from '../../hooks/useTableSSE.js';
import { HelpCardFeature, TrackerFeature, SameAgainFeature } from '../../diner/features/registry.js';

import type { DinerOrder, DinerOrderStatus } from '../../diner/features/menuTypes.js';
import { Icon } from '../../components/ui/Icon.js';

type OrderStatus = DinerOrderStatus;
type Order = DinerOrder;

interface MyOrdersScreenProps {
  tableId: string;
  lastSSEEvent: SSEEvent | null;
  /** The table's live events (the call card listens to them). */
  events?: SSEEvent[];
  /** "Same again" finished: the one notice for the Cart (BR8.2). */
  onSameAgain?: (notice: string) => void;
}

const STATUS_ICONS: Record<OrderStatus, string> = {
  Pending: '⏳',
  Preparing: '🔥',
  Completed: '✓',
  Cancelled: '✗',
};

const STATUS_COLOURS: Record<OrderStatus, { bg: string; color: string }> = {
  Pending: { bg: 'var(--status-pending-soft)', color: 'var(--status-pending)' },
  Preparing: { bg: 'var(--status-preparing-soft)', color: 'var(--status-preparing)' },
  Completed: { bg: 'var(--status-completed-soft)', color: 'var(--status-completed)' },
  Cancelled: { bg: 'var(--status-cancelled-soft)', color: 'var(--status-cancelled)' },
};

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatPrice(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export default function MyOrdersScreen({ tableId, lastSSEEvent, events, onSameAgain }: MyOrdersScreenProps) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Which order is showing the inline cancel confirm dialog
  const [confirmCancelOrderNum, setConfirmCancelOrderNum] = useState<number | null>(null);
  const [cancellingOrderNum, setCancellingOrderNum] = useState<number | null>(null);
  const [cancelNotice, setCancelNotice] = useState<string | null>(null);
  // A cancel that never reached the server: shown in that order's own card.
  const [cancelErrors, setCancelErrors] = useState<Record<number, string>>({});

  const fetchOrders = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch(`/api/tables/${tableId}/orders?visit=current`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { orders: Order[] };
      setOrders(data.orders);
    } catch {
      setError('Failed to load orders.');
    } finally {
      setLoading(false);
    }
  }, [tableId]);

  // Fetch on mount
  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  // Re-fetch when order events arrive via SSE
  useEffect(() => {
    if (lastSSEEvent?.type === 'ORDER_STATUS_CHANGED' || lastSSEEvent?.type === 'ORDER_PLACED') {
      fetchOrders();
    }
  }, [lastSSEEvent, fetchOrders]);

  async function handleConfirmCancel(orderNumber: number) {
    setCancellingOrderNum(orderNumber);
    setConfirmCancelOrderNum(null);
    setCancelNotice(null);
    setCancelErrors((prev) => {
      const { [orderNumber]: _gone, ...rest } = prev;
      return rest;
    });
    try {
      const res = await fetch(`/api/orders/${orderNumber}/transition`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: 'Cancelled', by: 'diner' }),
      });
      // Staff may have started the order first: say so instead of silently doing nothing
      if (res.status === 422) {
        setCancelNotice(`Order #${orderNumber} can no longer be cancelled; the kitchen has already started it.`);
      } else if (!res.ok) {
        setCancelNotice(`We could not cancel order #${orderNumber}. Please try again.`);
      }
      // Re-fetch orders to show updated status
      await fetchOrders();
    } catch {
      // The request never reached the server (or its answer never came back): say so in the order's
      // card. The orders are not re-fetched here, because the connection is the likely problem and a
      // failed re-fetch would replace the whole list with a load error and hide this message.
      setCancelErrors((prev) => ({
        ...prev,
        [orderNumber]: "We couldn't cancel this order. Check your connection and try again.",
      }));
    } finally {
      setCancellingOrderNum(null);
    }
  }

  if (loading) {
    return (
      <div data-testid="orders-loading" style={{ padding: '1rem' }}>
        {[1, 2].map((n) => (
          <div
            key={n}
            className="skeleton"
            style={{
              height: '5rem',
              borderRadius: '0.75rem',
              marginBottom: '0.75rem',
            }}
          />
        ))}
        <style>{`
          @keyframes shimmer {
            0% { background-position: 200% 0; }
            100% { background-position: -200% 0; }
          }
          @media (prefers-reduced-motion: reduce) {
            * { animation: none !important; }
          }
        `}</style>
      </div>
    );
  }

  if (error) {
    return (
      <div
        style={{ padding: '2rem 1rem', textAlign: 'center', color: 'var(--text-secondary)' }}
      >
        <p>{error}</p>
      </div>
    );
  }

  if (orders.length === 0) {
    return (
      <div
        data-testid="orders-empty"
        className="pop-in"
        style={{
          textAlign: 'center',
          color: 'var(--text-secondary)',
          padding: '3rem 1rem',
        }}
      >
        <span className="empty-ico float" aria-hidden="true"><Icon name="receipt" size={30} /></span>
        <p style={{ fontWeight: 500 }}>No orders yet</p>
        <p style={{ fontSize: '0.875rem', marginTop: '0.25rem', color: 'var(--text-muted)' }}>
          Add items from the menu
        </p>
      </div>
    );
  }

  // The bill can be asked for once every order that is not cancelled is completed.
  const live = orders.filter((o) => o.status !== 'Cancelled');
  const canAskBill = live.length > 0 && live.every((o) => o.status === 'Completed');

  return (
    <div data-testid="orders-screen" style={{ padding: '1rem', paddingBottom: '5rem' }}>
      {/* Mount points U6 fills (BR14.2): the call card, the tracker and "Same again" */}
      <HelpCardFeature tableId={tableId} events={events} canAskBill={canAskBill} />
      {cancelNotice && (
        <div
          data-testid="cancel-notice"
          role="alert"
          style={{
            marginBottom: '0.75rem',
            padding: '0.6rem 0.9rem',
            borderRadius: '0.6rem',
            background: 'var(--status-pending-soft)',
            color: 'var(--status-pending)',
            fontSize: '0.9rem',
          }}
        >
          {cancelNotice}
        </div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {orders.map((order, index) => {
          const style = STATUS_COLOURS[order.status];
          const icon = STATUS_ICONS[order.status];
          const isCancelling = cancellingOrderNum === order.order_number;
          const showCancelConfirm = confirmCancelOrderNum === order.order_number;

          return (
            <div
              key={order.order_number}
              data-testid={`order-card-${order.order_number}`}
              className="stagger hover-lift"
              style={{
                '--i': index,
                borderRadius: 'var(--radius-md)',
                background: 'var(--bg-raised)',
                border: '1px solid var(--border)',
                boxShadow: 'var(--shadow-card)',
                overflow: 'hidden',
              } as React.CSSProperties}
            >
              {/* Header row */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0.75rem',
                  borderBottom: '1px solid var(--border)',
                }}
              >
                <span style={{ fontWeight: 700 }}>Order #{order.order_number}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span
                    key={order.status}
                    className="status-flash"
                    data-testid={`order-status-${order.order_number}`}
                    style={{
                      padding: '0.2rem 0.65rem',
                      borderRadius: '999px',
                      background: style.bg,
                      color: style.color,
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.3rem',
                    }}
                  >
                    <span aria-hidden="true">{icon}</span>
                    {order.status}
                  </span>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    {formatTime(order.placed_at)}
                  </span>
                </div>
              </div>

              {/* U6: the tracker (US14.1) and the wait text (US9.1), beside the status */}
              <div style={{ padding: '0 0.75rem' }}>
                <TrackerFeature tableId={tableId} order={order} />
              </div>

              {/* Line items */}
              <div style={{ padding: '0.5rem 0.75rem 0.75rem' }}>
                {order.lines.map((line, lineIndex) => (
                  <div
                    key={`${line.menu_item_id}-${lineIndex}`}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      padding: '0.3rem 0',
                      fontSize: '0.9rem',
                    }}
                  >
                    <span>
                      {line.quantity}× {line.name}
                      {/* U6: the options the line was ordered with */}
                      {line.options && line.options.length > 0 && (
                        <span
                          className="secondary"
                          data-testid={`order-line-options-${order.order_number}-${lineIndex}`}
                          style={{ display: 'block', fontSize: '0.8rem', paddingLeft: '1rem' }}
                        >
                          {line.options.map((o) => o.label).join(', ')}
                        </span>
                      )}
                    </span>
                    <span style={{ color: 'var(--text)', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                      {formatPrice(line.subtotal_cents)}
                    </span>
                  </div>
                ))}
              </div>

              {/* U6 US16.1: "Same again" on a past order (renders only for a Completed one) */}
              <div style={{ padding: '0 0.75rem 0.75rem', display: order.status === 'Completed' ? undefined : 'none' }}>
                <SameAgainFeature tableId={tableId} order={order} onDone={onSameAgain} />
              </div>

              {/* Cancel button — only for Pending orders */}
              {order.status === 'Pending' && (
                <div style={{ padding: '0 0.75rem 0.75rem' }}>
                  {cancelErrors[order.order_number] && (
                    <p
                      data-testid={`cancel-error-${order.order_number}`}
                      role="alert"
                      style={{
                        margin: '0 0 0.5rem',
                        padding: '0.5rem 0.7rem',
                        borderRadius: '0.5rem',
                        background: 'var(--danger-soft)',
                        color: 'var(--danger)',
                        fontSize: '0.85rem',
                      }}
                    >
                      {cancelErrors[order.order_number]}
                    </p>
                  )}
                  {showCancelConfirm ? (
                    /* Inline confirm dialog */
                    <div
                      data-testid={`cancel-confirm-${order.order_number}`}
                      style={{
                        padding: '0.65rem 0.75rem',
                        borderRadius: '0.5rem',
                        background: 'var(--danger-soft)',
                        border: '1px solid var(--danger)',
                      }}
                    >
                      <p style={{ fontSize: '0.85rem', marginBottom: '0.5rem', fontWeight: 500 }}>
                        Cancel order #{order.order_number}?
                      </p>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button
                          data-testid={`btn-confirm-cancel-${order.order_number}`}
                          onClick={() => handleConfirmCancel(order.order_number)}
                          style={{
                            flex: 1,
                            padding: '0.45rem',
                            borderRadius: '0.4rem',
                            border: 'none',
                            background: 'var(--danger)',
                            color: 'var(--bg)',
                            cursor: 'pointer',
                            fontSize: '0.8rem',
                            fontWeight: 600,
                          }}
                        >
                          Yes, cancel
                        </button>
                        <button
                          data-testid={`btn-keep-order-${order.order_number}`}
                          onClick={() => setConfirmCancelOrderNum(null)}
                          style={{
                            flex: 1,
                            padding: '0.45rem',
                            borderRadius: '0.4rem',
                            border: '1px solid var(--border-strong)',
                            background: 'transparent',
                            color: 'inherit',
                            cursor: 'pointer',
                            fontSize: '0.8rem',
                          }}
                        >
                          Keep it
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      data-testid={`btn-cancel-order-${order.order_number}`}
                      onClick={() => setConfirmCancelOrderNum(order.order_number)}
                      disabled={isCancelling}
                      style={{
                        padding: '0.4rem 0.9rem',
                        borderRadius: '0.4rem',
                        border: '1px solid var(--danger)',
                        background: 'transparent',
                        color: 'var(--danger)',
                        cursor: isCancelling ? 'not-allowed' : 'pointer',
                        fontSize: '0.8rem',
                        fontWeight: 500,
                        opacity: isCancelling ? 0.5 : 1,
                      }}
                    >
                      {isCancelling ? 'Cancelling…' : 'Cancel order'}
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
