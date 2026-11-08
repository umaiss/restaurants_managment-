/**
 * Server configuration (U5, Step 1). Implements BR11.5 (ports and database file come from the
 * environment) and keeps every tunable number of v2 in one place (BR1.3, BR1.4, BR4.1, BR5.1, BR8.2).
 *
 * Nothing secret is written here: the staff PIN is read from STAFF_PIN at use time (BR1.1).
 */

/** The port the server listens on: PORT first, then E2E_PORT, then 3000 (as v1 does). */
export function getPort(): number {
  const raw = process.env.PORT ?? process.env.E2E_PORT ?? '3000';
  const port = parseInt(raw, 10);
  return Number.isInteger(port) && port > 0 && port < 65536 ? port : 3000;
}

/** The database file (BR11.5). Tests set DB_FILE=:memory:. */
export function getDbFile(): string {
  return process.env.DB_FILE ?? 'table-order.db';
}

/** The raw STAFF_PIN setting; undefined when not set (BR1.1 decides what to do then). */
export function getStaffPinSetting(): string | undefined {
  return process.env.STAFF_PIN;
}

export const MINUTE_MS = 60_000;
export const HOUR_MS = 60 * MINUTE_MS;

/** BR4.1: minutes added to the estimate for every open (Pending or Preparing) order. */
export const ALLOWANCE_PER_OPEN_ORDER_MINUTES = 2;
/** BR4.1: the average used while no order has completed today. */
export const DEFAULT_AVERAGE_MINUTES = 15;

/** BR1.3: a staff session ends after this long without staff action. */
export const STAFF_IDLE_MS = 12 * HOUR_MS;
/** BR1.3: how often expired staff sessions are purged. */
export const STAFF_SWEEP_MS = 10 * MINUTE_MS;

/** BR1.4: wrong PIN tries in a row that lock a client address. */
export const LOCKOUT_MAX_TRIES = 5;
/** BR1.4: how long a locked address is refused. */
export const LOCKOUT_MS = 60_000;
/** BR1.4: an address with no try for this long is forgotten. */
export const LOGIN_ATTEMPT_EXPIRY_MS = 10 * MINUTE_MS;
/** BR1.4: how many addresses are remembered at most. */
export const LOGIN_ATTEMPT_MAX_ADDRESSES = 1000;

/** BR5.5: how often the live special is checked for expiry. */
export const SPECIAL_EXPIRY_CHECK_MS = 5_000;

/** BR8.2: a page is present for this long after its last sign of life. */
export const PRESENCE_WINDOW_MS = 5 * MINUTE_MS;
/** BR8.2: the presence sweep runs this often. */
export const PRESENCE_SWEEP_MS = 30_000;
/** BR8.2: a page quiet for longer than this is dropped by the sweep. */
export const PRESENCE_DROP_MS = 10 * MINUTE_MS;
/** BR8.2: memory caps for remembered pages. */
export const PRESENCE_MAX_PER_TABLE = 500;
export const PRESENCE_MAX_TOTAL = 5000;
/** BR8.3: presence events are merged to at most one per table per this long. */
export const PRESENCE_EVENT_DEBOUNCE_MS = 1_000;

/** BR1.9 and the v1 keep-alive: how often an idle stream gets a comment line. */
export const SSE_KEEP_ALIVE_MS = 20_000;

/** BR5.1 limits. */
export const SPECIAL_STOCK_MAX = 999;
export const SPECIAL_MINUTES_MAX = 720;

/** BR2.2 and BR2.3: the fixed lists. */
export const STATIONS = ['Grill', 'Cold', 'Bar', 'Desserts'] as const;
export type Station = (typeof STATIONS)[number];
export const ALLERGENS = [
  'gluten',
  'dairy',
  'eggs',
  'peanuts',
  'tree_nuts',
  'fish',
  'shellfish',
  'soy',
  'sesame',
] as const;
export type Allergen = (typeof ALLERGENS)[number];
