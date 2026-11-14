/**
 * The TV wall summary (U8, contract C1 plus day_ends_at): everything the wall shows, worked out on the server
 * for the server-local day of `now`. Built fresh on every read, never stored.
 * Rules: BR2.1 and BR2.2 (open orders of any day, oldest first, in portions), BR3.1 to BR3.4 (money, only while
 * shown), BR4.1 and BR4.2 (busiest table and top dish today), BR5.1 (open requests), plan R-02 (day_ends_at).
 */
import { getOpenOrdersAllTables, getTodayOrderCountsByTable, getTodayPortionsByItem } from './repositories/orderRepo.js';
import { listOpenCallsAllTables } from './repositories/serviceCallRepo.js';
import { openVisitsBillTotalCents } from './repositories/billingRepo.js';
import { closedDayTakingsCents, localDay } from './salesRules.js';
import { parseStoredTime, toIso } from './time.js';
import { getTvSettings } from './tvSettings.js';
import type { TvSummary } from '../shared/tvWall.js';

/** A stored time as ISO 8601 (C1's date-time), whichever format it was stored in. */
function asIso(text: string): string {
  const instant = parseStoredTime(text);
  return instant ? toIso(instant) : text;
}

/** The server's next local midnight after `now`. */
function nextLocalMidnight(now: Date): Date {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0, 0);
}

export function buildTvSummary(now: Date = new Date()): TvSummary {
  const day = localDay(now);
  const { show_takings } = getTvSettings();
  const busiest = getTodayOrderCountsByTable(day)[0];
  const top = getTodayPortionsByItem(day)[0];

  const summary: TvSummary = {
    server_time: toIso(now),
    day,
    day_ends_at: toIso(nextLocalMidnight(now)),
    show_takings,
    orders: getOpenOrdersAllTables().map((o) => ({ ...o, placed_at: asIso(o.placed_at) })),
    busiest_table: busiest ? { table_id: busiest.table_id, orders: busiest.orders } : null,
    top_dish: top ? { item_id: top.item_id, name: top.name, portions: top.portions } : null,
    requests: listOpenCallsAllTables().map((r) => ({ ...r, opened_at: asIso(r.opened_at) })),
  };
  // BR3.3: while hidden, no amount is worked out or sent; the key is absent, not zero.
  if (show_takings) {
    summary.takings = { closed_cents: closedDayTakingsCents(day), open_cents: openVisitsBillTotalCents() };
  }
  return summary;
}
