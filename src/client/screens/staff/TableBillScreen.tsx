import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useBill } from '../../hooks/useBill';
import BillOrderCard from '../../components/staff/BillOrderCard';
import BillTotal from '../../components/staff/BillTotal';
import CloseTableSection from '../../components/staff/CloseTableSection';
import ConfirmModal from '../../components/ConfirmModal';
import { formatMoney } from '../../components/staff/money';

const SCREEN_STYLES = `
  .bill-focusable:focus-visible { outline: 2px solid var(--accent, #ffb04a); outline-offset: 2px; }
  @keyframes billShimmer { 0%, 100% { opacity: 0.5; } 50% { opacity: 1; } }
  @media (prefers-reduced-motion: reduce) { [data-testid="bill-loading"] > div { animation: none !important; } }
`;

function BillShimmer() {
  return (
    <div data-testid="bill-loading" aria-busy="true" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          style={{
            height: '96px',
            borderRadius: 'var(--radius-card, 12px)',
            background: 'rgba(255,255,255,0.05)',
            animation: 'billShimmer 1.5s ease-in-out infinite',
          }}
        />
      ))}
    </div>
  );
}

export default function TableBillScreen() {
  const params = useParams<{ id: string }>();
  const tableId = Number(params.id);
  const navigate = useNavigate();
  const { bill, loading, error, closed, reload } = useBill(tableId);
  const [confirming, setConfirming] = useState(false);
  const [closing, setClosing] = useState(false);
  const [closeError, setCloseError] = useState<string | null>(null);

  // The Close table button is disabled while the request runs, so after a failed close keyboard
  // focus goes to the error message, where the person lands on what went wrong.
  const closeErrorRef = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    if (closeError) closeErrorRef.current?.focus();
  }, [closeError]);

  // Closed from another session (or by this one): the bill has nothing left to show.
  useEffect(() => {
    if (closed) navigate('/staff');
  }, [closed, navigate]);

  async function handleClose() {
    setConfirming(false);
    setClosing(true);
    setCloseError(null);
    try {
      const res = await fetch(`/api/tables/${tableId}/close`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      });
      if (res.ok) {
        navigate('/staff');
        return;
      }
      let code = '';
      try {
        const body = (await res.json()) as { error?: { code?: string } };
        code = body.error?.code ?? '';
      } catch {
        // an unreadable error body falls through to the generic message
      }
      if (code === 'TABLE_ALREADY_CLOSED') {
        navigate('/staff');
      } else if (code === 'CLOSE_BLOCKED') {
        setCloseError('Close table is not available until every order is completed or cancelled.');
        reload();
      } else if (code === 'TABLE_EMPTY') {
        setCloseError('This table has no orders to close.');
        reload();
      } else {
        setCloseError('We could not close the table. Please try again.');
      }
    } catch {
      setCloseError('We could not close the table. Please check the connection and try again.');
    } finally {
      setClosing(false);
    }
  }

  const empty = !!bill && bill.orders.length === 0 && !bill.close_available;

  return (
    <div data-testid="table-bill-screen" style={{ padding: '1rem', maxWidth: '56rem', margin: '0 auto' }}>
      <style>{SCREEN_STYLES}</style>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
        <h1 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0 }}>Table {params.id} — Bill</h1>
        <Link
          to="/staff"
          data-testid="bill-back-link"
          className="bill-focusable"
          style={{
            padding: '0.4rem 0.9rem',
            borderRadius: '0.375rem',
            border: '1px solid var(--border, rgba(255,255,255,0.15))',
            color: 'var(--text-primary, #f1f3f6)',
            textDecoration: 'none',
            fontSize: '0.85rem',
          }}
        >
          ← Board
        </Link>
      </div>

      {loading && !bill && <BillShimmer />}

      {!bill && error && !loading && (
        <div
          data-testid="bill-error"
          role="alert"
          style={{
            padding: '1rem',
            borderRadius: '0.5rem',
            background: 'rgba(255,107,107,0.12)',
            border: '1px solid rgba(255,107,107,0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '1rem',
          }}
        >
          <span>We cannot load the bill right now.</span>
          <button
            type="button"
            data-testid="bill-retry"
            className="bill-focusable"
            onClick={reload}
            style={{
              padding: '0.4rem 0.9rem',
              borderRadius: '0.375rem',
              border: 'none',
              background: 'var(--accent, #ffb04a)',
              color: 'var(--accent-fg, #0f1216)',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Retry
          </button>
        </div>
      )}

      {bill && (
        <>
          {error && (
            <p data-testid="bill-stale-note" role="status" style={{ fontSize: '0.8rem', color: 'var(--status-pending, #ffc75a)', marginBottom: '0.75rem' }}>
              We cannot refresh the bill right now. Showing the last version.{' '}
              <button type="button" className="bill-focusable" onClick={reload} style={{ background: 'none', border: 'none', color: 'inherit', textDecoration: 'underline', cursor: 'pointer', font: 'inherit' }}>
                Retry
              </button>
            </p>
          )}
          {bill.orders.map((order) => (
            <BillOrderCard key={order.order_number} order={order} />
          ))}
          <BillTotal totalCents={bill.combined_total_cents} />
          {closeError && (
            <p
              ref={closeErrorRef}
              tabIndex={-1}
              data-testid="close-error-banner"
              role="alert"
              style={{
                margin: '0.5rem 1rem',
                padding: '0.6rem 0.8rem',
                borderRadius: '0.375rem',
                background: 'rgba(255,107,107,0.12)',
                color: 'var(--danger, #ff6b6b)',
                fontSize: '0.875rem',
              }}
            >
              {closeError}
            </p>
          )}
          <CloseTableSection
            closeAvailable={bill.close_available}
            blockingOrders={bill.blocking_orders}
            empty={empty}
            busy={closing}
            onClose={() => setConfirming(true)}
          />
        </>
      )}

      <ConfirmModal
        open={confirming}
        title={`Close Table ${params.id}?`}
        message={bill ? `Combined total: ${formatMoney(bill.combined_total_cents)}` : undefined}
        confirmLabel="Close table"
        cancelLabel="Cancel"
        onConfirm={handleClose}
        onCancel={() => setConfirming(false)}
      />
    </div>
  );
}
