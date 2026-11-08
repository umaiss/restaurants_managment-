/**
 * Reading one staff route, and reading it again when a live event says it changed (U7 Steps 12 and 13).
 * Rules: BR4.3 (the floor map reads again on six events, and after a reconnect), BR5.5 (the menu page reloads on
 * MENU_CHANGED). A newer read always wins over an older one that arrives late. A failed read keeps the last good
 * answer and sets `error`. A 401 returns the screen to the PIN screen through staffFetch.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { staffFetch } from '../staffAuth';
import { useStaffSSE } from '../../hooks/useStaffSSE';

export interface ReadState<T> {
  data: T | null;
  loading: boolean;
  /** True when the last read failed. `data` still holds the last good answer, if any. */
  error: boolean;
  reload: () => void;
}

/** One read of `url`, again whenever `reload()` is called. */
export function useRead<T>(url: string): ReadState<T> & { setData: (data: T | null) => void } {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const requestRef = useRef(0);

  const load = useCallback(async () => {
    const request = ++requestRef.current;
    try {
      const res = await staffFetch(url);
      if (!res.ok) throw new Error(`${url} answered ${res.status}`);
      const body = (await res.json()) as T;
      if (request !== requestRef.current) return;
      setData(body);
      setError(false);
    } catch {
      if (request !== requestRef.current) return;
      setError(true);
    } finally {
      if (request === requestRef.current) setLoading(false);
    }
  }, [url]);

  useEffect(() => {
    setLoading(true);
    void load();
  }, [load]);

  const reload = useCallback(() => {
    setLoading(true);
    void load();
  }, [load]);

  return { data, loading, error, reload, setData };
}

/** useRead, plus a new read on each of `reloadOn` events and each time the live stream (re)connects. */
export function useLiveRead<T>(url: string, reloadOn: readonly string[]): ReadState<T> & { setData: (data: T | null) => void } {
  const state = useRead<T>(url);
  const { events, connected } = useStaffSSE();
  const processedSeqRef = useRef(0);
  const wasConnectedRef = useRef(false);
  const { reload } = state;

  useEffect(() => {
    let relevant = false;
    for (const ev of events) {
      const seq = ev.seq ?? 0;
      if (seq <= processedSeqRef.current) continue;
      processedSeqRef.current = seq;
      if (reloadOn.includes(ev.type)) relevant = true;
    }
    // A quiet reload: the screen keeps what it shows while the new answer is on its way.
    if (relevant) reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [events]);

  useEffect(() => {
    if (connected && !wasConnectedRef.current) reload();
    wasConnectedRef.current = connected;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connected]);

  return state;
}
