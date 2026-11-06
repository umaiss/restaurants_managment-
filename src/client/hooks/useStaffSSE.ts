import { useState, useEffect, useRef } from 'react';

export interface StaffSSEEvent {
  type: string;
  data: unknown;
}

/**
 * Single shared EventSource for /sse/staff.
 * Returns { lastEvent, connected } so consumers can filter for their event types.
 */
export function useStaffSSE(): { lastEvent: StaffSSEEvent | null; connected: boolean } {
  const [lastEvent, setLastEvent] = useState<StaffSSEEvent | null>(null);
  const [connected, setConnected] = useState(false);
  const esRef = useRef<EventSource | null>(null);

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
        const parsed = JSON.parse(e.data) as unknown;
        setLastEvent({ type, data: parsed });
      });
    }

    return () => {
      es.close();
      esRef.current = null;
    };
  }, []);

  return { lastEvent, connected };
}
