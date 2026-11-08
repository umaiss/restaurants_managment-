/**
 * Presence of diner pages (U5 Step 7), held by the live-events component.
 * Implements BR8.1 (page ids and heartbeats), BR8.2 (the 5-minute rule, the sweep, the caps) and
 * BR8.3 (TABLE_PRESENCE_CHANGED at most once a second per table).
 *
 * Everything is in memory; a restart resets the counts. U7's floor state only reads getPresence().
 */
import {
  PRESENCE_DROP_MS,
  PRESENCE_EVENT_DEBOUNCE_MS,
  PRESENCE_MAX_PER_TABLE,
  PRESENCE_MAX_TOTAL,
  PRESENCE_SWEEP_MS,
  PRESENCE_WINDOW_MS,
} from './config.js';
import { publish } from './sse.js';

/** BR8.1: a page id is 8 to 64 letters, digits or hyphens. */
export const PAGE_ID_PATTERN = /^[A-Za-z0-9-]{8,64}$/;

interface PageRecord {
  /** Open stream connections for this page id (a reconnect can briefly overlap). */
  connections: number;
  /** Time of the last sign of life: a heartbeat or a connection opening (ms). */
  lastSeen: number;
}

const pages = new Map<number, Map<string, PageRecord>>();
let totalPages = 0;
/** The last count published per table, so only a real change is published. */
const lastPublished = new Map<number, { connected: number; at: number }>();
const pending = new Map<number, ReturnType<typeof setTimeout>>();
let sweepTimer: ReturnType<typeof setInterval> | null = null;

export interface Presence {
  connected: number;
  /** ISO 8601 UTC time of the latest sign of life among the present pages; null when none is present. */
  last_activity_at: string | null;
}

function isPresent(record: PageRecord, now: number): boolean {
  return record.connections > 0 && now - record.lastSeen < PRESENCE_WINDOW_MS;
}

/** How many pages are present for a table and the time of the latest sign of life (BR8.2). */
export function getPresence(tableId: number, now: number = Date.now()): Presence {
  const table = pages.get(tableId);
  let connected = 0;
  let latest = 0;
  if (table) {
    for (const record of table.values()) {
      if (isPresent(record, now)) {
        connected++;
        latest = Math.max(latest, record.lastSeen);
      }
    }
  }
  return { connected, last_activity_at: connected > 0 ? new Date(latest).toISOString() : null };
}

/**
 * Pages pushed out by a cap while their stream was still open (code review, Minor): their open
 * connections are remembered here so the page comes back, and is counted, at its next heartbeat or
 * connection, and so closing the stream is still understood. Keyed "table:pageId".
 */
const evicted = new Map<string, number>();
const evictedKey = (tableId: number, pageId: string) => `${tableId}:${pageId}`;

/** True when a page with no open connection exists in the table (or anywhere when tableId is null). */
function hasQuietPage(tableId: number | null): boolean {
  for (const [t, table] of pages) {
    if (tableId !== null && t !== tableId) continue;
    for (const record of table.values()) if (record.connections === 0) return true;
  }
  return false;
}

/**
 * Makes room by dropping one page from one table (or from all tables when tableId is null): the oldest
 * quiet page (no open connection) first, and only when every page is connected the one with the oldest
 * sign of life. A connected page that is dropped is remembered in `evicted`.
 */
function pickVictim(tableId: number | null, quietOnly: boolean): { table: number; id: string } | null {
  let victim: { table: number; id: string } | null = null;
  let oldest = Infinity;
  for (const [t, table] of pages) {
    if (tableId !== null && t !== tableId) continue;
    for (const [id, record] of table) {
      if (quietOnly && record.connections > 0) continue;
      if (record.lastSeen < oldest) {
        oldest = record.lastSeen;
        victim = { table: t, id };
      }
    }
  }
  return victim;
}

function dropOldest(tableId: number | null): void {
  // A quiet page goes first; a connected one only when every page is connected.
  const victim = pickVictim(tableId, true) ?? pickVictim(tableId, false);
  if (!victim) return;
  const record = pages.get(victim.table)?.get(victim.id);
  if (record && record.connections > 0) evicted.set(evictedKey(victim.table, victim.id), record.connections);
  removePage(victim.table, victim.id);
  if (victim.table !== tableId) notifyChanged(victim.table);
}

function removePage(tableId: number, pageId: string): void {
  const table = pages.get(tableId);
  if (!table || !table.delete(pageId)) return;
  totalPages--;
  if (table.size === 0) pages.delete(tableId);
}

function getOrCreate(tableId: number, pageId: string, now: number): PageRecord {
  let table = pages.get(tableId);
  const existing = table?.get(pageId);
  if (existing) return existing;

  // BR8.2 caps: when full, the page with the oldest sign of life is dropped first.
  if ((table?.size ?? 0) >= PRESENCE_MAX_PER_TABLE) dropOldest(tableId);
  if (totalPages >= PRESENCE_MAX_TOTAL) dropOldest(null);

  table = pages.get(tableId);
  if (!table) {
    table = new Map();
    pages.set(tableId, table);
  }
  // A page that was pushed out while its stream was open comes back with those connections counted.
  const key = evictedKey(tableId, pageId);
  const record: PageRecord = { connections: evicted.get(key) ?? 0, lastSeen: now };
  evicted.delete(key);
  table.set(pageId, record);
  totalPages++;
  return record;
}

/** A diner page opened its stream for a table (counts as a sign of life). */
export function pageConnected(tableId: number, pageId: string, now: number = Date.now()): void {
  const record = getOrCreate(tableId, pageId, now);
  record.connections++;
  record.lastSeen = now;
  notifyChanged(tableId);
}

