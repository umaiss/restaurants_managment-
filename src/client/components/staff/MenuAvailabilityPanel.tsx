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
      className="panel-slide"
      style={{
        position: 'fixed',
        top: 0,
        right: 0,
        bottom: 0,
        width: '320px',
        maxWidth: '100vw',
        background: 'var(--bg-raised)',
        color: 'var(--text)',
        borderLeft: '1px solid var(--border)',
        display: 'flex',
        flexDirection: 'column',
        zIndex: 200,
        boxShadow: 'var(--shadow-sheet)',
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
          borderBottom: '1px solid var(--border)',
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
            color: 'var(--text-secondary)',
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
          <p style={{ color: 'var(--text-secondary)', textAlign: 'center' }}>Loading…</p>
        )}
        {error && (
          <p
            role="alert"
            style={{ color: 'var(--danger)', fontSize: '0.8rem', marginBottom: '0.5rem' }}
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
          borderTop: '1px solid var(--border)',
        }}
      >
        <button
          onClick={onClose}
          style={{
            width: '100%',
            padding: '0.625rem',
            borderRadius: '0.5rem',
            border: 'none',
            background: 'var(--accent)',
            color: 'var(--accent-fg)',
            minHeight: 'var(--touch)',
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
        borderBottom: '1px solid var(--border)',
      }}
    >
      <span style={{ fontSize: '0.9rem', color: isSoldOut ? 'var(--text-secondary)' : undefined }}>
        <span aria-hidden="true" style={{ marginRight: '0.5rem' }}>{item.image}</span>
        {item.name}
      </span>
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
          color: isSoldOut ? 'var(--danger)' : 'var(--text-secondary)',
        }}
      >
        <span
          aria-hidden="true"
          style={{
            position: 'relative',
            width: '2.25rem',
            height: '1.25rem',
            borderRadius: '999px',
            background: isSoldOut ? 'var(--text-disabled)' : 'var(--accent)',
            transition: 'background 150ms ease',
          }}
        >
          <span
            style={{
              position: 'absolute',
              top: '0.125rem',
              left: isSoldOut ? '0.125rem' : '1.125rem',
              width: '1rem',
              height: '1rem',
              borderRadius: '50%',
              background: isSoldOut ? 'var(--bg)' : 'var(--accent-fg)',
              transition: 'left 150ms ease',
            }}
          />
        </span>
        {isSoldOut ? 'Sold out' : 'On'}
      </button>
    </div>
  );
}
