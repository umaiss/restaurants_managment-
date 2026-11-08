import { useState, useEffect, useRef, useCallback } from 'react';
import { EVENT_NAMES, HEARTBEAT_INTERVAL_MS, makePageId } from './eventNames.js';

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

  // BR8.1: each open diner page makes a random page id, opens its stream with it and tells the server
  // it is still there when the stream opens and about every 60 seconds after, so staff see the table
  // as "Browsing". Every page that uses this hook is counted, with nothing for a screen to do.
  const pageIdRef = useRef<string>('');
  if (pageIdRef.current === '') pageIdRef.current = makePageId();
  const heartbeatTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopHeartbeat = useCallback(() => {
    if (heartbeatTimerRef.current !== null) {
      clearInterval(heartbeatTimerRef.current);
      heartbeatTimerRef.current = null;
    }
  }, []);

  const sendHeartbeat = useCallback(() => {
    if (!tableId || typeof fetch !== 'function') return;
    try {
      void Promise.resolve(
        fetch(`/api/tables/${tableId}/presence`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ page_id: pageIdRef.current }),
        })
      ).catch(() => undefined); // a missed heartbeat is retried a minute later; the page is not affected
    } catch {
      // fetch itself failed to start: the same
    }
  }, [tableId]);

  const startHeartbeat = useCallback(() => {
    stopHeartbeat();
    sendHeartbeat();
    heartbeatTimerRef.current = setInterval(sendHeartbeat, HEARTBEAT_INTERVAL_MS);
  }, [sendHeartbeat, stopHeartbeat]);

  const disconnect = useCallback(() => {
    stopHeartbeat();
    if (reconnectTimerRef.current !== null) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    if (esRef.current) {
      esRef.current.close();
      esRef.current = null;
    }
  }, [stopHeartbeat]);

  const connect = useCallback(() => {
    if (unmountedRef.current || !tableId) return;

    disconnect();

    // Build URL; include Last-Event-ID as query param because EventSource
    // does not allow setting request headers directly.
    let url = `/sse/tables/${tableId}?page=${encodeURIComponent(pageIdRef.current)}`;
    if (lastEventIdRef.current !== null) {
      url += `&lastEventId=${encodeURIComponent(lastEventIdRef.current)}`;
    }

    const es = new EventSource(url);
    esRef.current = es;

    es.onopen = () => {
      if (unmountedRef.current) return;
      retryCountRef.current = 0;
      setConnected(true);
      startHeartbeat();
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

    // Every named event type of contract 4, registered once (BR9.2)
    for (const eventType of EVENT_NAMES) {
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
      stopHeartbeat();
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
  }, [tableId, disconnect, pushEvent, startHeartbeat, stopHeartbeat]);

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
