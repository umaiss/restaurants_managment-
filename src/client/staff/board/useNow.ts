import { useEffect, useState } from 'react';
import { TIMER_REFRESH_MS } from './constants';

/** The current time in milliseconds, refreshed every `everyMs` (BR2.1: 30 seconds), so timers never need a reload. */
export function useNow(everyMs: number = TIMER_REFRESH_MS): number {
  const [now, setNow] = useState<number>(() => Date.now());
  useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), everyMs);
    return () => clearInterval(id);
  }, [everyMs]);
  return now;
}
