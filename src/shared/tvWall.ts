/**
 * The TV wall's shared shapes and wait helpers (U8, contracts C1 and C4). Used by the server's summary
 * and by the browser's TV page, so both count waits the same way. Pure code; no Node-only code here.
 * Rules: BR2.3 (minutes waited on the server's clock, never below 0), BR2.4 (Slow from 8, Late from 15).
 */
import { parseStoredTime } from './time.js';

/** One open order on the wall (C1 orders[]). */
export interface OpenOrderView {
  order_number: number;
  table_id: number;
  status: 'Pending' | 'Preparing';
  placed_at: string;
  /** Sum of line quantities; 0 for an order with no lines (BR2.2). */
  portions: number;
}

/** Today's money, present only while takings are shown (BR3.3). */
export interface TakingsView {
  /** Tables closed today: exactly the Sales page's total_cents for today (BR3.1). */
  closed_cents: number;
  /** Live bills of open visits, cancelled orders left out (BR3.2). */
  open_cents: number;
}

export interface BusiestTableView {
  table_id: number;
  /** Non-cancelled orders placed today (BR4.1). */
  orders: number;
}

export interface TopDishView {
  item_id: string;
  name: string;
  /** Portions in non-cancelled orders placed today (BR4.2). */
  portions: number;
}

export interface OpenRequestView {
  call_id: string;
  table_id: number;
  kind: 'waiter' | 'bill';
  opened_at: string;
}

/** Everything the TV wall shows (C1), plus day_ends_at (plan R-02). */
export interface TvSummary {
  /** Server clock now, ISO 8601. */
  server_time: string;
  /** The server-local day the figures are for, YYYY-MM-DD. */
  day: string;
  /** The server's next local midnight, ISO 8601: the browser re-reads when its clock estimate passes it (BR7.4). */
  day_ends_at: string;
  show_takings: boolean;
  orders: OpenOrderView[];
  /** Absent while show_takings is false: no amount leaves the server (BR3.3). */
  takings?: TakingsView;
  busiest_table: BusiestTableView | null;
  top_dish: TopDishView | null;
  requests: OpenRequestView[];
}

/** The show-takings setting (C2). */
export interface TvSettings {
  show_takings: boolean;
  /** null until first changed. */
  updated_at: string | null;
}

/** Slow from this many whole minutes (BR2.4). */
export const SLOW_FROM_MINUTES = 8;
/** Late from this many whole minutes (BR2.4). */
export const LATE_FROM_MINUTES = 15;

/**
 * Whole minutes waited since `placedAt` (stored time text or a Date) at `now` (BR2.3): floor, never below 0.
 * An unreadable time counts as 0 rather than a made-up number.
 */
export function waitMinutes(placedAt: string | Date, now: Date): number {
  const placed = placedAt instanceof Date ? placedAt : parseStoredTime(placedAt);
  if (!placed || Number.isNaN(placed.getTime())) return 0;
  return Math.max(0, Math.floor((now.getTime() - placed.getTime()) / 60_000));
}

export type WaitLevel = 'none' | 'slow' | 'late';

/** BR2.4: no label below 8 minutes, "Slow" from 8 to 14, "Late" from 15. */
export function waitLevel(minutes: number): WaitLevel {
  if (minutes >= LATE_FROM_MINUTES) return 'late';
  if (minutes >= SLOW_FROM_MINUTES) return 'slow';
  return 'none';
}

/** The word shown for a wait level; colour is never the only signal (BR2.4, NFR7). */
export function waitLabel(level: WaitLevel): string {
  return level === 'late' ? 'Late' : level === 'slow' ? 'Slow' : '';
}
