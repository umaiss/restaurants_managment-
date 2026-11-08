/** The Cart's estimated wait (U6 BR3.1, BR3.2; W4): read on open and again after any order event. */
import { useCallback, useEffect, useState } from 'react';
import type { SSEEvent } from '../../../hooks/useTableSSE.js';
import { fetchEstimate, type Estimate } from '../api.js';
import { useNewEvents } from '../liveHelpers.js';

export type EstimateState =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'ready'; minutes: number; basis: Estimate['basis'] };

export function useEstimate(tableId: string, events?: SSEEvent[]): EstimateState {
  const [state, setState] = useState<EstimateState>({ status: 'loading' });

  const load = useCallback(async () => {
    try {
      const e = await fetchEstimate(tableId);
      // D7: never "0 min"
      setState({ status: 'ready', minutes: Math.max(1, Math.round(e.estimate_minutes)), basis: e.basis });
    } catch {
      setState((prev) => (prev.status === 'ready' ? prev : { status: 'error' }));
    }
  }, [tableId]);

  useEffect(() => {
    void load();
  }, [load]);

  useNewEvents(events, (ev) => {
    if (ev.type === 'ORDER_PLACED' || ev.type === 'ORDER_STATUS_CHANGED') void load();
  });

  return state;
}
