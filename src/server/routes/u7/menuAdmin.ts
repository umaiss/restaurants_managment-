/**
 * Menu management writes (U7 Step 4). Rules: BR5.2 (items; the server makes new ids, POST starts an item
 * available and not hidden), BR5.3 (categories: unique name, new ones go last, move up or down),
 * BR5.4 (option groups replaced as a whole in one transaction, ids kept when listed), BR5.6 (hiding is not
 * deleting: nothing here removes an item or a category). The routes publish the change after each write (BR5.5).
 */
import crypto from 'crypto';
import { getDb } from '../../db.js';
import { AppError } from '../../errors.js';
import { getCurrentSpecial } from '../../repositories/specialsRepo.js';
import { getStaffMenu, type OptionGroup, type StaffCategory, type StaffMenuItem } from '../../repositories/menuRepo.js';
import { invalid } from './errors.js';
import {
  cheapestLinePrice,
  checkCategoryNameUnique,
  checkName,
  validateItemBody,
  validateOptionGroups,
  type GroupInput,
} from './validation.js';

/** A server-made id: a prefix and a random value. */
export function makeId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`;
}

function readItem(id: string): StaffMenuItem | undefined {
  return getStaffMenu().items.find((i) => i.id === id);
}

function groupsOfItem(itemId: string): GroupInput[] {
  const item = readItem(itemId);
  return (item?.options ?? []).map((g) => ({ id: g.id, name: g.name, kind: g.kind, required: g.required, choices: g.choices.map((c) => ({ ...c })) }));
}

function assertCategoryExists(categoryId: string): void {
  if (!getDb().prepare('SELECT 1 FROM categories WHERE id = ?').get(categoryId)) {
    throw invalid('category_id', 'That category does not exist.');
  }
}

/** BR5.2: POST. Answers the whole item as the staff menu shows it. */
export function createItem(body: unknown): StaffMenuItem {
  const f = validateItemBody(body, false);
  assertCategoryExists(f.category_id as string);
  const db = getDb();
  const id = makeId('i');
  db.prepare(
    `INSERT INTO items (id, category_id, name, description, price_cents, image, available, hidden, station, allergens)
     VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, ?)`
  ).run(
    id,
    f.category_id,
    f.name,
    f.description ?? '',
    f.price_cents,
    f.image ?? '',
    f.hidden ? 1 : 0,
    f.station ?? 'Grill',
    f.allergens === undefined || f.allergens === null ? null : JSON.stringify(f.allergens)
  );
  return readItem(id) as StaffMenuItem;
}

/** BR5.2: PATCH changes only the fields sent. Throws UNKNOWN_ITEM for an item that does not exist. */
export function updateItem(id: string, body: unknown): StaffMenuItem {
  const before = readItem(id);
  if (!before) throw new AppError('UNKNOWN_ITEM', `Item ${id} not found`);
  const f = validateItemBody(body, true);
  if (f.category_id !== undefined) assertCategoryExists(f.category_id);

  // Integration fix: an edit may carry the new option groups ("options", the groups of PUT .../options). The new
  // price is then checked against the NEW options, and price and options are saved together or not at all.
  const rawOptions = (body as { options?: unknown }).options;
  let newGroups: GroupInput[] | undefined;
  if (rawOptions !== undefined) {
    const list = Array.isArray(rawOptions) ? rawOptions : (rawOptions as { groups?: unknown } | null)?.groups;
    newGroups = validateOptionGroups({ groups: list }, lowestPriceWithSpecial(id, f.price_cents ?? before.price_cents));
  } else if (f.price_cents !== undefined && cheapestLinePrice(f.price_cents, groupsOfItem(id)) < 0) {
    // A lower price must not make a line that already has options cost less than nothing (BR5.4).
    throw invalid('price_cents', 'With its current options the cheapest possible price of this item would be below $0.00.');
  }
  const columns: Record<string, string | number | null> = {};
  if (f.name !== undefined) columns.name = f.name;
  if (f.description !== undefined) columns.description = f.description;
  if (f.price_cents !== undefined) columns.price_cents = f.price_cents;
  if (f.image !== undefined) columns.image = f.image;
  if (f.category_id !== undefined) columns.category_id = f.category_id;
  if (f.station !== undefined) columns.station = f.station;
  if (f.allergens !== undefined) columns.allergens = f.allergens === null ? null : JSON.stringify(f.allergens);
  if (f.hidden !== undefined) columns.hidden = f.hidden ? 1 : 0;
  const keys = Object.keys(columns);
  // One transaction: the fields and the option groups are saved together or not at all.
  getDb().transaction(() => {
    if (keys.length > 0) {
      getDb()
        .prepare(`UPDATE items SET ${keys.map((k) => `${k} = ?`).join(', ')} WHERE id = ?`)
        .run(...keys.map((k) => columns[k]), id);
    }
    if (newGroups) writeOptions(id, before, newGroups);
  })();
  return readItem(id) as StaffMenuItem;
}

/**
 * The price the cheapest-option check starts from: the item's regular price, or the live special's price for the
 * item when that is lower (a special line is priced from the special, so its options must not take it below zero).
 */
function lowestPriceWithSpecial(itemId: string, regularCents: number): number {
  const special = getCurrentSpecial();
  return special && special.item_id === itemId ? Math.min(regularCents, special.special_price_cents) : regularCents;
}

/**
 * BR5.4: replaces an item's option groups as a whole, in one transaction. A group or choice listed with an id
 * it already has keeps that id; any other gets a new one; one left out is removed.
 */
export function replaceOptions(itemId: string, body: unknown): OptionGroup[] {
  const item = readItem(itemId);
  if (!item) throw new AppError('UNKNOWN_ITEM', `Item ${itemId} not found`);
  // Integration fix: the cheapest price is checked against the lowest of the regular price and a live special's price.
  const groups = validateOptionGroups(body, lowestPriceWithSpecial(itemId, item.price_cents));
  getDb().transaction(() => writeOptions(itemId, item, groups))();
  return (readItem(itemId) as StaffMenuItem).options;
}

/** Writes a checked list of option groups for an item (inside the caller's transaction). */
function writeOptions(itemId: string, item: StaffMenuItem, groups: GroupInput[]): void {
  const db = getDb();
  {
    const existingGroups = new Map(item.options.map((g) => [g.id, new Set(g.choices.map((c) => c.id))]));
    const keptGroups = new Set<string>();
    const keptChoices = new Set<string>();

    groups.forEach((g, gi) => {
      const keep = g.id !== undefined && existingGroups.has(g.id) && !keptGroups.has(g.id);
      const groupId = keep ? (g.id as string) : makeId('og');
      keptGroups.add(groupId);
      if (keep) {
        db.prepare('UPDATE option_groups SET name = ?, kind = ?, required = ?, sort_order = ? WHERE id = ?').run(g.name, g.kind, g.required ? 1 : 0, gi + 1, groupId);
      } else {
        db.prepare('INSERT INTO option_groups (id, item_id, name, kind, required, sort_order) VALUES (?, ?, ?, ?, ?, ?)').run(groupId, itemId, g.name, g.kind, g.required ? 1 : 0, gi + 1);
      }
      g.choices.forEach((c, ci) => {
        const own = existingGroups.get(groupId);
        const keepChoice = keep && c.id !== undefined && own?.has(c.id) === true && !keptChoices.has(c.id);
        const choiceId = keepChoice ? (c.id as string) : makeId('oc');
        keptChoices.add(choiceId);
        if (keepChoice) {
          db.prepare('UPDATE option_choices SET label = ?, price_delta_cents = ?, sort_order = ? WHERE id = ?').run(c.label, c.price_delta_cents, ci + 1, choiceId);
        } else {
          db.prepare('INSERT INTO option_choices (id, group_id, label, price_delta_cents, sort_order) VALUES (?, ?, ?, ?, ?)').run(choiceId, groupId, c.label, c.price_delta_cents, ci + 1);
        }
      });
    });

    // Remove what was left out: choices first (they point at their group).
    for (const g of item.options) {
      for (const c of g.choices) {
        if (!keptChoices.has(c.id)) db.prepare('DELETE FROM option_choices WHERE id = ?').run(c.id);
      }
      if (!keptGroups.has(g.id)) db.prepare('DELETE FROM option_groups WHERE id = ?').run(g.id);
    }
  }
}

function readCategory(id: string): StaffCategory | undefined {
  return getStaffMenu().categories.find((c) => c.id === id);
}

/** BR5.3: POST. The new category goes last. */
export function createCategory(body: unknown): StaffCategory {
  const name = checkName((body as { name?: unknown } | null)?.name, 'name', 'Name');
  const db = getDb();
  checkCategoryNameUnique(name, db.prepare('SELECT id, name FROM categories').all() as Array<{ id: string; name: string }>);
  const id = makeId('c');
  const last = (db.prepare('SELECT COALESCE(MAX(sort_order), 0) AS n FROM categories').get() as { n: number }).n;
  db.prepare('INSERT INTO categories (id, name, sort_order, hidden) VALUES (?, ?, ?, 0)').run(id, name, last + 1);
  return readCategory(id) as StaffCategory;
}

/** BR5.3: PATCH can rename, set hidden, or move up or down (a swap with the neighbour). */
export function updateCategory(id: string, body: unknown): StaffCategory {
  const db = getDb();
  if (!readCategory(id)) throw new AppError('UNKNOWN_CATEGORY', `Category ${id} not found`);
  if (typeof body !== 'object' || body === null || Array.isArray(body)) throw invalid('body', 'The request must be a JSON object.');
  const b = body as { name?: unknown; hidden?: unknown; move?: unknown };

  let name: string | undefined;
  if (b.name !== undefined) {
    name = checkName(b.name, 'name', 'Name');
    checkCategoryNameUnique(name, db.prepare('SELECT id, name FROM categories').all() as Array<{ id: string; name: string }>, id);
  }
  if (b.hidden !== undefined && typeof b.hidden !== 'boolean') throw invalid('hidden', 'Hidden must be true or false.');
  if (b.move !== undefined && b.move !== 'up' && b.move !== 'down') throw invalid('move', 'move must be up or down.');

  db.transaction(() => {
    if (name !== undefined) db.prepare('UPDATE categories SET name = ? WHERE id = ?').run(name, id);
    if (typeof b.hidden === 'boolean') db.prepare('UPDATE categories SET hidden = ? WHERE id = ?').run(b.hidden ? 1 : 0, id);
    if (b.move === 'up' || b.move === 'down') {
      const order = (db.prepare('SELECT id FROM categories ORDER BY sort_order, id').all() as Array<{ id: string }>).map((r) => r.id);
      const at = order.indexOf(id);
      const to = b.move === 'up' ? at - 1 : at + 1;
      if (to >= 0 && to < order.length) {
        [order[at], order[to]] = [order[to], order[at]];
        order.forEach((cid, i) => db.prepare('UPDATE categories SET sort_order = ? WHERE id = ?').run(i + 1, cid));
      }
    }
  })();
  return readCategory(id) as StaffCategory;
}
