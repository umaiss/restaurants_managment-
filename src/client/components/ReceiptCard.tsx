import React from 'react';
import type { BillOrder } from '../hooks/useBill';
import { formatMoney } from './staff/money';
import { optionsText } from '../staff/board/optionsText';

/** A closed visit's receipt, as the server sends it (staff and diner read the same body). */
export interface Receipt {
  visit_id: string;
  table_id: number;
  table_label: string;
  opened_at: string;
  closed_at: string;
  orders: BillOrder[];
  total_cents: number;
  payment_method: 'cash' | 'card' | null;
  /** True when the table asked for a receipt along with the bill. */
  receipt_requested?: boolean;
}

const PAYMENT_WORDS = { cash: 'Cash', card: 'Card' } as const;

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
}

/** The receipt itself: table, time, lines with their options, total and how the table paid. Printed on its own. */
export default function ReceiptCard({ receipt }: { receipt: Receipt }) {
  return (
    <article className="card stack receipt-print" aria-label="Receipt" data-testid="receipt-card" style={{ gap: '0.75rem', textAlign: 'left' }}>
      <header style={{ textAlign: 'center' }}>
        <h2 style={{ margin: 0, fontSize: '1.25rem' }}>Receipt</h2>
        <p style={{ margin: 0 }} data-testid="receipt-table">
          {receipt.table_label}
        </p>
        <p className="secondary" style={{ margin: 0, fontSize: '0.85rem' }}>
          {formatDateTime(receipt.closed_at)}
        </p>
      </header>

      <div className="stack" style={{ gap: '0.25rem' }} data-testid="receipt-lines">
        {receipt.orders.flatMap((order) =>
          order.lines.map((line, i) => (
            <div key={`${order.order_number}-${i}`} style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem' }}>
              <span>
                {line.quantity} × {line.name}
                {optionsText(line.options) && (
                  <span className="secondary" style={{ display: 'block', fontSize: '0.8rem' }}>
                    {optionsText(line.options)}
                  </span>
                )}
              </span>
              <span>{formatMoney(line.subtotal_cents)}</span>
            </div>
          ))
        )}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, borderTop: '1px solid var(--border-strong)', paddingTop: '0.5rem' }}>
        <span>Total</span>
        <span data-testid="receipt-total">{formatMoney(receipt.total_cents)}</span>
      </div>
      <p style={{ margin: 0 }} data-testid="receipt-payment">
        Paid by: {receipt.payment_method ? PAYMENT_WORDS[receipt.payment_method] : 'not recorded'}
      </p>
    </article>
  );
}
