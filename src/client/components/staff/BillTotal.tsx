import React from 'react';
import { formatMoney } from './money';

export default function BillTotal({ totalCents }: { totalCents: number }) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'baseline',
        padding: '0.875rem 1rem',
        marginTop: '0.25rem',
        borderTop: '2px solid var(--border, rgba(255,255,255,0.15))',
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
