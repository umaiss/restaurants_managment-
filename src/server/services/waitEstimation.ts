/**
 * WaitEstimation (U5 Step 7). Implements BR4.1: the estimate is today's average time to Completed
 * plus an allowance for each open order. The "Running late" decision (BR4.2) is in src/shared/wait.ts.
 */
import { getDb } from '../db.js';
import { ALLOWANCE_PER_OPEN_ORDER_MINUTES, DEFAULT_AVERAGE_MINUTES } from '../config.js';
import { localDayBounds, minutesBetween, parseStoredTime } from '../time.js';

export interface Estimate {
  estimate_minutes: number;
  /** "default" means no order has completed today and the starting value is used. */
  basis: 'today' | 'default';
  open_orders: number;
}

/**
 * average = mean of (completed_at - placed_at) in minutes over today's orders that are Completed
 * (today = the server's local midnight to midnight, by placed_at; both timestamp formats are read;
 * Cancelled orders and orders with no completed_at are left out). With none, average = 15 and the
 * basis is "default". open = orders now Pending or Preparing.
 * estimate_minutes = round(average + 2 x open), and at least 1.
 */
export function computeEstimate(now: Date = new Date()): Estimate {
  const db = getDb();
  const { start, end } = localDayBounds(now);

  // Both stored formats begin with the UTC date, so a date prefix one day before local midnight's UTC
  // date is a safe lower bound; the exact day filter is done below on parsed instants.
  const lowerBound = new Date(start.getTime() - 24 * 3_600_000).toISOString().slice(0, 10);
  const rows = db
    .prepare(
      "SELECT placed_at, completed_at FROM orders WHERE status = 'Completed' AND completed_at IS NOT NULL AND placed_at >= ?"
    )
    .all(lowerBound) as Array<{ placed_at: string; completed_at: string }>;

  const durations: number[] = [];
  for (const row of rows) {
    const placed = parseStoredTime(row.placed_at);
    const completed = parseStoredTime(row.completed_at);
    if (!placed || !completed) continue;
    if (placed < start || placed >= end) continue;
    const minutes = minutesBetween(placed, completed);
    if (minutes < 0) continue; // a clock that went backwards is not a wait
    durations.push(minutes);
  }

  const open = (
    db.prepare("SELECT COUNT(*) AS n FROM orders WHERE status IN ('Pending', 'Preparing')").get() as { n: number }
  ).n;

  const basis: Estimate['basis'] = durations.length > 0 ? 'today' : 'default';
  const average =
    durations.length > 0 ? durations.reduce((sum, m) => sum + m, 0) / durations.length : DEFAULT_AVERAGE_MINUTES;

  return {
    estimate_minutes: Math.max(1, Math.round(average + ALLOWANCE_PER_OPEN_ORDER_MINUTES * open)),
    basis,
    open_orders: open,
  };
}
