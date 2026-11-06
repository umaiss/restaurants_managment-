import { useState, useEffect, useRef, useCallback } from 'react';

export interface SSEEvent {
  type: string;
  data: unknown;
  /** Position in this connection's event list; set by the hook. */
  seq?: number;
}

export interface UseTableSSEResult {
  /** The newest event. Events that arrive together replace each other here; use `events` to see all of them. */
  lastEvent: SSEEvent | null;
  /** Every event received (the newest 200), in order, each with a `seq`. */
  events: SSEEvent[];
  connected: boolean;
}

const MAX_EVENTS_KEPT = 200;

const BACKOFF_STEPS = [1000, 2000, 5000, 10000, 15000, 15000];

/**
 * Subscribe to the SSE stream for a table.
 * Reconnects with exponential backoff (1s → 2s → 5s → 10s → 15s, then every 15s).
 * Sends Last-Event-ID on reconnect for event replay.
 */
export function useTableSSE(tableId: string | undefined): UseTableSSEResult {
  const [lastEvent, setLastEvent] = useState<SSEEvent | null>(null);
  const [events, setEvents] = useState<SSEEvent[]>([]);
  const [connected, setConnected] = useState(false);
  const seqRef = useRef(0);

  // Keep every event, not only the newest: two events that arrive together must both reach the consumer.
  const pushEvent = useCallback((ev: SSEEvent) => {
    const numbered = { ...ev, seq: ++seqRef.current };
    setLastEvent(numbered);
    setEvents((prev) => [...prev, numbered].slice(-MAX_EVENTS_KEPT));
  }, []);

  // Refs to persist across renders without re-triggering effect
  const lastEventIdRef = useRef<string | null>(null);
  const retryCountRef = useRef(0);
  const esRef = useRef<EventSource | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const unmountedRef = useRef(false);

  const disconnect = useCallback(() => {
    if (reconnectTimerRef.current !== null) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    if (esRef.current) {
      esRef.current.close();
      esRef.current = null;
    }
  }, []);

  const connect = useCallback(() => {
    if (unmountedRef.current || !tableId) return;

    disconnect();

    // Build URL; include Last-Event-ID as query param because EventSource
    // does not allow setting request headers directly.
    let url = `/sse/tables/${tableId}`;
    if (lastEventIdRef.current !== null) {
      url += `?lastEventId=${encodeURIComponent(lastEventIdRef.current)}`;
    }

    const es = new EventSource(url);
    esRef.current = es;

    es.onopen = () => {
      if (unmountedRef.current) return;
      retryCountRef.current = 0;
      setConnected(true);
    };

    // Generic message handler (unnamed events)
    es.onmessage = (ev: MessageEvent) => {
      if (unmountedRef.current) return;
      if (ev.lastEventId) {
        lastEventIdRef.current = ev.lastEventId;
      }
      try {
        const parsed = JSON.parse(ev.data as string) as unknown;
        pushEvent({ type: 'message', data: parsed });
      } catch {
        pushEvent({ type: 'message', data: ev.data });
      }
    };

    // Named event types the server emits
    const namedEvents = [
      'ORDER_PLACED',
      'ORDER_STATUS_CHANGED',
      'TABLE_CLOSED',
      'MENU_AVAILABILITY_CHANGED',
    ];

    for (const eventType of namedEvents) {
      es.addEventListener(eventType, (ev: Event) => {
        if (unmountedRef.current) return;
        const msgEv = ev as MessageEvent;
        if (msgEv.lastEventId) {
          lastEventIdRef.current = msgEv.lastEventId;
        }
        try {
          const parsed = JSON.parse(msgEv.data as string) as unknown;
          pushEvent({ type: eventType, data: parsed });
        } catch {
          pushEvent({ type: eventType, data: msgEv.data });
        }
      });
    }

    es.onerror = () => {
      if (unmountedRef.current) return;
      setConnected(false);
      es.close();
      esRef.current = null;

      const delay =
        BACKOFF_STEPS[Math.min(retryCountRef.current, BACKOFF_STEPS.length - 1)];
      retryCountRef.current += 1;

      reconnectTimerRef.current = setTimeout(() => {
        if (!unmountedRef.current) {
          connect();
        }
      }, delay);
    };
  }, [tableId, disconnect, pushEvent]);

  useEffect(() => {
    if (!tableId) return;
    unmountedRef.current = false;
    connect();

    return () => {
      unmountedRef.current = true;
      disconnect();
    };
  }, [tableId, connect, disconnect]);

  return { lastEvent, events, connected };
}
