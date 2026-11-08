import React, { useState } from 'react';
import NewHighlight from './NewHighlight';
import { staffFetch } from '../../staff/staffAuth';
import type { Order, OrderStatus, OrderLine } from '../../hooks/useBoardOrders';

const STATUS_ICONS: Record<OrderStatus, string> = {
  Pending: '⏳',
  Preparing: '🔥',
  Completed: '✓',
  Cancelled: '✗',
};

function formatTime(iso: string): string {
  const d = new Date(iso);
  const h = d.getHours();
  const m = d.getMinutes().toString().padStart(2, '0');
  const ampm = h >= 12 ? 'pm' : 'am';
  const hour = h % 12 || 12;
  return `${hour}:${m}${ampm}`;
}

interface OrderCardProps {
  order: Order;
  onStatusChange?: (orderNumber: number, newStatus: OrderStatus) => void;
}

export default function OrderCard({ order, onStatusChange }: OrderCardProps) {
  const [inFlight, setInFlight] = useState(false);
  const [transitionError, setTransitionError] = useState<string | null>(null);
  const [cancelConfirming, setCancelConfirming] = useState(false);

  async function handleTransition(newStatus: OrderStatus) {
    setInFlight(true);
    setTransitionError(null);
    try {
      const response = await staffFetch(`/api/orders/${order.order_number}/transition`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: newStatus, by: 'staff' }),
      });
      if (response.ok) {
        onStatusChange?.(order.order_number, newStatus);
      } else if (response.status === 422) {
        setTransitionError('This change is no longer possible. Reload to see the latest state.');
      } else {
        setTransitionError('Failed to update order status.');
      }
    } catch {
      setTransitionError('Network error. Please try again.');
    } finally {
      setInFlight(false);
    }
  }

  async function handleCancel() {
    setCancelConfirming(false);
    await handleTransition('Cancelled');
  }

  const isPending = order.status === 'Pending';
  const isPreparing = order.status === 'Preparing';
  const canCancel = isPending || isPreparing;

  return (
    <NewHighlight active={isPending}>
      <div
        data-testid={`order-card-${order.order_number}`}
        className="pop-in hover-lift"
        style={{
          background: 'var(--bg-card)',
          borderRadius: 'var(--radius-md)',
          padding: '0.875rem',
          marginBottom: '0.5rem',
          border: '1px solid var(--border)',
        }}
      >
        {/* Header: order number + status + time */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
          <span style={{ fontWeight: 700, fontSize: '1rem' }}>#{order.order_number}</span>
          <span
            key={order.status}
            className="status-flash"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.25rem',
              fontSize: '0.75rem',
              fontWeight: 600,
              padding: '0.15rem 0.5rem',
              borderRadius: '1rem',
              background: isPending
                ? 'var(--status-pending-soft)'
                : isPreparing
                ? 'var(--status-preparing-soft)'
                : order.status === 'Cancelled'
                ? 'var(--status-cancelled-soft)'
                : 'var(--status-completed-soft)',
              color: isPending
                ? 'var(--status-pending)'
                : isPreparing
                ? 'var(--status-preparing)'
                : order.status === 'Cancelled'
                ? 'var(--status-cancelled)'
                : 'var(--status-completed)',
            }}
          >
            <span>{STATUS_ICONS[order.status]}</span>
            <span>{order.status}</span>
          </span>
          <span style={{ marginLeft: 'auto', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            {formatTime(order.placed_at)}
          </span>
        </div>

        {/* Line items */}
        <ul style={{ margin: 0, padding: 0, listStyle: 'none', marginBottom: '0.625rem' }}>
          {order.lines.map((line: OrderLine, idx: number) => (
            <li
              key={`${line.menu_item_id}-${idx}`}
              style={{ display: 'flex', gap: '0.25rem', fontSize: '0.875rem', marginBottom: '0.15rem' }}
            >
              <span>×{line.quantity}</span>
              <span>{line.name}</span>
            </li>
          ))}
        </ul>

        {/* Action buttons */}
        {transitionError && (
          <p style={{ color: 'var(--danger)', fontSize: '0.75rem', marginBottom: '0.5rem' }}>{transitionError}</p>
        )}
        {cancelConfirming && (
          <div
            data-testid={`cancel-confirm-${order.order_number}`}
            className="pop-in"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              marginBottom: '0.5rem',
              padding: '0.375rem 0.5rem',
              background: 'var(--danger-soft)',
              borderRadius: '0.375rem',
              fontSize: '0.8rem',
            }}
          >
            <span>Cancel order #{order.order_number}?</span>
            <button
              data-testid={`btn-cancel-confirm-${order.order_number}`}
              onClick={handleCancel}
              style={{
                padding: '0.25rem 0.625rem',
                borderRadius: '0.25rem',
                border: 'none',
                background: 'var(--danger)',
                color: 'var(--bg)',
                fontWeight: 600,
                fontSize: '0.75rem',
                cursor: 'pointer',
              }}
            >
              Yes, cancel
            </button>
            <button
              data-testid={`btn-cancel-keep-${order.order_number}`}
              onClick={() => setCancelConfirming(false)}
              style={{
                padding: '0.25rem 0.625rem',
                borderRadius: '0.25rem',
                border: '1px solid var(--border-strong)',
                background: 'transparent',
                color: 'var(--text-secondary)',
                fontWeight: 600,
                fontSize: '0.75rem',
                cursor: 'pointer',
              }}
            >
              Keep it
            </button>
          </div>
        )}
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          {isPending && (
            <button
              data-testid={`btn-preparing-${order.order_number}`}
              className="btn-primary"
              disabled={inFlight}
              onClick={() => handleTransition('Preparing')}
              style={{
                padding: '0.375rem 0.75rem',
                borderRadius: '0.375rem',
                border: 'none',
                background: 'var(--accent)',
                color: 'var(--accent-fg)',
                fontWeight: 600,
                fontSize: '0.8rem',
                cursor: inFlight ? 'not-allowed' : 'pointer',
                opacity: inFlight ? 0.6 : 1,
              }}
            >
              {inFlight ? 'Updating…' : 'Start preparing'}
            </button>
          )}
          {isPreparing && (
            <button
              data-testid={`btn-complete-${order.order_number}`}
              className="btn-primary"
              disabled={inFlight}
              onClick={() => handleTransition('Completed')}
              style={{
                padding: '0.375rem 0.75rem',
                borderRadius: '0.375rem',
                border: 'none',
                background: 'var(--accent)',
                color: 'var(--accent-fg)',
                fontWeight: 600,
                fontSize: '0.8rem',
                cursor: inFlight ? 'not-allowed' : 'pointer',
                opacity: inFlight ? 0.6 : 1,
              }}
            >
              {inFlight ? 'Updating…' : 'Mark completed'}
            </button>
          )}
          {canCancel && (
            <button
              data-testid={`btn-cancel-${order.order_number}`}
              disabled={inFlight}
              onClick={() => setCancelConfirming(true)}
              style={{
                padding: '0.375rem 0.75rem',
                borderRadius: '0.375rem',
                border: '1px solid var(--danger)',
                background: 'transparent',
                color: 'var(--danger)',
                fontWeight: 600,
                fontSize: '0.8rem',
                cursor: inFlight ? 'not-allowed' : 'pointer',
                opacity: inFlight ? 0.6 : 1,
              }}
            >
              Cancel
            </button>
          )}
        </div>
      </div>
    </NewHighlight>
  );
}
