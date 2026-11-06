import { useState, useEffect, useRef, useCallback } from 'react';

export interface StaffSSEEvent {
  type: string;
  data: unknown;
  /** Position in this connection's event list; set by the hook. */
  seq?: number;
}

const MAX_EVENTS_KEPT = 200;

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
    };

    const eventTypes = [
      'ORDER_PLACED',
      'ORDER_STATUS_CHANGED',
      'TABLE_CLOSED',
      'TABLE_STATUS_CHANGED',
      'MENU_AVAILABILITY_CHANGED',
    ];

    for (const type of eventTypes) {
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
