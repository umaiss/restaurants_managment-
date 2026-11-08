import React from 'react';
import { formatMoney } from './money';

/** The combined total, as a card (mockup staff-bill). */
export default function BillTotal({ totalCents }: { totalCents: number }) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'baseline',
        padding: '0.875rem 1rem',
        marginTop: '0.25rem',
        background: 'var(--bg-raised)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-md)',
        boxShadow: 'var(--shadow-card)',
        fontSize: '1.15rem',
        fontWeight: 700,
      }}
    >
      <span>Combined total</span>
      <span data-testid="bill-combined-total" style={{ fontVariantNumeric: 'tabular-nums' }}>
        {formatMoney(totalCents)}
      </span>
    </div>
  );
}
