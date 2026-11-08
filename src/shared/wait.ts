/**
 * "Running late" decision for an open order (BR4.2), shared by the server and the browser so both
 * decide the same way. Pure functions; no Node-only code.
 */
import { parseStoredTime } from './time.js';

export type WaitDisplay =
  /** An order with no stored estimate (placed before v2) shows no time. */
  | { kind: 'none' }
  /** Waited longer than the estimate it was given: show "Running late", never a zero or negative time. */
  | { kind: 'late' }
  /** Time left: the estimate minus whole minutes elapsed, at least 1. */
  | { kind: 'remaining'; minutes: number };

export function waitDisplay(
  placedAt: string,
  estimateMinutes: number | null | undefined,
  now: Date = new Date()
): WaitDisplay {
  if (estimateMinutes === null || estimateMinutes === undefined) return { kind: 'none' };
  const placed = parseStoredTime(placedAt);
  if (!placed) return { kind: 'none' };
  const elapsed = Math.max(0, Math.floor((now.getTime() - placed.getTime()) / 60_000));
  if (elapsed > estimateMinutes) return { kind: 'late' };
  return { kind: 'remaining', minutes: Math.max(1, estimateMinutes - elapsed) };
}
