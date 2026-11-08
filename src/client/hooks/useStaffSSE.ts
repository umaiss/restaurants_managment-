import { useState, useEffect, useRef, useCallback } from 'react';
import { STAFF_EVENT_NAMES } from './eventNames.js';
import { notifyStaffUnauthorized } from '../staff/staffAuth.js';

export interface StaffSSEEvent {
  type: string;
  data: unknown;
  /** Position in this subscriber's event list; set by the hook. */
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

interface Subscriber {
  onEvent: (type: string, data: unknown) => void;
  onConnected: (connected: boolean) => void;
}

/**
 * The one EventSource to /sse/staff for the whole page. Every component that calls useStaffSSE shares it
 * (integration fix: a page used to open one stream per caller, and a browser allows only about six connections
 * to a host over HTTP/1.1). It opens with the first subscriber and closes with the last.
 */
let shared: { es: EventSource; subscribers: Set<Subscriber>; connected: boolean } | null = null;

function subscribe(sub: Subscriber): () => void {
  if (shared === null) {
    const es = new EventSource('/sse/staff');
    const state = { es, subscribers: new Set<Subscriber>(), connected: false };
    shared = state;

    es.onopen = () => {
      state.connected = true;
      for (const s of state.subscribers) s.onConnected(true);
    };

    es.onerror = () => {
      state.connected = false;
      for (const s of state.subscribers) s.onConnected(false);
      // BR1.7: a stream the server refused is closed by the browser and does not retry by itself (a dropped
      // connection stays CONNECTING and retries on its own). When it is closed, ask the session check:
      // IF that answers 401 THEN the session is gone and the screen returns to the PIN screen.
      if (es.readyState === 2 /* EventSource.CLOSED */) void checkSession();
    };

    // Every event name of contract 4, registered once (BR9.2)
    for (const type of STAFF_EVENT_NAMES) {
      es.addEventListener(type, (e: MessageEvent) => {
        // One malformed event must not break the listener for the ones after it.
        let data: unknown;
        try {
          data = JSON.parse(e.data) as unknown;
        } catch {
          console.error(`Ignoring a ${type} event that is not valid JSON`);
          return;
        }
        for (const s of state.subscribers) s.onEvent(type, data);
      });
    }
  }

  const state = shared;
  state.subscribers.add(sub);
  if (state.connected) sub.onConnected(true);

  return () => {
    state.subscribers.delete(sub);
    if (state.subscribers.size === 0) {
      state.es.close();
      if (shared === state) shared = null;
    }
  };
}

/**
 * The staff live stream, shared by every caller on the page (one EventSource for /sse/staff).
 * Returns { lastEvent, events, connected }. `lastEvent` is only the newest event: events that
 * arrive together replace each other there. Consumers that build state from events (the kitchen
 * board) read `events`, which keeps every event received since the caller mounted, in order, each with a `seq`.
 */
export function useStaffSSE(): {
  lastEvent: StaffSSEEvent | null;
  events: StaffSSEEvent[];
  connected: boolean;
} {
  const [lastEvent, setLastEvent] = useState<StaffSSEEvent | null>(null);
  const [events, setEvents] = useState<StaffSSEEvent[]>([]);
  const [connected, setConnected] = useState(false);
  const seqRef = useRef(0);

  const pushEvent = useCallback((ev: StaffSSEEvent) => {
    const numbered = { ...ev, seq: ++seqRef.current };
    setLastEvent(numbered);
    setEvents((prev) => [...prev, numbered].slice(-MAX_EVENTS_KEPT));
  }, []);

  useEffect(() => {
    return subscribe({
      onEvent: (type, data) => pushEvent({ type, data }),
      onConnected: setConnected,
    });
  }, [pushEvent]);

  return { lastEvent, events, connected };
}