/** The stream closed: the page is removed at once when its last connection is gone (BR8.2). */
export function pageDisconnected(tableId: number, pageId: string): void {
  const record = pages.get(tableId)?.get(pageId);
  if (!record) {
    // An evicted page whose stream closes: forget one of its remembered connections.
    const key = evictedKey(tableId, pageId);
    const left = (evicted.get(key) ?? 0) - 1;
    if (left > 0) evicted.set(key, left);
    else evicted.delete(key);
    return;
  }
  record.connections--;
  if (record.connections <= 0) removePage(tableId, pageId);
  notifyChanged(tableId);
}

/** The heartbeat (BR8.1): a sign of life for a page, sent when it opens and about every 60 seconds. */
export function heartbeat(tableId: number, pageId: string, now: number = Date.now()): void {
  // A heartbeat from a page nobody knows (no stream, not pushed out) must not push a connected page out of a
  // full list: it could not be counted anyway. It is recorded only when a quiet page can make room for it.
  const known = pages.get(tableId)?.has(pageId) || evicted.has(evictedKey(tableId, pageId));
  if (!known) {
    const tableFull = (pages.get(tableId)?.size ?? 0) >= PRESENCE_MAX_PER_TABLE;
    const totalFull = totalPages >= PRESENCE_MAX_TOTAL;
    if ((tableFull && !hasQuietPage(tableId)) || (totalFull && !hasQuietPage(null))) return;
  }
  const record = getOrCreate(tableId, pageId, now);
  record.lastSeen = now;
  notifyChanged(tableId);
}

// ---------------------------------------------------------------- the event (BR8.3)

function publishNow(tableId: number): void {
  const presence = getPresence(tableId);
  lastPublished.set(tableId, { connected: presence.connected, at: Date.now() });
  publish('staff', 'TABLE_PRESENCE_CHANGED', {
    table_id: tableId,
    connected: presence.connected,
    last_activity_at: presence.last_activity_at,
  });
}

/**
 * Publishes TABLE_PRESENCE_CHANGED when the number of present pages changed, at most once a second per
 * table: a change inside that second waits and goes out as one event carrying the then-current count.
 */
function notifyChanged(tableId: number): void {
  if (pending.has(tableId)) return; // a trailing publish is already scheduled and will read the latest count
  const last = lastPublished.get(tableId);
  const current = getPresence(tableId).connected;
  if ((last?.connected ?? 0) === current && last !== undefined) return;
  if (last === undefined && current === 0) return;

  const wait = last ? Math.max(0, last.at + PRESENCE_EVENT_DEBOUNCE_MS - Date.now()) : 0;
  if (wait === 0) {
    publishNow(tableId);
    return;
  }
  const timer = setTimeout(() => {
    pending.delete(tableId);
    const before = lastPublished.get(tableId)?.connected ?? 0;
    if (getPresence(tableId).connected !== before) publishNow(tableId);
  }, wait);
  timer.unref?.();
  pending.set(tableId, timer);
}

// ---------------------------------------------------------------- the sweep (BR8.2, BR8.3)

/**
 * Drops pages quiet for more than 10 minutes and recounts every table, publishing for each table whose
 * count changed, so a page that goes quiet is reported within about 30 seconds even when nothing
 * connects or disconnects.
 */
export function sweepPresence(now: number = Date.now()): void {
  for (const [tableId, table] of [...pages]) {
    for (const [pageId, record] of [...table]) {
      if (now - record.lastSeen > PRESENCE_DROP_MS) removePage(tableId, pageId);
    }
  }
  const tables = new Set<number>([...pages.keys(), ...lastPublished.keys()]);
  for (const tableId of tables) notifyChanged(tableId);
}

export function startPresenceSweep(): void {
  if (sweepTimer !== null) return;
  sweepTimer = setInterval(() => sweepPresence(), PRESENCE_SWEEP_MS);
  sweepTimer.unref?.();
}

export function stopPresenceSweep(): void {
  if (sweepTimer !== null) {
    clearInterval(sweepTimer);
    sweepTimer = null;
  }
}

// ---------------------------------------------------------------- test helpers (no route reaches them)

/**
 * TEST ONLY (BR14.3): makes a table show exactly `count` present pages and publishes the change at
 * once, so U7's floor tests need no diner pages open.
 */
export function setPresenceForTest(tableId: number, count: number, now: number = Date.now()): void {
  const table = pages.get(tableId);
  if (table) for (const id of [...table.keys()]) removePage(tableId, id);
  for (let i = 0; i < count; i++) {
    const record = getOrCreate(tableId, `test-page-${tableId}-${i}`, now);
    record.connections = 1;
    record.lastSeen = now;
  }
  const timer = pending.get(tableId);
  if (timer) {
    clearTimeout(timer);
    pending.delete(tableId);
  }
  publishNow(tableId);
}

/** TEST ONLY: how many tables and pages are remembered (for the cap and sweep assertions). */
export function _presenceSizes(): { tables: number; pages: number } {
  return { tables: pages.size, pages: totalPages };
}

/** TEST ONLY: how many pages are remembered as pushed out while still connected. */
export function _evictedCount(): number {
  return evicted.size;
}

/** TEST ONLY: forgets every page and every pending event. */
export function resetPresenceForTest(): void {
  for (const timer of pending.values()) clearTimeout(timer);
  pending.clear();
  pages.clear();
  evicted.clear();
  lastPublished.clear();
  totalPages = 0;
  stopPresenceSweep();
}
