// Your receipt on the table-closed screen: shown at once when the diner asked for one at the bill, otherwise
// behind a "View receipt" button. The same receipt card staff print.
import React, { useEffect, useState } from 'react';
import ReceiptCard, { type Receipt } from '../../../components/ReceiptCard.js';
import type { DinerFeatureProps } from '../types.js';
import { fetchLastReceipt } from '../api.js';

export default function ReceiptFeature({ tableId }: DinerFeatureProps) {
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchLastReceipt(tableId)
      .then((r) => {
        if (cancelled) return;
        setReceipt(r);
        setOpen(r.receipt_requested === true);
      })
      .catch(() => {
        // No receipt to show: the closed screen carries on without it.
      });
    return () => {
      cancelled = true;
    };
  }, [tableId]);

  if (!receipt) return null;
  return (
    <section className="stack" style={{ gap: 12, width: '100%', maxWidth: 'var(--diner-max)' }} aria-label="Your receipt" data-testid="diner-receipt">
      {open ? (
        <>
          <ReceiptCard receipt={receipt} />
          <button type="button" className="btn btn-primary u6-touch no-print" data-testid="diner-receipt-print" onClick={() => window.print()}>
            Print or save receipt
          </button>
        </>
      ) : (
        <button type="button" className="btn u6-touch" data-testid="diner-receipt-view" onClick={() => setOpen(true)}>
          View receipt
        </button>
      )}
    </section>
  );
}
