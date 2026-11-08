/**
 * Database access, upgrade and seed.
 *
 * U5 (Step 3) adds upgradeSchema: BR11.1 (the upgrade only adds and can run twice), BR11.2 (v1's
 * counts of 10 tables, 4 categories and 12 items are unchanged), BR2.2, BR2.3, BR2.6 (stations,
 * allergens and options in the seed), BR12.2 (station_done), BR3.3 (frozen station on lines).
 */
import Database from 'better-sqlite3';
import { getDbFile } from './config.js';
import { parseStoredTime, toIso } from './time.js';

let _db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!_db) {
    const db = new Database(getDbFile());
    try {
      db.pragma('journal_mode = WAL');
      db.pragma('foreign_keys = ON');
      initSchema(db);
      upgradeSchema(db);
    } catch (err) {
      // BR11.1: a failed start-up step stops the server with a message naming the step; no half-open handle is kept.
      try {
        db.close();
      } catch {
        // already closed
      }
      throw err;
    }
    _db = db;
  }
  return _db;
}

// Allow tests to close and reset the singleton.
export function resetDb(): void {
  if (_db) {
    try {
      _db.close();
    } catch {
      // already closed
    }
    _db = null;
  }
}

/** v1's tables, exactly as v1 made them. Never changed: v2 adds in upgradeSchema. */
export function initSchema(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS tables (
      id INTEGER PRIMARY KEY,
      label TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'open'
    );

    CREATE TABLE IF NOT EXISTS categories (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS items (
      id TEXT PRIMARY KEY,
      category_id TEXT NOT NULL REFERENCES categories(id),
      name TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      price_cents INTEGER NOT NULL,
      image TEXT NOT NULL DEFAULT '',
      available INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS visits (
      id TEXT PRIMARY KEY,
      table_id INTEGER NOT NULL REFERENCES tables(id),
      opened_at TEXT NOT NULL DEFAULT (datetime('now')),
      closed_at TEXT
    );

    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_number INTEGER NOT NULL UNIQUE,
      visit_id TEXT NOT NULL REFERENCES visits(id),
      table_id INTEGER NOT NULL REFERENCES tables(id),
      status TEXT NOT NULL DEFAULT 'Pending',
      placed_by TEXT NOT NULL DEFAULT 'diner',
      placement_key TEXT NOT NULL,
      placed_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(table_id, visit_id, placement_key)
    );

    CREATE TABLE IF NOT EXISTS order_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL REFERENCES orders(id),
      item_id TEXT NOT NULL REFERENCES items(id),
      quantity INTEGER NOT NULL,
      unit_price_cents INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS order_counter (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      next_order_number INTEGER NOT NULL DEFAULT 1
    );

    INSERT OR IGNORE INTO order_counter (id, next_order_number) VALUES (1, 1);
  `);
}

/** True when `table` already has a column called `column` (PRAGMA table_info). */
function hasColumn(db: Database.Database, table: string, column: string): boolean {
  const rows = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
  return rows.some((r) => r.name === column);
}

/** Adds a column only when it is missing. `definition` always carries a default or allows NULL (BR11.1). */
function addColumnIfMissing(db: Database.Database, table: string, column: string, definition: string): void {
  if (!hasColumn(db, table, column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

/**
 * The v2 upgrade (BR11.1, contract 5). It only adds: tables with CREATE TABLE IF NOT EXISTS, columns
 * checked with PRAGMA table_info, indexes with IF NOT EXISTS. Every column has a default or allows
 * NULL, existing rows are never touched, and running it twice changes nothing. A failing step stops
 * start-up with a message naming that step.
 */
export function upgradeSchema(db: Database.Database): void {
  const steps: Array<[string, () => void]> = [
    ['categories.hidden', () => addColumnIfMissing(db, 'categories', 'hidden', 'INTEGER NOT NULL DEFAULT 0')],
    ['items.hidden', () => addColumnIfMissing(db, 'items', 'hidden', 'INTEGER NOT NULL DEFAULT 0')],
    // BR3.3: a v1-era item or line has no station set and counts as Grill, so the default is Grill.
    ['items.station', () => addColumnIfMissing(db, 'items', 'station', "TEXT NOT NULL DEFAULT 'Grill'")],
    // BR2.3: NULL means "not set"; it is never read as "contains none".
    ['items.allergens', () => addColumnIfMissing(db, 'items', 'allergens', 'TEXT NULL')],
    ['orders.completed_at', () => addColumnIfMissing(db, 'orders', 'completed_at', 'TEXT NULL')],
    ['orders.estimate_minutes', () => addColumnIfMissing(db, 'orders', 'estimate_minutes', 'INTEGER NULL')],
    ['order_items.station', () => addColumnIfMissing(db, 'order_items', 'station', "TEXT NOT NULL DEFAULT 'Grill'")],
    ['order_items.special_id', () => addColumnIfMissing(db, 'order_items', 'special_id', 'TEXT NULL')],
    [
      'option_groups',
      () =>
        db.exec(`
      CREATE TABLE IF NOT EXISTS option_groups (
        id TEXT PRIMARY KEY,
        item_id TEXT NOT NULL REFERENCES items(id),
        name TEXT NOT NULL,
        kind TEXT NOT NULL CHECK (kind IN ('one','any','leave_out')),
        required INTEGER NOT NULL DEFAULT 0,
        sort_order INTEGER NOT NULL DEFAULT 0
      )`),
    ],
    [
      'option_choices',
      () =>
        db.exec(`
      CREATE TABLE IF NOT EXISTS option_choices (
        id TEXT PRIMARY KEY,
        group_id TEXT NOT NULL REFERENCES option_groups(id),
        label TEXT NOT NULL,
        price_delta_cents INTEGER NOT NULL DEFAULT 0,
        sort_order INTEGER NOT NULL DEFAULT 0
      )`),
    ],
    [
      'order_item_options',
      () =>
        db.exec(`
      CREATE TABLE IF NOT EXISTS order_item_options (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_item_id INTEGER NOT NULL REFERENCES order_items(id),
        label TEXT NOT NULL,
        price_delta_cents INTEGER NOT NULL DEFAULT 0
      )`),
    ],
    [
      'station_done',
      () =>
        db.exec(`
      CREATE TABLE IF NOT EXISTS station_done (
        order_number INTEGER NOT NULL REFERENCES orders(order_number),
        station TEXT NOT NULL,
        done_at TEXT NOT NULL,
        PRIMARY KEY (order_number, station)
      )`),
    ],
    [
      'chef_specials',
      () =>
        db.exec(`
      CREATE TABLE IF NOT EXISTS chef_specials (
        id TEXT PRIMARY KEY,
        item_id TEXT NOT NULL REFERENCES items(id),
        special_price_cents INTEGER NOT NULL,
        stock_total INTEGER NOT NULL,
        stock_left INTEGER NOT NULL,
        ends_at TEXT NOT NULL,
        ended_at TEXT NULL
      )`),
    ],
    [
      'service_calls',
      () =>
        db.exec(`
      CREATE TABLE IF NOT EXISTS service_calls (
        id TEXT PRIMARY KEY,
        visit_id TEXT NOT NULL REFERENCES visits(id),
        table_id INTEGER NOT NULL REFERENCES tables(id),
        kind TEXT NOT NULL CHECK (kind IN ('waiter','bill')),
        opened_at TEXT NOT NULL,
        responded_at TEXT NULL
      )`),
    ],
    [
      'dish_ratings',
      () =>
        db.exec(`
      CREATE TABLE IF NOT EXISTS dish_ratings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        visit_id TEXT NOT NULL REFERENCES visits(id),
        item_id TEXT NOT NULL REFERENCES items(id),
        thumb TEXT NOT NULL CHECK (thumb IN ('up','down')),
        rated_at TEXT NOT NULL,
        locked INTEGER NOT NULL DEFAULT 0,
        UNIQUE (visit_id, item_id)
      )`),
    ],
    [
      'index one_open_call',
      () =>
        db.exec(
          'CREATE UNIQUE INDEX IF NOT EXISTS one_open_call ON service_calls(visit_id, kind) WHERE responded_at IS NULL'
        ),
    ],
    ['index orders_completed', () => db.exec('CREATE INDEX IF NOT EXISTS orders_completed ON orders(completed_at)')],
    [
      'seed_backfill',
      () =>
        db.exec(`
      CREATE TABLE IF NOT EXISTS seed_backfill (
        name TEXT PRIMARY KEY,
        ran_at TEXT NOT NULL
      )`),
    ],
    ['backfill of the v2 seed details', () => backfillSeedDetails(db)],
  ];

  for (const [name, run] of steps) {
    try {
      run();
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      throw new Error(`Database upgrade failed at step "${name}": ${reason}`);
    }
  }
}

export function seedIfEmpty(): void {
  const db = getDb();
  const tableCount = (db.prepare('SELECT COUNT(*) as cnt FROM tables').get() as { cnt: number }).cnt;
  if (tableCount > 0) return;

  const insertTable = db.prepare('INSERT INTO tables (id, label, status) VALUES (?, ?, ?)');
  for (let i = 1; i <= 10; i++) {
    insertTable.run(i, `Table ${i}`, 'open');
  }

  const insertCategory = db.prepare('INSERT INTO categories (id, name, sort_order) VALUES (?, ?, ?)');
  insertCategory.run('c-01', 'Starters', 1);
  insertCategory.run('c-02', 'Mains', 2);
  insertCategory.run('c-03', 'Desserts', 3);
  insertCategory.run('c-04', 'Drinks', 4);

  const insertItem = db.prepare(
    'INSERT INTO items (id, category_id, name, description, price_cents, image, available) VALUES (?, ?, ?, ?, ?, ?, ?)'
  );

  // Starters (c-01)
  insertItem.run('i-01', 'c-01', 'Garlic Bread', 'Toasted sourdough with roasted garlic butter', 650, '🍞', 1);
  insertItem.run('i-02', 'c-01', 'House Salad', 'Mixed greens, cherry tomatoes, balsamic dressing', 850, '🥗', 1);
  insertItem.run('i-03', 'c-01', 'Caesar Salad', 'Romaine, parmesan, croutons, caesar dressing', 950, '🥗', 1);

  // Mains (c-02)
  insertItem.run('i-04', 'c-02', 'Classic Burger', 'Beef patty, lettuce, tomato, pickles, fries', 1450, '🍔', 1);
  insertItem.run('i-05', 'c-02', 'Grilled Salmon', 'Atlantic salmon fillet, seasonal vegetables, lemon butter', 1850, '🐟', 1);
  insertItem.run('i-06', 'c-02', 'Margherita Pizza', 'San Marzano tomato, fior di latte, fresh basil', 1350, '🍕', 1);
  insertItem.run('i-07', 'c-02', 'Pasta Carbonara', 'Spaghetti, pancetta, egg, parmesan, black pepper', 1250, '🍝', 1);

  // Desserts (c-03)
  insertItem.run('i-08', 'c-03', 'Chocolate Fondant', 'Warm dark chocolate cake with vanilla ice cream', 950, '🍫', 1);
  insertItem.run('i-09', 'c-03', 'Crème Brûlée', 'Classic vanilla custard with caramelised sugar', 850, '🍮', 1);

  // Drinks (c-04)
  insertItem.run('i-10', 'c-04', 'Sparkling Water', 'San Pellegrino 500ml', 350, '💧', 1);
  insertItem.run('i-11', 'c-04', 'Fresh Orange Juice', 'Freshly squeezed, served chilled', 450, '🍊', 1);
  insertItem.run('i-12', 'c-04', 'House Coffee', 'Espresso, cappuccino or flat white', 400, '☕', 1);

  // A fresh seeded database has the details already: it counts as having done the backfill.
  applySeedDetails(db);
  markBackfillDone(db);
}

/** The name the one-time backfill of the v2 seed details is recorded under in seed_backfill. */
export const SEED_DETAILS_BACKFILL = 'v2-seed-details';

/** The 12 seed items: the backfill matches an item only when both its id and its name are these. */
const SEED_ITEM_NAMES: Record<string, string> = {
  'i-01': 'Garlic Bread',
  'i-02': 'House Salad',
  'i-03': 'Caesar Salad',
  'i-04': 'Classic Burger',
  'i-05': 'Grilled Salmon',
  'i-06': 'Margherita Pizza',
  'i-07': 'Pasta Carbonara',
  'i-08': 'Chocolate Fondant',
  'i-09': 'Crème Brûlée',
  'i-10': 'Sparkling Water',
  'i-11': 'Fresh Orange Juice',
  'i-12': 'House Coffee',
};

function markBackfillDone(db: Database.Database): void {
  db.prepare('INSERT OR IGNORE INTO seed_backfill (name, ran_at) VALUES (?, ?)').run(SEED_DETAILS_BACKFILL, toIso());
}

/**
 * The one-time backfill of the v2 seed details for a database made by v1 (code review, Major). It is
 * additive and repeatable: it runs once (seed_backfill records it), and only for the 12 seed items
 * (matched on seed id AND seed name), only where an item is still at its defaults: station 'Grill',
 * allergens NULL, and no option groups yet. An item staff have edited is left alone, Grilled Salmon's
 * allergens stay NULL, and no row is ever removed. An empty database is left for seedIfEmpty.
 */
function backfillSeedDetails(db: Database.Database): void {
  const done = db.prepare('SELECT 1 FROM seed_backfill WHERE name = ?').get(SEED_DETAILS_BACKFILL);
  if (done) return;
  const anyItem = db.prepare('SELECT 1 FROM items LIMIT 1').get();
  if (!anyItem) return; // nothing to fill; the seed on an empty database does it and records it
  db.transaction(() => {
    applySeedDetails(db);
    markBackfillDone(db);
  })();
}

/**
 * v2 additions to v1's items (BR2.6): a station for every item, allergens for every item except
 * Grilled Salmon (left NULL so "Allergens not set" can be shown), and options for Classic Burger and
 * Margherita Pizza. It adds nothing but values on existing seed items that are still at their defaults,
 * so v1's counts stay 10 / 4 / 12 and an edited item is never touched.
 */
function applySeedDetails(db: Database.Database): void {
  const stations: Record<string, string> = {
    'i-01': 'Grill',
    'i-02': 'Cold',
    'i-03': 'Cold',
    'i-04': 'Grill',
    'i-05': 'Grill',
    'i-06': 'Grill',
    'i-07': 'Grill',
    'i-08': 'Desserts',
    'i-09': 'Desserts',
    'i-10': 'Bar',
    'i-11': 'Bar',
    'i-12': 'Bar',
  };
  // i-05 (Grilled Salmon) is deliberately missing: its allergens stay NULL (not set).
  const allergens: Record<string, string[]> = {
    'i-01': ['gluten', 'dairy'],
    'i-02': [],
    'i-03': ['gluten', 'dairy', 'eggs', 'fish'],
    'i-04': ['gluten', 'dairy', 'sesame'],
    'i-06': ['gluten', 'dairy'],
    'i-07': ['gluten', 'dairy', 'eggs'],
    'i-08': ['gluten', 'dairy', 'eggs'],
    'i-09': ['dairy', 'eggs'],
    'i-10': [],
    'i-11': [],
    'i-12': ['dairy'],
  };
  // Only the seed item (id and name both match), and only while the value is still the default.
  const setStation = db.prepare("UPDATE items SET station = ? WHERE id = ? AND name = ? AND station = 'Grill'");
  for (const [id, station] of Object.entries(stations)) setStation.run(station, id, SEED_ITEM_NAMES[id]);
  const setAllergens = db.prepare('UPDATE items SET allergens = ? WHERE id = ? AND name = ? AND allergens IS NULL');
  for (const [id, list] of Object.entries(allergens)) setAllergens.run(JSON.stringify(list), id, SEED_ITEM_NAMES[id]);
  // Options: only for a seed item that has no option group yet.
  const isSeedItemWithoutGroups = db.prepare(
    'SELECT 1 FROM items WHERE id = ? AND name = ? AND NOT EXISTS (SELECT 1 FROM option_groups WHERE item_id = ?)'
  );

  const insertGroup = db.prepare(
    'INSERT INTO option_groups (id, item_id, name, kind, required, sort_order) VALUES (?, ?, ?, ?, ?, ?)'
  );
  const insertChoice = db.prepare(
    'INSERT INTO option_choices (id, group_id, label, price_delta_cents, sort_order) VALUES (?, ?, ?, ?, ?)'
  );
  const addGroup = (
    id: string,
    itemId: string,
    name: string,
    kind: 'one' | 'any' | 'leave_out',
    required: boolean,
    sort: number,
    choices: Array<[string, string, number]>
  ) => {
    insertGroup.run(id, itemId, name, kind, required ? 1 : 0, sort);
    choices.forEach(([choiceId, label, delta], i) => insertChoice.run(choiceId, id, label, delta, i + 1));
  };

  // DEVIATION from BR2.6 ("Size choose-one required"): the seed's Size groups are NOT required.
  // A required group makes every v1 order of a Classic Burger or Margherita Pizza that carries no
  // option_ids fail with INVALID_OPTIONS (BR3.1 check 7): 27 of v1's tests, v1's e2e specs and the
  // v1 Menu's "+ Add" (which cannot send options until U6 adds the option sheet) would break, against
  // "v1's tests keep passing" (FR19.1). With no pick, Size costs +0 (Regular). Tests that need a
  // required group make one with the helpers; flipping this flag is the only change needed.
  if (isSeedItemWithoutGroups.get('i-04', SEED_ITEM_NAMES['i-04'], 'i-04')) {
    addGroup('og-04-size', 'i-04', 'Size', 'one', false, 1, [
      ['oc-04-size-regular', 'Regular', 0],
      ['oc-04-size-large', 'Large', 300],
    ]);
    addGroup('og-04-extras', 'i-04', 'Extras', 'any', false, 2, [
      ['oc-04-extras-cheese', 'Extra cheese', 100],
      ['oc-04-extras-bacon', 'Bacon', 150],
    ]);
    addGroup('og-04-leave-out', 'i-04', 'Leave out', 'leave_out', false, 3, [
      ['oc-04-leave-onions', 'No onions', 0],
      ['oc-04-leave-pickles', 'No pickles', 0],
    ]);
  }
  if (isSeedItemWithoutGroups.get('i-06', SEED_ITEM_NAMES['i-06'], 'i-06')) {
    addGroup('og-06-size', 'i-06', 'Size', 'one', false, 1, [
      ['oc-06-size-regular', 'Regular', 0],
      ['oc-06-size-large', 'Large', 300],
    ]);
  }
}

export function openVisit(tableId: number): string {
  const db = getDb();
  const visitId = crypto.randomUUID();
  // BR11.6: times v2 writes are ISO 8601 UTC text.
  db.prepare('INSERT INTO visits (id, table_id, opened_at) VALUES (?, ?, ?)').run(visitId, tableId, toIso());
  return visitId;
}

export function getCurrentVisit(tableId: number): { id: string; tableId: number } | null {
  const db = getDb();
  // There is normally one open visit; if there are several, the newest by parsed time wins (v1's and
  // v2's time text do not sort against each other, BR11.6), the row number breaking a tie.
  const rows = db
    .prepare('SELECT id, table_id, opened_at, rowid AS rid FROM visits WHERE table_id = ? AND closed_at IS NULL')
    .all(tableId) as Array<{ id: string; table_id: number; opened_at: string; rid: number }>;
  let best: { id: string; table_id: number; time: number; rid: number } | null = null;
  for (const row of rows) {
    const time = parseStoredTime(row.opened_at)?.getTime() ?? -Infinity;
    if (!best || time > best.time || (time === best.time && row.rid > best.rid)) best = { id: row.id, table_id: row.table_id, time, rid: row.rid };
  }
  if (!best) return null;
  return { id: best.id, tableId: best.table_id };
}

export function nextOrderNumber(): number {
  const db = getDb();
  // Increment counter atomically and return the value before increment (i.e. the number to use)
  const result = db.prepare(
    'UPDATE order_counter SET next_order_number = next_order_number + 1 WHERE id = 1 RETURNING next_order_number'
  ).get() as { next_order_number: number };
  // next_order_number is now N+1; we want to use N (the value before increment)
  return result.next_order_number - 1;
}
