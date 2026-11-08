import { useEffect, useRef } from 'react';
import type { SSEEvent } from '../../hooks/useTableSSE.js';

/**
 * Runs `handler` once for each event that arrives after the component mounted (events already in the list at
 * mount are history and are skipped), never twice for the same `seq`. Used by every feature that reloads on
 * a live event (D9: nothing from before the page opened is treated as news).
 */
export function useNewEvents(events: SSEEvent[] | undefined, handler: (ev: SSEEvent) => void): void {
  const list = events ?? [];
  const processed = useRef<number>(list.length > 0 ? (list[list.length - 1].seq ?? 0) : 0);
  const handlerRef = useRef(handler);
  handlerRef.current = handler;
  useEffect(() => {
    for (const ev of list) {
      const seq = ev.seq ?? 0;
      if (seq <= processed.current) continue;
      processed.current = seq;
      handlerRef.current(ev);
    }
  }, [list]);
}

/**
 * Like useNewEvents, but starts from the very first event (the ready banner and the closed screen are
 * mounted for the whole page, so every event the stream delivers is new to them).
 */
export function useAllEvents(events: SSEEvent[] | undefined, handler: (ev: SSEEvent) => void): void {
  const list = events ?? [];
  const processed = useRef(0);
  const handlerRef = useRef(handler);
  handlerRef.current = handler;
  useEffect(() => {
    for (const ev of list) {
      const seq = ev.seq ?? 0;
      if (seq <= processed.current) continue;
      processed.current = seq;
      handlerRef.current(ev);
    }
  }, [list]);
}

/**
 * The Settings sheet and the screens use separate copies of U5's preference hooks, so a change made in the
 * sheet is announced with this event and the screens read the saved value again (W6 step 3).
 */
export const PREFS_EVENT = 'table-order:prefs-changed';

export function announcePrefsChange(): void {
  try {
    window.dispatchEvent(new Event(PREFS_EVENT));
  } catch {
    // nothing listens in a window-less test
  }
}
