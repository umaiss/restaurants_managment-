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
        background: 'rgba(0, 0, 0, 0.9)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        animation: 'tableClosedFadeIn 300ms ease-out forwards',
        gap: '1rem',
        textAlign: 'center',
        padding: '2rem',
      }}
    >
      <span style={{ fontSize: '3rem', display: 'block' }}>✓</span>
      <h1
        style={{
          fontSize: '1.5rem',
          fontWeight: 700,
          color: '#fff',
          margin: 0,
        }}
      >
        This table was closed
      </h1>
      <p
        style={{
          fontSize: '1.1rem',
          color: 'rgba(255,255,255,0.7)',
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
