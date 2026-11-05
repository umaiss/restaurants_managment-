import { getDb } from '../db.js';

export interface Category {
  id: string;
  name: string;
  order: number;
}

export interface MenuItem {
  id: string;
  category_id: string;
  name: string;
  description: string;
  image: string;
  price_cents: number;
  available: boolean;
}

export interface MenuResponse {
  categories: Category[];
  items: MenuItem[];
}

export function getMenu(): MenuResponse {
  const db = getDb();

  const categories = db.prepare(
    'SELECT id, name, sort_order as "order" FROM categories ORDER BY sort_order'
  ).all() as Category[];

  const rawItems = db.prepare(
    'SELECT id, category_id, name, description, image, price_cents, available FROM items ORDER BY category_id, id'
  ).all() as Array<{
    id: string;
    category_id: string;
    name: string;
    description: string;
    image: string;
    price_cents: number;
    available: number;
  }>;

  const items: MenuItem[] = rawItems.map((row) => ({
    ...row,
    available: row.available === 1,
  }));

  return { categories, items };
}

export function updateItemAvailability(itemId: string, available: boolean): MenuItem | null {
  const db = getDb();
  const existing = db.prepare('SELECT id FROM items WHERE id = ?').get(itemId);
  if (!existing) return null;

  db.prepare('UPDATE items SET available = ? WHERE id = ?').run(available ? 1 : 0, itemId);

  const updated = db.prepare(
    'SELECT id, category_id, name, description, image, price_cents, available FROM items WHERE id = ?'
  ).get(itemId) as { id: string; category_id: string; name: string; description: string; image: string; price_cents: number; available: number };

  return { ...updated, available: updated.available === 1 };
}
