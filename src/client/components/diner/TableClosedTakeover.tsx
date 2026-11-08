import React from 'react';

interface TableClosedTakeoverProps {
  visible: boolean;
}

/**
 * Full-screen overlay shown when the TABLE_CLOSED SSE event is received.
 * Appears with a 300ms fade-in transition. Clears reduced-motion gracefully.
 */
export default function TableClosedTakeover({ visible }: TableClosedTakeoverProps) {
  if (!visible) return null;

  return (
    <div
      data-testid="table-closed-takeover"
      role="alertdialog"
      aria-label="Table closed"
      aria-live="assertive"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--overlay-strong)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        animation: 'tableClosedFadeIn 300ms ease-out forwards',
        gap: '1rem',
        textAlign: 'center',
        padding: '2rem',
      }}
    >
      <span className="check-ring" aria-hidden="true">
        <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="var(--status-completed)" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 12.5l4.5 4.5L19 7.5" />
        </svg>
      </span>
      <h1
        style={{
          fontSize: '1.5rem',
          fontWeight: 700,
          color: 'var(--text)',
          margin: 0,
        }}
      >
        This table was closed
      </h1>
      <p
        style={{
          fontSize: '1.1rem',
          color: 'var(--text-2)',
          margin: 0,
        }}
      >
        Thanks for visiting!
      </p>
      <style>{`
        @keyframes tableClosedFadeIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @media (prefers-reduced-motion: reduce) {
          [data-testid="table-closed-takeover"] {
            animation: none !important;
          }
        }
      `}</style>
    </div>
  );
}
