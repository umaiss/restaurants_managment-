/** U7's board numbers, in one place (plan "All the numbers"). Rules: BR2.1 (timer limits and refresh). */

/** BR2.1: a ticket is amber with the word "Slow" from this many whole minutes. */
export const TIMER_SLOW_MINUTES = 8;
/** BR2.1: and red with the word "Late" from this many. */
export const TIMER_LATE_MINUTES = 15;
/** BR2.1: the timer text is worked out again this often. */
export const TIMER_REFRESH_MS = 30_000;

export const STATION_NAMES = ['Grill', 'Cold', 'Bar', 'Desserts'] as const;
export type StationName = (typeof STATION_NAMES)[number];

export const ALL_STATIONS = 'All stations' as const;
export type BoardTab = typeof ALL_STATIONS | StationName;
export const BOARD_TABS: readonly BoardTab[] = [ALL_STATIONS, ...STATION_NAMES];

/** The words of an open request (BR3.2). */
export const CALL_LABELS = { waiter: 'Calling the waiter', bill: 'Asking for the bill' } as const;
