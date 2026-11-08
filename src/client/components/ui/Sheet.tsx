import React, { useEffect, useRef } from 'react';

export interface SheetProps {
  open: boolean;
  title: string;
  onClose: () => void;
  testId?: string;
  children?: React.ReactNode;
}

/**
 * A bottom sheet (.sheet on a .scrim). Keyboard rules (NFR6): focus moves into the sheet, Escape closes it,
 * Tab stays inside it, and focus goes back to what opened it. A tap on the scrim closes it too.
 */
export function Sheet({ open, title, onClose, testId = 'ui-sheet', children }: SheetProps) {
  const ref = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    const opener = document.activeElement as HTMLElement | null;
    const focusable = () =>
      Array.from(ref.current?.querySelectorAll<HTMLElement>('button:not([disabled]), input, select, textarea, a[href]') ?? []);
    (focusable()[0] ?? ref.current)?.focus();

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault();
        onCloseRef.current();
        return;
      }
      if (e.key !== 'Tab') return;
      const items = focusable();
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement as HTMLElement | null;
      if (!active || !ref.current?.contains(active)) {
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
      if (opener && document.contains(opener)) opener.focus();
    };
  }, [open]);

  if (!open) return null;
  return (
    <div
      className="scrim"
      data-testid={`${testId}-scrim`}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div ref={ref} className="sheet slide-up" role="dialog" aria-modal="true" aria-label={title} data-testid={testId} tabIndex={-1}>
        <div className="sheet-handle" aria-hidden="true" />
        <h2>{title}</h2>
        {children}
      </div>
    </div>
  );
}
