import React from 'react';

interface CloseTableSectionProps {
  closeAvailable: boolean;
  blockingOrders: number[];
  /** True when the table has no orders at all. */
  empty: boolean;
  busy?: boolean;
  onClose: () => void;
}

/** The Close table button and the note that says why it is unavailable. */
export default function CloseTableSection({ closeAvailable, blockingOrders, empty, busy = false, onClose }: CloseTableSectionProps) {
  let note: string | null = null;
  if (blockingOrders.length > 0) {
    note = `One or more orders still open: ${blockingOrders.map((n) => `#${n}`).join(', ')}`;
  } else if (!closeAvailable && empty) {
    note = 'This table has no orders to close.';
  }

  const disabled = !closeAvailable || busy;

  return (
    <div style={{ padding: '0.5rem 1rem 1rem', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '0.6rem' }}>
      <button
        type="button"
        data-testid="btn-close-table"
        className="bill-focusable btn-primary"
        disabled={disabled}
        onClick={onClose}
        style={{
          padding: '0.7rem 1.5rem',
          borderRadius: '0.5rem',
          border: 'none',
          fontSize: '1rem',
          fontWeight: 700,
          cursor: disabled ? 'not-allowed' : 'pointer',
          background: disabled ? 'var(--bg-card)' : 'var(--accent)',
          color: disabled ? 'var(--text-muted)' : 'var(--accent-fg)',
          minHeight: '44px',
        }}
      >
        Close table
      </button>
      {note && (
        <p data-testid="open-orders-note" style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
          {note}
        </p>
      )}
    </div>
  );
}
