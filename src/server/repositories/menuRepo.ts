/**
 * Menu data (v1, extended by U5 Step 5).
 * Rules: BR2.1 (hidden items and categories are not offered), BR2.2 (station, Grill when none),
 * BR2.3 (allergens: null = not set, [] = none), BR2.4 and BR2.5 (option groups and choices),
 * BR2.7 (staff read of the whole menu).
 */
import { getDb } from '../db.js';
import type { Allergen, Station } from '../config.js';

export interface Category {
  id: string;
  name: string;
  order: number;
}

export interface OptionChoice {
  id: string;
  label: string;
  price_delta_cents: number;
}

export type OptionKind = 'one' | 'any' | 'leave_out';

export interface OptionGroup {
  id: string;
  name: string;
  kind: OptionKind;
  required: boolean;
  choices: OptionChoice[];
}

export interface MenuItem {
  id: string;
  category_id: string;
  name: string;
  description: string;
  image: string;
  price_cents: number;
  available: boolean;
  station: Station;
  /** null means "not set" and is never read as safe; [] means the item contains none (BR2.3). */
  allergens: Allergen[] | null;
  options: OptionGroup[];
}

export interface MenuResponse {
  categories: Category[];
  items: MenuItem[];
}

export interface StaffCategory extends Category {
  hidden: boolean;
}

export interface StaffMenuItem extends MenuItem {
  hidden: boolean;
}

export interface StaffMenuResponse {
  categories: StaffCategory[];
  items: StaffMenuItem[];
}

interface RawItem {
  id: string;
  category_id: string;
  name: string;
  description: string;
  image: string;
  price_cents: number;
  available: number;
  hidden: number;
  station: string;
  allergens: string | null;
}

const ITEM_COLUMNS = 'id, category_id, name, description, image, price_cents, available, hidden, station, allergens';

/** NULL (or text that is not a list) is "not set"; a list, even an empty one, is a real answer. */
function parseAllergens(raw: string | null): Allergen[] | null {
  if (raw === null) return null;
  try {
    const value: unknown = JSON.parse(raw);
    return Array.isArray(value) ? (value as Allergen[]) : null;
  } catch {
    return null;
  }
}

/** All option groups with their choices, keyed by item id, in sort order. */
function loadOptions(): Map<string, OptionGroup[]> {
  const db = getDb();
  const groups = db
    .prepare('SELECT id, item_id, name, kind, required FROM option_groups ORDER BY item_id, sort_order, id')
    .all() as Array<{ id: string; item_id: string; name: string; kind: OptionKind; required: number }>;
  const choices = db
    .prepare('SELECT id, group_id, label, price_delta_cents FROM option_choices ORDER BY group_id, sort_order, id')
    .all() as Array<{ id: string; group_id: string; label: string; price_delta_cents: number }>;

  const choicesByGroup = new Map<string, OptionChoice[]>();
  for (const c of choices) {
    const list = choicesByGroup.get(c.group_id) ?? [];
    list.push({ id: c.id, label: c.label, price_delta_cents: c.price_delta_cents });
    choicesByGroup.set(c.group_id, list);
  }
  const byItem = new Map<string, OptionGroup[]>();
  for (const g of groups) {
    const list = byItem.get(g.item_id) ?? [];
    list.push({ id: g.id, name: g.name, kind: g.kind, required: g.required === 1, choices: choicesByGroup.get(g.id) ?? [] });
    byItem.set(g.item_id, list);
  }
  return byItem;
}

function toItem(row: RawItem, options: Map<string, OptionGroup[]>): StaffMenuItem {
  return {
    id: row.id,
    category_id: row.category_id,
    name: row.name,
    description: row.description,
    image: row.image,
    price_cents: row.price_cents,
    available: row.available === 1,
    hidden: row.hidden === 1,
    station: row.station as Station,
    allergens: parseAllergens(row.allergens),
    options: options.get(row.id) ?? [],
  };
}

/** The menu a diner sees: hidden items and the items of hidden categories are left out (BR2.1). */
export function getMenu(): MenuResponse {
  const db = getDb();

  const categories = db
    .prepare('SELECT id, name, sort_order as "order" FROM categories WHERE hidden = 0 ORDER BY sort_order')
    .all() as Category[];

  const rawItems = db
    .prepare(
      `SELECT ${ITEM_COLUMNS.split(', ')
        .map((c) => `items.${c}`)
        .join(', ')}
       FROM items JOIN categories ON categories.id = items.category_id
       WHERE items.hidden = 0 AND categories.hidden = 0
       ORDER BY items.category_id, items.id`
    )
    .all() as RawItem[];

  const options = loadOptions();
  const items: MenuItem[] = rawItems.map((row) => {
    const { hidden: _hidden, ...item } = toItem(row, options);
    return item;
  });

  return { categories, items };
}

/**
 * Staff read of the whole menu, including hidden items and categories, with options, allergens,
 * stations and hidden flags (BR2.7). The route that serves it is U7's (GET /api/staff/menu).
 */
export function getStaffMenu(): StaffMenuResponse {
  const db = getDb();
  const categories = (
    db.prepare('SELECT id, name, sort_order as "order", hidden FROM categories ORDER BY sort_order').all() as Array<
      Category & { hidden: number }
    >
  ).map((c) => ({ ...c, hidden: c.hidden === 1 }));

  const rawItems = db.prepare(`SELECT ${ITEM_COLUMNS} FROM items ORDER BY category_id, id`).all() as RawItem[];
  const options = loadOptions();
  return { categories, items: rawItems.map((row) => toItem(row, options)) };
}

export function updateItemAvailability(
  itemId: string,
  available: boolean
): Pick<MenuItem, 'id' | 'category_id' | 'name' | 'description' | 'image' | 'price_cents' | 'available'> | null {
  const db = getDb();
  const existing = db.prepare('SELECT id FROM items WHERE id = ?').get(itemId);
  if (!existing) return null;

  db.prepare('UPDATE items SET available = ? WHERE id = ?').run(available ? 1 : 0, itemId);

  const updated = db.prepare(
    'SELECT id, category_id, name, description, image, price_cents, available FROM items WHERE id = ?'
  ).get(itemId) as { id: string; category_id: string; name: string; description: string; image: string; price_cents: number; available: number };

  return { ...updated, available: updated.available === 1 };
}
