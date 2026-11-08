/**
 * Menu change events (U5 Step 7). Implements BR9.2: a menu change is published through this one
 * function, which U7's routes and every Unit's tests call. MENU_CHANGED goes to staff and to every
 * table's channel, not only tables with an open visit: a diner who is still browsing has no visit yet.
 */
import { getDb } from './db.js';
import { publish } from './sse.js';

import type { ChefSpecial } from './repositories/specialsRepo.js';

export type MenuChangeReason = 'item' | 'category' | 'options';

/**
 * SPECIAL_CHANGED (BR5.5): the special was launched, its stock changed, or it ended (special is null).
 * Sent to staff and every table channel, for the same reason as MENU_CHANGED.
 */
export function publishSpecialChanged(special: ChefSpecial | null): void {
  const payload = { special };
  const tables = getDb().prepare('SELECT id FROM tables').all() as Array<{ id: number }>;
  for (const t of tables) publish(`table:${t.id}`, 'SPECIAL_CHANGED', payload);
  publish('staff', 'SPECIAL_CHANGED', payload);
}

const REASONS: readonly string[] = ['item', 'category', 'options'];

export function publishMenuChange(reason: MenuChangeReason, ids: string[] = []): void {
  if (!REASONS.includes(reason)) {
    throw new Error(`publishMenuChange: reason must be item, category or options (got "${String(reason)}")`);
  }
  const payload = { reason, ids };
  const tables = getDb().prepare('SELECT id FROM tables').all() as Array<{ id: number }>;
  for (const t of tables) publish(`table:${t.id}`, 'MENU_CHANGED', payload);
  publish('staff', 'MENU_CHANGED', payload);
}
