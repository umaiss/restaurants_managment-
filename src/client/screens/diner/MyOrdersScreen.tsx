import React, { useState, useEffect, useCallback } from 'react';
import { SSEEvent } from '../../hooks/useTableSSE.js';

interface OrderLine {
  menu_item_id: string;
  name: string;
  quantity: number;
  price_cents_each: number;
  subtotal_cents: number;
}

type OrderStatus = 'Pending' | 'Preparing' | 'Completed' | 'Cancelled';

interface Order {
  order_number: number;
  status: OrderStatus;
  placed_at: string;
  lines: OrderLine[];
}

interface MyOrdersScreenProps {
  tableId: string;
  visitId: string;
  lastSSEEvent: SSEEvent | null;
}

const STATUS_ICONS: Record<OrderStatus, string> = {
  Pending: '⏳',
  Preparing: '🔥',
  Completed: '✓',
  Cancelled: '✗',
};

const STATUS_COLOURS: Record<OrderStatus, { bg: string; color: string }> = {
  Pending: { bg: 'rgba(234, 179, 8, 0.15)', color: '#eab308' },
  Preparing: { bg: 'rgba(249, 115, 22, 0.15)', color: '#f97316' },
  Completed: { bg: 'rgba(34, 197, 94, 0.15)', color: '#22c55e' },
  Cancelled: { bg: 'rgba(239, 68, 68, 0.15)', color: '#ef4444' },
};

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatPrice(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export default function MyOrdersScreen({ tableId, visitId: _visitId, lastSSEEvent }: MyOrdersScreenProps) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Which order is showing the inline cancel confirm dialog
  const [confirmCancelOrderNum, setConfirmCancelOrderNum] = useState<number | null>(null);
  const [cancellingOrderNum, setCancellingOrderNum] = useState<number | null>(null);

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
    try {
      await fetch(`/api/orders/${orderNumber}/transition`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: 'Cancelled', by: 'diner' }),
      });
      // Re-fetch orders to show updated status
      await fetchOrders();
    } catch {
      // Silently re-fetch — the order may already be cancelled
      await fetchOrders();
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
            style={{
              height: '5rem',
              borderRadius: '0.75rem',
              background:
                'linear-gradient(90deg, var(--bg-secondary) 25%, var(--bg-muted, #2a2a3e) 50%, var(--bg-secondary) 75%)',
              backgroundSize: '200% 100%',
              animation: 'shimmer 1.5s infinite',
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
        style={{
          textAlign: 'center',
          color: 'var(--text-secondary)',
          padding: '3rem 1rem',
        }}
      >
        <span style={{ fontSize: '2.5rem', display: 'block', marginBottom: '0.75rem' }}>
          📋
        </span>
        <p style={{ fontWeight: 500 }}>No orders yet</p>
        <p style={{ fontSize: '0.875rem', marginTop: '0.25rem', color: 'var(--text-muted)' }}>
          Add items from the menu
        </p>
      </div>
    );
  }

  return (
    <div data-testid="orders-screen" style={{ padding: '1rem', paddingBottom: '5rem' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {orders.map((order) => {
          const style = STATUS_COLOURS[order.status];
          const icon = STATUS_ICONS[order.status];
          const isCancelling = cancellingOrderNum === order.order_number;
          const showCancelConfirm = confirmCancelOrderNum === order.order_number;

          return (
            <div
              key={order.order_number}
              data-testid={`order-card-${order.order_number}`}
              style={{
                borderRadius: '0.75rem',
                background: 'var(--bg-secondary)',
                boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
                overflow: 'hidden',
              }}
            >
              {/* Header row */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0.75rem',
                  borderBottom: '1px solid rgba(255,255,255,0.06)',
                }}
              >
                <span style={{ fontWeight: 700 }}>Order #{order.order_number}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span
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

              {/* Line items */}
              <div style={{ padding: '0.5rem 0.75rem 0.75rem' }}>
                {order.lines.map((line) => (
                  <div
                    key={line.menu_item_id}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      padding: '0.3rem 0',
                      fontSize: '0.9rem',
                    }}
                  >
                    <span>
                      {line.quantity}× {line.name}
                    </span>
                    <span style={{ color: 'var(--accent, #6366f1)', fontWeight: 600 }}>
                      {formatPrice(line.subtotal_cents)}
                    </span>
                  </div>
                ))}
              </div>

              {/* Cancel button — only for Pending orders */}
              {order.status === 'Pending' && (
                <div style={{ padding: '0 0.75rem 0.75rem' }}>
                  {showCancelConfirm ? (
                    /* Inline confirm dialog */
                    <div
                      data-testid={`cancel-confirm-${order.order_number}`}
                      style={{
                        padding: '0.65rem 0.75rem',
                        borderRadius: '0.5rem',
                        background: 'rgba(239, 68, 68, 0.08)',
                        border: '1px solid rgba(239, 68, 68, 0.2)',
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
                            background: '#ef4444',
                            color: '#fff',
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
                            border: '1px solid rgba(255,255,255,0.15)',
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
                        border: '1px solid rgba(239, 68, 68, 0.4)',
                        background: 'transparent',
                        color: '#ef4444',
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
