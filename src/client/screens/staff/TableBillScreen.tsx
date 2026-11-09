import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useBill } from '../../hooks/useBill';
import BillOrderCard from '../../components/staff/BillOrderCard';
import BillTotal from '../../components/staff/BillTotal';
import CloseTableSection from '../../components/staff/CloseTableSection';
import ConfirmModal from '../../components/ConfirmModal';
import { formatMoney } from '../../components/staff/money';
import { staffFetch } from '../../staff/staffAuth';

const SCREEN_STYLES = `
  .bill-focusable:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
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
            borderRadius: 'var(--radius-md)',
            background: 'var(--bg-card)',
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
  // "Show a receipt": chosen in the Close table step, starts on when the diner asked for one.
  const [showReceipt, setShowReceipt] = useState(false);
  // True while a close that goes on to the receipt page runs, so the "table closed" event does not send staff to the board first.
  const goingToReceipt = useRef(false);

  // The Close table button is disabled while the request runs, so after a failed close keyboard
  // focus goes to the error message, where the person lands on what went wrong.
  const closeErrorRef = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    if (closeError) closeErrorRef.current?.focus();
  }, [closeError]);

  // Closed from another session (or by this one): the bill has nothing left to show.
  useEffect(() => {
    if (closed && !goingToReceipt.current) navigate('/staff');
  }, [closed, navigate]);

  async function handleClose() {
    setConfirming(false);
    setClosing(true);
    setCloseError(null);
    goingToReceipt.current = showReceipt;
    try {
      const res = await staffFetch(`/api/tables/${tableId}/close`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      });
      if (res.ok) {
        let visitId = '';
        if (showReceipt) {
          try {
            visitId = ((await res.json()) as { archived_visit_id?: string }).archived_visit_id ?? '';
          } catch {
            // no visit id to show: fall back to the board
          }
        }
        navigate(visitId ? `/staff/receipt/${visitId}` : '/staff');
        return;
      }
      goingToReceipt.current = false;
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
      goingToReceipt.current = false;
      setCloseError('We could not close the table. Please check the connection and try again.');
    } finally {
      setClosing(false);
    }
  }

  const empty = !!bill && bill.orders.length === 0 && !bill.close_available;

  return (
    <div data-testid="table-bill-screen" style={{ maxWidth: '56rem' }}>
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
            border: '1px solid var(--border-strong)',
            color: 'var(--text)',
            minHeight: 'var(--touch)',
            display: 'inline-flex',
            alignItems: 'center',
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
            background: 'var(--danger-soft)',
            border: '1px solid var(--danger)',
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
              background: 'var(--accent)',
              color: 'var(--accent-fg)',
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
            <p data-testid="bill-stale-note" role="status" style={{ fontSize: '0.8rem', color: 'var(--pending)', marginBottom: '0.75rem' }}>
              We cannot refresh the bill right now. Showing the last version.{' '}
              <button type="button" className="bill-focusable" onClick={reload} style={{ background: 'none', border: 'none', color: 'inherit', textDecoration: 'underline', cursor: 'pointer', font: 'inherit' }}>
                Retry
              </button>
            </p>
          )}
          {bill.orders.map((order, index) => (
            <BillOrderCard key={order.order_number} order={order} index={index} />
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
                background: 'var(--danger-soft)',
                color: 'var(--danger)',
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
            onClose={() => {
              setShowReceipt(bill.receipt_requested === true);
              setConfirming(true);
            }}
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
      >
        {bill && (
          <div className="stack" style={{ marginBottom: '1rem', gap: '0.5rem' }}>
            <p data-testid="close-payment" style={{ margin: 0, fontSize: '0.9rem' }}>
              Payment: {bill.payment_method === 'cash' ? 'Cash' : bill.payment_method === 'card' ? 'Card' : 'not chosen yet'}
            </p>
            {bill.receipt_requested && (
              <p data-testid="close-receipt-asked" style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                The diner asked for a receipt.
              </p>
            )}
            <label style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', minHeight: 'var(--touch)', fontSize: '0.9rem' }}>
              <input
                type="checkbox"
                data-testid="close-receipt"
                checked={showReceipt}
                onChange={(e) => setShowReceipt(e.target.checked)}
                style={{ width: 22, height: 22 }}
              />
              <span>Show a receipt to print</span>
            </label>
          </div>
        )}
      </ConfirmModal>
    </div>
  );
}
