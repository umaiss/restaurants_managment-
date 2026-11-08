/**
 * The live Chef's special and its countdown (U6 BR9.1, BR9.2; W3 step 4). The card is removed at once when the
 * countdown reaches zero, without waiting for the server, and when a SPECIAL_CHANGED event says there is none.
 */
import { useCallback, useEffect, useState } from 'react';
import type { SSEEvent } from '../../../hooks/useTableSSE.js';
import { fetchCurrentSpecial } from '../api.js';
import type { ChefSpecial } from '../menuTypes.js';
import { useNewEvents } from '../liveHelpers.js';

export function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function useCurrentSpecial(events?: SSEEvent[], now: () => number = Date.now) {
  const [special, setSpecial] = useState<ChefSpecial | null>(null);
  const [tick, setTick] = useState(0);

  const load = useCallback(async () => {
    try {
      setSpecial(await fetchCurrentSpecial());
    } catch {
      // no card when the read fails (the live event will bring it)
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useNewEvents(events, (ev) => {
    if (ev.type !== 'SPECIAL_CHANGED') return;
    const data = ev.data as { special?: ChefSpecial | null } | null;
    if (data && typeof data === 'object' && 'special' in data) setSpecial(data.special ?? null);
    else void load();
  });

  useEffect(() => {
    if (!special) return;
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [special]);

  void tick;
  const remainingMs = special ? new Date(special.ends_at).getTime() - now() : 0;
  const live = special !== null && special.stock_left > 0 && remainingMs > 0;
  return { special: live ? special : null, remainingMs: live ? remainingMs : 0 };
}
