import React from 'react';
import type { BillOrder } from '../../hooks/useBill';
import { formatMoney, formatPlacedTime } from './money';

const STATUS_ICONS: Record<string, string> = {
  Pending: '⏳',
  Preparing: '🔥',
  Completed: '✓',
  Cancelled: '✗',
};

const STATUS_COLORS: Record<string, { bg: string; fg: string }> = {
  Pending: { bg: 'var(--status-pending-soft)', fg: 'var(--status-pending)' },
  Preparing: { bg: 'var(--status-preparing-soft)', fg: 'var(--status-preparing)' },
  Completed: { bg: 'var(--status-completed-soft)', fg: 'var(--status-completed)' },
  Cancelled: { bg: 'var(--status-cancelled-soft)', fg: 'var(--status-cancelled)' },
};

/** One order on the bill: number, status pill (icon + word), placed time, lines and subtotal. Cards ease in one after another. */
export default function BillOrderCard({ order, index = 0 }: { order: BillOrder; index?: number }) {
  const colors = STATUS_COLORS[order.status] ?? STATUS_COLORS.Completed;
  return (
    <section
      data-testid={`bill-order-${order.order_number}`}
      aria-label={`Order ${order.order_number}`}
      className="stagger hover-lift"
      style={{
        '--i': index,
        background: 'var(--bg-secondary, #171b22)',
        borderRadius: 'var(--radius-card, 12px)',
        padding: '1rem',
        marginBottom: '0.75rem',
        border: '1px solid var(--border, rgba(255,255,255,0.08))',
      } as React.CSSProperties}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.625rem' }}>
        <span style={{ fontWeight: 700, fontSize: '1rem' }}>Order #{order.order_number}</span>
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.25rem',
            fontSize: '0.75rem',
            fontWeight: 600,
            padding: '0.15rem 0.5rem',
            borderRadius: '1rem',
            background: colors.bg,
            color: colors.fg,
          }}
        >
          <span aria-hidden="true">{STATUS_ICONS[order.status] ?? ''}</span>
          <span>{order.status}</span>
        </span>
        <span style={{ marginLeft: 'auto', fontSize: '0.8rem', color: 'var(--text-muted, #7b8491)' }}>
          Placed {formatPlacedTime(order.placed_at)}
        </span>
      </div>

      <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
        {order.lines.map((line, idx) => (
          <li
            key={`${line.menu_item_id}-${idx}`}
            style={{
              display: 'grid',
              gridTemplateColumns: 'minmax(0, 1fr) auto auto',
              alignItems: 'baseline',
              columnGap: '1rem',
              padding: '0.2rem 0',
              fontSize: '0.9rem',
            }}
          >
            <span>
              {line.image ? <span aria-hidden="true">{line.image} </span> : null}
              {line.name} <span style={{ color: 'var(--text-secondary, #a6aeb8)' }}>× {line.quantity}</span>
            </span>
            <span style={{ color: 'var(--text-secondary, #a6aeb8)', fontVariantNumeric: 'tabular-nums' }}>
              {formatMoney(line.price_cents_each)} each
            </span>
            <span style={{ minWidth: '4.5rem', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
              {formatMoney(line.subtotal_cents)}
            </span>
          </li>
        ))}
      </ul>

      <div
        style={{
          display: 'flex',
          justifyContent: 'flex-end',
          gap: '1rem',
          marginTop: '0.5rem',
          paddingTop: '0.5rem',
          borderTop: '1px solid var(--border, rgba(255,255,255,0.08))',
          fontWeight: 600,
          fontSize: '0.9rem',
        }}
      >
        <span>Subtotal</span>
        <span style={{ minWidth: '4.5rem', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
          {formatMoney(order.subtotal_cents)}
        </span>
      </div>
    </section>
  );
}
