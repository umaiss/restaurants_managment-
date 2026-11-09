/**
 * The call card's state (U6 BR5.1 to BR5.3; D10, W7). One button per kind: ready, sent ("Request sent") or
 * answered ("Help is on the way."). The card is hidden when the table has no open visit.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { SSEEvent } from '../../../hooks/useTableSSE.js';
import { ApiError, fetchCalls, postCall, type CallKind, type PaymentMethod, type ServiceCallRow } from '../api.js';
import { useNewEvents } from '../liveHelpers.js';

export type CallState = 'ready' | 'sent' | 'answered';

export interface CallsView {
  states: Record<CallKind, CallState>;
  /** False once the server says there is no open visit, or the table was closed (BR5.3). */
  visible: boolean;
  /** A press that failed to reach the server (BR5.1). */
  error: string | null;
  press: (kind: CallKind, paymentMethod?: PaymentMethod, wantsReceipt?: boolean) => Promise<void>;
}

/** The state of one kind from a list of requests: the newest one decides. */
export function stateFromCalls(calls: ServiceCallRow[], kind: CallKind): CallState {
  const mine = calls.filter((c) => c.kind === kind);
  const last = mine[mine.length - 1];
  if (!last) return 'ready';
  return last.status === 'open' ? 'sent' : 'answered';
}

export function useCalls(tableId: string, events?: SSEEvent[]): CallsView {
  const [states, setStates] = useState<Record<CallKind, CallState>>({ waiter: 'ready', bill: 'ready' });
  const [visible, setVisible] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const busy = useRef<Record<CallKind, boolean>>({ waiter: false, bill: false });
  // A read that started before a press is older than the press: its answer must not undo "Request sent".
  const version = useRef(0);

  const load = useCallback(async () => {
    const started = version.current;
    try {
      const calls = await fetchCalls(tableId);
      if (started !== version.current) return;
      setStates({ waiter: stateFromCalls(calls, 'waiter'), bill: stateFromCalls(calls, 'bill') });
    } catch {
      // A failed read changes nothing: the buttons keep what they show.
    }
  }, [tableId]);

  useEffect(() => {
    void load();
  }, [load]);

  useNewEvents(events, (ev) => {
    if (ev.type === 'TABLE_CLOSED') {
      // BR5.3: no open visit, no card; the server cleared the requests, so a new visit starts from "ready"
      version.current += 1;
      setStates({ waiter: 'ready', bill: 'ready' });
      setVisible(false);
      return;
    }
    // An order (or a request) means the table has an open visit again: show the card and read its requests.
    if (ev.type === 'ORDER_PLACED' || ev.type === 'SERVICE_CALL_OPENED' || ev.type === 'SERVICE_CALL_RESPONDED') {
      setVisible(true);
      setError(null);
      void load();
    }
  });

  const press = useCallback(
    async (kind: CallKind, paymentMethod?: PaymentMethod, wantsReceipt?: boolean) => {
      if (busy.current[kind]) return; // a double tap makes one request
      busy.current[kind] = true;
      version.current += 1;
      setError(null);
      try {
        await postCall(tableId, kind, paymentMethod, wantsReceipt);
        version.current += 1;
        setStates((s) => ({ ...s, [kind]: 'sent' }));
      } catch (e) {
        if (e instanceof ApiError && e.code === 'NO_OPEN_VISIT') setVisible(false);
        else setError('Could not send. Try again.');
      } finally {
        busy.current[kind] = false;
      }
    },
    [tableId]
  );

  return { states, visible, error, press };
}
