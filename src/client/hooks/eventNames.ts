/**
 * Every live event name of contract 4, written once (BR9.2). A browser ignores any event type it has
 * not registered a listener for, so both stream hooks register all of these; U6 and U7 never edit the lists.
 */
export const EVENT_NAMES = [
  'ORDER_PLACED',
  'ORDER_STATUS_CHANGED',
  'TABLE_CLOSED',
  'MENU_AVAILABILITY_CHANGED',
  'MENU_CHANGED',
  'SPECIAL_CHANGED',
  'SERVICE_CALL_OPENED',
  'SERVICE_CALL_RESPONDED',
  'STATION_DONE',
  'TABLE_PRESENCE_CHANGED',
] as const;

export type EventName = (typeof EVENT_NAMES)[number];

/** v1's staff stream also listens for TABLE_STATUS_CHANGED; it stays. */
export const STAFF_EVENT_NAMES: readonly string[] = [...EVENT_NAMES, 'TABLE_STATUS_CHANGED'];

/** How often an open diner page tells the server it is still there (BR8.1). */
export const HEARTBEAT_INTERVAL_MS = 60_000;

/** A random page id of the allowed form: 8 to 64 letters, digits or hyphens (BR8.1). */
export function makePageId(): string {
  const c = typeof crypto !== 'undefined' ? crypto : undefined;
  if (c && typeof c.randomUUID === 'function') return c.randomUUID();
  let id = '';
  while (id.length < 32) id += Math.random().toString(36).slice(2);
  return id.slice(0, 32);
}
