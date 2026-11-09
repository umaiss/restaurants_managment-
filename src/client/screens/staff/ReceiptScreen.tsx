import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import ReceiptCard, { type Receipt } from '../../components/ReceiptCard';
import { staffFetch } from '../../staff/staffAuth';

/** The receipt of a closed table: the lines, the total and how the table paid, with a Print button. */
export default function ReceiptScreen() {
  const { visitId } = useParams<{ visitId: string }>();
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    setFailed(false);
    staffFetch(`/api/visits/${visitId}/receipt`)
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const body = (await res.json()) as Receipt;
        if (alive) setReceipt(body);
      })
      .catch(() => {
        if (alive) setFailed(true);
      });
    return () => {
      alive = false;
    };
  }, [visitId]);

  return (
    <div data-testid="receipt-screen" style={{ maxWidth: '28rem' }}>
      <div className="no-print row between" style={{ marginBottom: '1rem' }}>
        <Link
          to="/staff"
          className="btn"
          data-testid="receipt-back"
          style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', lineHeight: 1 }}
        >
          ← Board
        </Link>
        <button
          type="button"
          className="btn btn-primary"
          data-testid="receipt-print"
          disabled={!receipt}
          onClick={() => window.print()}
        >
          Print receipt
        </button>
      </div>

      {failed && (
        <p role="alert" data-testid="receipt-error" className="error-text">
          We cannot load this receipt right now.
        </p>
      )}
      {!receipt && !failed && <p className="secondary">Loading the receipt…</p>}

      {receipt && <ReceiptCard receipt={receipt} />}
    </div>
  );
}
