import React, { useState } from 'react';
import NewHighlight from './NewHighlight';
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
      const response = await fetch(`/api/orders/${order.order_number}/transition`, {
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
        style={{
          background: 'var(--bg-secondary, #1e1e2e)',
          borderRadius: '0.5rem',
          padding: '0.875rem',
          marginBottom: '0.5rem',
          border: '1px solid rgba(255,255,255,0.08)',
        }}
      >
        {/* Header: order number + status + time */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
          <span style={{ fontWeight: 700, fontSize: '1rem' }}>#{order.order_number}</span>
          <span
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
                : 'var(--status-completed-soft)',
              color: isPending
                ? 'var(--status-pending)'
                : isPreparing
                ? 'var(--status-preparing)'
                : 'var(--status-completed)',
            }}
          >
            <span>{STATUS_ICONS[order.status]}</span>
            <span>{order.status}</span>
          </span>
          <span style={{ marginLeft: 'auto', fontSize: '0.75rem', color: 'var(--text-muted, #64748b)' }}>
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
          <p style={{ color: 'var(--danger, #ff6b6b)', fontSize: '0.75rem', marginBottom: '0.5rem' }}>{transitionError}</p>
        )}
        {cancelConfirming && (
          <div
            data-testid={`cancel-confirm-${order.order_number}`}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              marginBottom: '0.5rem',
              padding: '0.375rem 0.5rem',
              background: 'rgba(239,68,68,0.1)',
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
                background: '#ef4444',
                color: '#fff',
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
                border: '1px solid rgba(255,255,255,0.2)',
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
              disabled={inFlight}
              onClick={() => handleTransition('Preparing')}
              style={{
                padding: '0.375rem 0.75rem',
                borderRadius: '0.375rem',
                border: 'none',
                background: 'var(--accent, #ffb04a)',
                color: 'var(--accent-fg, #0f1216)',
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
              disabled={inFlight}
              onClick={() => handleTransition('Completed')}
              style={{
                padding: '0.375rem 0.75rem',
                borderRadius: '0.375rem',
                border: 'none',
                background: 'var(--accent, #ffb04a)',
                color: 'var(--accent-fg, #0f1216)',
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
                border: '1px solid rgba(255,107,107,0.4)',
                background: 'transparent',
                color: 'var(--danger, #ff6b6b)',
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
