/**
 * The day and money rules the Sales page and the TV wall share (U8, contract C5).
 * Rules: BR3.1 (today's takings are exactly the Sales page's total for today), BR3.4 (a day's rows are found
 * through a narrow text range, then checked exactly), BR10.1 (the Sales page's output does not change).
 *
 * Stored times (plan R-06): both stored formats are UTC. v1 wrote "YYYY-MM-DD HH:MM:SS" with no zone marker and
 * v2 writes ISO 8601 ("YYYY-MM-DDTHH:MM:SS.sssZ"); parseStoredTime reads both as UTC instants. Both start with
 * their UTC date, so a text range on the first 10 characters can pick out a few days of rows with an index.
 * The exact server-local day is then checked in code with the same rule the Sales page uses.
 */
import { getDb } from './db.js';
import { parseStoredTime } from './time.js';

/** The server's local calendar day of an instant, as YYYY-MM-DD. */
export function localDay(date: Date): string {
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${m}-${d}`;
}

/** The server-local day of a stored time (either format), or null when the text is not a time. */
export function dayOfStoredTime(text: string | null | undefined): string | null {
  const instant = parseStoredTime(text);
  return instant ? localDay(instant) : null;
}

/** The money of one order line: quantity times the price frozen on the line (BR9.2 of v2). */
export function lineTotalCents(line: { quantity: number; unit_price_cents: number }): number {
  return line.quantity * line.unit_price_cents;
}

/** Adds whole days to a YYYY-MM-DD calendar date (pure calendar arithmetic, no time zone). */
function shiftDay(day: string, days: number): string {
  const [y, m, d] = day.split('-').map(Number);
  const shifted = new Date(Date.UTC(y, m - 1, d + days));
  return shifted.toISOString().slice(0, 10);
}

/**
 * The stored-text range that holds every row of the server-local `day` (BR3.4): from the day before
 * (inclusive) to two days after (exclusive). Any server offset (at most 14 hours either way) puts the day's
 * UTC dates within the day before, the day itself and the day after. Use as `col >= from AND col < to`.
 */
export function dayWindow(day: string): { from: string; to: string } {
  return { from: shiftDay(day, -1), to: shiftDay(day, 2) };
}

/**
 * Today's takings rule (BR3.1): the sum of quantity x frozen price over the lines of non-cancelled orders of
 * visits closed on the server-local `day`. It reads only the visits closed inside the day window (index
 * visits_closed_at), never all history. Lines join their menu item, exactly as getSales does.
 */
export function closedDayTakingsCents(day: string): number {
  const { from, to } = dayWindow(day);
  const rows = getDb()
    .prepare(
      `SELECT v.closed_at, oi.quantity, oi.unit_price_cents
       FROM visits v
       JOIN orders o ON o.visit_id = v.id
       JOIN order_items oi ON oi.order_id = o.id
       JOIN items i ON i.id = oi.item_id
       WHERE v.closed_at >= ? AND v.closed_at < ? AND o.status != 'Cancelled'`
    )
    .all(from, to) as Array<{ closed_at: string; quantity: number; unit_price_cents: number }>;
  let total = 0;
  for (const row of rows) {
    if (dayOfStoredTime(row.closed_at) === day) total += lineTotalCents(row);
  }
  return total;
}
