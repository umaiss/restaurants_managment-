/**
 * Time helpers (U5, Step 1). Implements BR11.6 (both stored time formats are read as UTC instants,
 * v2 writes ISO 8601 UTC) and the day boundary of BR4.1 (the server's local midnight to midnight).
 * Reading a stored time lives in src/shared/time.ts so the browser reads times the same way.
 */
export { parseStoredTime } from '../shared/time.js';

/** ISO 8601 UTC text, the format v2 writes. */
export function toIso(date: Date = new Date()): string {
  return date.toISOString();
}

/** The server's local day containing `now`: midnight (inclusive) to the next midnight (exclusive). */
export function localDayBounds(now: Date = new Date()): { start: Date; end: Date } {
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0, 0);
  return { start, end };
}

/** Minutes from `from` to `to`, as a fraction (not rounded). */
export function minutesBetween(from: Date, to: Date): number {
  return (to.getTime() - from.getTime()) / 60_000;
}
