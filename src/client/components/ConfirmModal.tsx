import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

interface ConfirmModalProps {
  open: boolean;
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  /** Extra content between the message and the buttons, for example a choice to make before confirming. */
  children?: React.ReactNode;
}

/**
 * Shared confirmation modal rendered as a portal.
 * Used by CartScreen (place order), MyOrdersScreen (cancel order), CartScreen (clear cart).
 */
export default function ConfirmModal({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  onConfirm,
  onCancel,
  children,
}: ConfirmModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const onCancelRef = useRef(onCancel);
  onCancelRef.current = onCancel;

  // Keyboard rules (NFR6): focus moves into the dialog and stays inside it, Escape closes it,
  // and focus goes back to whatever opened it when it closes.
  useEffect(() => {
    if (!open) return;
    const opener = document.activeElement as HTMLElement | null;
    const focusable = () =>
      Array.from(dialogRef.current?.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled])') ?? []);
    (dialogRef.current?.querySelector<HTMLElement>('[data-testid="confirm-modal-cancel"]') ?? focusable()[0])?.focus();

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault();
        onCancelRef.current();
        return;
      }
      if (e.key !== 'Tab') return;
      const items = focusable();
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement as HTMLElement | null;
      if (!active || !dialogRef.current?.contains(active)) {
        e.preventDefault();
        first.focus();
      } else if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    }

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      // A disabled opener cannot take focus (the caller disabled it while acting on the answer).
      const openerDisabled = (opener as HTMLButtonElement | null)?.disabled === true;
      if (opener && !openerDisabled && document.contains(opener)) opener.focus();
    };
  }, [open]);

  if (!open) return null;

  return createPortal(
    <div
      ref={dialogRef}
      role="alertdialog"
      aria-modal="true"
      aria-label={title}
      data-testid="confirm-modal"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--scrim)',
        backdropFilter: 'blur(4px)',
        WebkitBackdropFilter: 'blur(4px)',
        animation: 'fadeIn 150ms ease-out',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div
        className="pop-in"
        style={{
          background: 'var(--bg-raised)',
          color: 'var(--text)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)',
          padding: '1.5rem',
          maxWidth: '20rem',
          width: '90%',
          boxShadow: 'var(--shadow-sheet)',
        }}
      >
        <h2
          style={{
            fontSize: '1.1rem',
            fontWeight: 700,
            marginBottom: message ? '0.5rem' : '1.25rem',
          }}
        >
          {title}
        </h2>
        {message && (
          <p
            style={{
              color: 'var(--text-secondary)',
              fontSize: '0.9rem',
              marginBottom: '1.25rem',
            }}
          >
            {message}
          </p>
        )}
        {children}
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button
            data-testid="confirm-modal-cancel"
            onClick={onCancel}
            style={{
              flex: 1,
              padding: '0.65rem',
              borderRadius: '0.5rem',
              border: '1px solid var(--border-strong)',
              background: 'transparent',
              color: 'inherit',
              cursor: 'pointer',
              fontSize: '0.9rem',
            }}
          >
            {cancelLabel}
          </button>
          <button
            data-testid="confirm-modal-confirm"
            className="btn-primary"
            onClick={onConfirm}
            style={{
              flex: 1,
              padding: '0.65rem',
              borderRadius: '0.5rem',
              border: 'none',
              background: 'var(--accent)',
              color: 'var(--accent-fg)',
              cursor: 'pointer',
              fontSize: '0.9rem',
              fontWeight: 600,
            }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
