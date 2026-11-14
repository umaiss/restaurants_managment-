/**
 * The restaurant-wide "Show takings on TV" setting (U8, contract C2 and C5).
 * Rules: BR1.1 (no row means hidden; the value survives a restart), BR1.3 (a change is saved with updated_at;
 * the same value again saves nothing). Publishing the change is the route's job, after this save succeeds.
 */
import { getDb } from './db.js';
import { toIso } from './time.js';
import type { TvSettings } from '../shared/tvWall.js';

const KEY = 'show_takings';

/** The stored setting; a missing row reads exactly like hidden (BR1.1). */
export function getTvSettings(): TvSettings {
  const row = getDb().prepare('SELECT value, updated_at FROM tv_settings WHERE key = ?').get(KEY) as
    | { value: number; updated_at: string | null }
    | undefined;
  if (!row) return { show_takings: false, updated_at: null };
  return { show_takings: row.value === 1, updated_at: row.updated_at };
}

/** True when takings are shown on the TV wall. */
export function getShowTakings(): boolean {
  return getTvSettings().show_takings;
}

/**
 * Saves a new value (BR1.3). `changed` is false when the value was already that: nothing is written and the
 * old updated_at is kept. A failing write throws, so the caller answers 500 and publishes nothing.
 */
export function setShowTakings(value: boolean, now: Date = new Date()): { changed: boolean; settings: TvSettings } {
  const current = getTvSettings();
  if (current.show_takings === value) return { changed: false, settings: current };
  const updatedAt = toIso(now);
  getDb()
    .prepare(
      `INSERT INTO tv_settings (key, value, updated_at) VALUES (?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`
    )
    .run(KEY, value ? 1 : 0, updatedAt);
  return { changed: true, settings: { show_takings: value, updated_at: updatedAt } };
}
