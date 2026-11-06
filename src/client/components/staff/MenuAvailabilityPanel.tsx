import React, { useEffect, useRef, useCallback } from 'react';
import { useMenuAvailability } from '../../hooks/useMenuAvailability';
import type { MenuItem } from '../../hooks/useMenuAvailability';

interface MenuAvailabilityPanelProps {
  onClose: () => void;
}

const FOCUSABLE_SELECTORS =
  'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

export default function MenuAvailabilityPanel({ onClose }: MenuAvailabilityPanelProps) {
  const { items, loading, error, toggleAvailability } = useMenuAvailability();
  const panelRef = useRef<HTMLDivElement>(null);

  const getFocusable = useCallback((): HTMLElement[] => {
    if (!panelRef.current) return [];
    return Array.from(
      panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTORS)
    ).filter((el) => !el.hasAttribute('disabled'));
  }, []);

  // Focus trap, Tab/Shift+Tab wrap, and Escape key handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }

      if (e.key === 'Tab') {
        const focusable = getFocusable();
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === first) {
            e.preventDefault();
            last.focus();
          }
        } else {
          if (document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    // Focus the panel on open
    panelRef.current?.focus();
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose, getFocusable]);

  return (
    <div
      ref={panelRef}
      role="dialog"
      aria-label="Menu availability"
      aria-modal="true"
      tabIndex={-1}
      style={{
        position: 'fixed',
        top: 0,
        right: 0,
        bottom: 0,
        width: '320px',
        maxWidth: '100vw',
        background: 'var(--bg-secondary, #1e1e2e)',
        borderLeft: '1px solid rgba(255,255,255,0.08)',
        display: 'flex',
        flexDirection: 'column',
        zIndex: 200,
        boxShadow: '-4px 0 24px rgba(0,0,0,0.3)',
        outline: 'none',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '1rem',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
        }}
      >
        <h2 style={{ fontSize: '1rem', fontWeight: 700, margin: 0 }}>Menu availability</h2>
        <button
          onClick={onClose}
          aria-label="Close menu availability panel"
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: 'var(--text-secondary, #94a3b8)',
            fontSize: '1.25rem',
            padding: '0.25rem',
          }}
        >
          ✕
        </button>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '0.75rem 1rem' }}>
        {loading && (
          <p style={{ color: 'var(--text-secondary, #94a3b8)', textAlign: 'center' }}>Loading…</p>
        )}
        {error && (
          <p
            role="alert"
            style={{ color: '#ef4444', fontSize: '0.8rem', marginBottom: '0.5rem' }}
          >
            {error}
          </p>
        )}
        {!loading && items.map((item: MenuItem) => (
          <AvailabilityRow
            key={item.id}
            item={item}
            onToggle={toggleAvailability}
          />
        ))}
      </div>

      {/* Footer */}
      <div
        style={{
          padding: '0.75rem 1rem',
          borderTop: '1px solid rgba(255,255,255,0.08)',
        }}
      >
        <button
          onClick={onClose}
          style={{
            width: '100%',
            padding: '0.625rem',
            borderRadius: '0.5rem',
            border: 'none',
            background: 'var(--accent, #f59e0b)',
            color: '#000',
            fontWeight: 700,
            fontSize: '0.9rem',
            cursor: 'pointer',
          }}
        >
          Done
        </button>
      </div>
    </div>
  );
}

interface AvailabilityRowProps {
  item: MenuItem;
  onToggle: (id: string, available: boolean) => Promise<void>;
}

function AvailabilityRow({ item, onToggle }: AvailabilityRowProps) {
  const isSoldOut = !item.available;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0.625rem 0',
        borderBottom: '1px solid rgba(255,255,255,0.05)',
      }}
    >
      <span style={{ fontSize: '0.9rem' }}>{item.name}</span>
      <button
        role="switch"
        aria-checked={item.available}
        data-testid={`availability-toggle-${item.id}`}
        onClick={() => onToggle(item.id, !item.available)}
        aria-label={`Mark ${item.name} as ${isSoldOut ? 'available' : 'sold out'}`}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.4rem',
          cursor: 'pointer',
          fontSize: '0.8rem',
          background: 'none',
          border: 'none',
          padding: '0.25rem 0.5rem',
          borderRadius: '0.25rem',
          color: isSoldOut ? '#ef4444' : 'var(--text-secondary, #94a3b8)',
        }}
      >
        {isSoldOut ? 'Sold out' : 'Available'}
      </button>
    </div>
  );
}
