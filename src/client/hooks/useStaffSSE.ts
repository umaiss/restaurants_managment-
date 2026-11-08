import { useState, useEffect, useRef, useCallback } from 'react';
import { STAFF_EVENT_NAMES } from './eventNames.js';
import { notifyStaffUnauthorized } from '../staff/staffAuth.js';

export interface StaffSSEEvent {
  type: string;
  data: unknown;
  /** Position in this connection's event list; set by the hook. */
  seq?: number;
}

const MAX_EVENTS_KEPT = 200;

/** Asks whether the staff session is still valid; a 401 sends the screen back to the PIN screen. */
async function checkSession(): Promise<void> {
  if (typeof fetch !== 'function') return;
  try {
    const res = await fetch('/api/staff/session');
    if (res.status === 401) notifyStaffUnauthorized();
  } catch {
    // The server could not be reached: the browser retries the stream by itself, nothing to do here.
  }
}

/**
 * Single shared EventSource for /sse/staff.
 * Returns { lastEvent, events, connected }. `lastEvent` is only the newest event: events that
 * arrive together replace each other there. Consumers that build state from events (the kitchen
 * board) read `events`, which keeps every event, in order, each with a `seq`.
 */
export function useStaffSSE(): {
  lastEvent: StaffSSEEvent | null;
  events: StaffSSEEvent[];
  connected: boolean;
} {
  const [lastEvent, setLastEvent] = useState<StaffSSEEvent | null>(null);
  const [events, setEvents] = useState<StaffSSEEvent[]>([]);
  const [connected, setConnected] = useState(false);
  const esRef = useRef<EventSource | null>(null);
  const seqRef = useRef(0);

  const pushEvent = useCallback((ev: StaffSSEEvent) => {
    const numbered = { ...ev, seq: ++seqRef.current };
    setLastEvent(numbered);
    setEvents((prev) => [...prev, numbered].slice(-MAX_EVENTS_KEPT));
  }, []);

  useEffect(() => {
    const es = new EventSource('/sse/staff');
    esRef.current = es;

    es.onopen = () => {
      setConnected(true);
    };

    es.onerror = () => {
      setConnected(false);
      // BR1.7: a stream the server refused is closed by the browser and does not retry by itself (a dropped
      // connection stays CONNECTING and retries on its own). When it is closed, ask the session check:
      // IF that answers 401 THEN the session is gone and the screen returns to the PIN screen.
      if (es.readyState === 2 /* EventSource.CLOSED */) void checkSession();
    };

    // Every event name of contract 4, registered once (BR9.2)
    for (const type of STAFF_EVENT_NAMES) {
      es.addEventListener(type, (e: MessageEvent) => {
        // One malformed event must not break the listener for the ones after it.
        try {
          pushEvent({ type, data: JSON.parse(e.data) as unknown });
        } catch {
          console.error(`Ignoring a ${type} event that is not valid JSON`);
        }
      });
    }

    return () => {
      es.close();
      esRef.current = null;
    };
  }, [pushEvent]);

  return { lastEvent, events, connected };
}
