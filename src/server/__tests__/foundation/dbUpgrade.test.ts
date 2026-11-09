// U5 Step 4: the database upgrade and the seed (BR11.1, BR11.2, BR2.2, BR2.3, BR2.6, BR12.2, BR3.3).
process.env.DB_FILE = ':memory:';

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import Database from 'better-sqlite3';
import { getDb, resetDb, seedIfEmpty, initSchema, upgradeSchema } from '../../db.js';

const NEW_COLUMNS: Array<[string, string]> = [
  ['categories', 'hidden'],
  ['items', 'hidden'],
  ['items', 'station'],
  ['items', 'allergens'],
  ['orders', 'completed_at'],
  ['orders', 'estimate_minutes'],
  ['order_items', 'station'],
  ['order_items', 'special_id'],
];
const NEW_TABLES = [
  'option_groups',
  'option_choices',
  'order_item_options',
  'station_done',
  'chef_specials',
  'service_calls',
  'dish_ratings',
  'visit_feedback',
];

function columns(db: Database.Database, table: string): string[] {
  return (db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>).map((r) => r.name);
}
function tableNames(db: Database.Database): string[] {
  return (db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all() as Array<{ name: string }>).map(
    (r) => r.name
  );
}
function schemaSnapshot(db: Database.Database): string {
  return JSON.stringify(db.prepare('SELECT type, name, sql FROM sqlite_master ORDER BY type, name').all());
}
const count = (db: Database.Database, table: string) =>
  (db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get() as { n: number }).n;

/** A database exactly as v1 left it: v1's tables (initSchema is v1's schema, untouched) with a few rows. */
function makeV1Database(db: Database.Database): void {
  db.pragma('foreign_keys = ON');
  initSchema(db);
  db.prepare("INSERT INTO tables (id, label, status) VALUES (1, 'Table 1', 'open')").run();
  db.prepare("INSERT INTO categories (id, name, sort_order) VALUES ('c-01', 'Starters', 1)").run();
  db.prepare(
    "INSERT INTO items (id, category_id, name, description, price_cents, image, available) VALUES ('i-01', 'c-01', 'Garlic Bread', 'x', 650, 'b', 1)"
  ).run();
  db.prepare("INSERT INTO visits (id, table_id, opened_at) VALUES ('v-1', 1, datetime('now'))").run();
  db.prepare(
    "INSERT INTO orders (order_number, visit_id, table_id, status, placement_key) VALUES (7, 'v-1', 1, 'Completed', 'k-1')"
  ).run();
  db.prepare('INSERT INTO order_items (order_id, item_id, quantity, unit_price_cents) VALUES (1, ?, 2, 650)').run('i-01');
}

describe('database upgrade (BR11.1)', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = new Database(':memory:');
  });
  afterEach(() => {
    db.close();
  });

  it('a v1 database gets every new table and column and keeps every row', () => {
    makeV1Database(db);
    // Nothing of v2 is there yet
    expect(columns(db, 'items')).not.toContain('station');
    expect(tableNames(db)).not.toContain('service_calls');

    upgradeSchema(db);

    for (const [table, column] of NEW_COLUMNS) expect(columns(db, table), `${table}.${column}`).toContain(column);
    for (const table of NEW_TABLES) expect(tableNames(db), table).toContain(table);

    // v1's rows are all still there, unchanged
    expect(count(db, 'tables')).toBe(1);
    expect(count(db, 'items')).toBe(1);
    expect(db.prepare('SELECT name, price_cents FROM items WHERE id = ?').get('i-01')).toEqual({
      name: 'Garlic Bread',
      price_cents: 650,
    });
    const order = db.prepare('SELECT order_number, status, completed_at, estimate_minutes FROM orders').get();
    // v1-era orders: no completed time and no estimate (BR3.6), still Completed
    expect(order).toEqual({ order_number: 7, status: 'Completed', completed_at: null, estimate_minutes: null });
    // Garlic Bread is a seed item at its defaults, so the one-time backfill gives it the seed's details
    // (station Grill is the same as the default; allergens from the seed)
    expect(db.prepare('SELECT station, allergens, hidden FROM items').get()).toEqual({
      station: 'Grill',
      allergens: '["gluten","dairy"]',
      hidden: 0,
    });
    // A v1-era line counts as Grill (BR3.3)
    expect(db.prepare('SELECT station, special_id, quantity FROM order_items').get()).toEqual({
      station: 'Grill',
      special_id: null,
      quantity: 2,
    });
  });

  it('running it again changes nothing', () => {
    makeV1Database(db);
    upgradeSchema(db);
    const schemaAfterFirst = schemaSnapshot(db);
    const rowsAfterFirst = JSON.stringify(db.prepare('SELECT * FROM items').all());

    upgradeSchema(db);
    upgradeSchema(db);

    expect(schemaSnapshot(db)).toBe(schemaAfterFirst);
    expect(JSON.stringify(db.prepare('SELECT * FROM items').all())).toBe(rowsAfterFirst);
  });

  it('a half-upgraded file (some columns present) is finished', () => {
    makeV1Database(db);
    db.exec("ALTER TABLE items ADD COLUMN hidden INTEGER NOT NULL DEFAULT 0");
    db.exec("ALTER TABLE orders ADD COLUMN completed_at TEXT NULL");
    db.prepare("UPDATE orders SET completed_at = '2026-11-08T10:00:00.000Z'").run();

    upgradeSchema(db);

    for (const [table, column] of NEW_COLUMNS) expect(columns(db, table), `${table}.${column}`).toContain(column);
    // The value written before the upgrade finished survives
    expect((db.prepare('SELECT completed_at FROM orders').get() as { completed_at: string }).completed_at).toBe(
      '2026-11-08T10:00:00.000Z'
    );
  });

  it('a step that cannot run stops start-up with a message naming the step', () => {
    // No v1 tables at all: the first step has nothing to add a column to.
    expect(() => upgradeSchema(db)).toThrow(/Database upgrade failed at step "categories\.hidden"/);
  });

  it('the one-open-call index allows a second request only after the first is answered (contract 5)', () => {
    makeV1Database(db);
    upgradeSchema(db);
    const insert = db.prepare(
      "INSERT INTO service_calls (id, visit_id, table_id, kind, opened_at, responded_at) VALUES (?, 'v-1', 1, ?, '2026-11-08T10:00:00.000Z', ?)"
    );
    insert.run('c-1', 'waiter', null);
    expect(() => insert.run('c-2', 'waiter', null)).toThrow(/UNIQUE/);
    expect(() => insert.run('c-3', 'bill', null)).not.toThrow(); // another kind is fine
    db.prepare("UPDATE service_calls SET responded_at = '2026-11-08T10:01:00.000Z' WHERE id = 'c-1'").run();
    expect(() => insert.run('c-4', 'waiter', null)).not.toThrow();
  });

  it('station_done holds one mark per order and station (BR12.2)', () => {
    makeV1Database(db);
    upgradeSchema(db);
    const insert = db.prepare("INSERT INTO station_done (order_number, station, done_at) VALUES (7, ?, '2026-11-08T10:00:00.000Z')");
    insert.run('Grill');
    expect(() => insert.run('Grill')).toThrow(/UNIQUE|PRIMARY/);
    expect(() => insert.run('Bar')).not.toThrow();
  });
});

describe('a v1 database file started by the server', () => {
  const file = `test-results/v1-upgrade-${process.pid}.db`;

  afterEach(() => {
    resetDb();
    process.env.DB_FILE = ':memory:';
    for (const suffix of ['', '-wal', '-shm']) fs.rmSync(file + suffix, { force: true });
  });

  // Changed from "never re-seeded" (a U5 test, not a v1 test): the old file is still not re-seeded (no
  // row is added or removed) but its seed items now get the v2 details once (code review, Major).
  it('is upgraded with all its data, is not re-seeded, and its seed item gets the v2 details once', () => {
    fs.mkdirSync('test-results', { recursive: true });
    const v1 = new Database(file);
    makeV1Database(v1);
    v1.close();

    process.env.DB_FILE = file;
    resetDb();
    const db = getDb(); // start-up: upgrade and backfill run here
    seedIfEmpty(); // the file already has tables, so nothing is seeded

    expect(columns(db, 'items')).toContain('station');
    expect(count(db, 'tables')).toBe(1);
    expect(count(db, 'items')).toBe(1);
    expect(count(db, 'option_groups')).toBe(0); // Garlic Bread has no option groups in the seed
    expect(count(db, 'orders')).toBe(1);
    expect(db.prepare('SELECT allergens FROM items').get()).toEqual({ allergens: '["gluten","dairy"]' });
    expect(db.prepare('SELECT name FROM seed_backfill').all()).toEqual([{ name: 'v2-seed-details' }]);
  });
});

describe('seed (BR11.2, BR2.6)', () => {
  beforeEach(() => {
    resetDb();
    seedIfEmpty();
  });
  afterEach(() => {
    resetDb();
  });

  it('keeps v1 counts: 10 tables, 4 categories, 12 items', () => {
    const db = getDb();
    expect(count(db, 'tables')).toBe(10);
    expect(count(db, 'categories')).toBe(4);
    expect(count(db, 'items')).toBe(12);
  });

  it('seeding twice changes nothing', () => {
    seedIfEmpty();
    const db = getDb();
    expect(count(db, 'items')).toBe(12);
    expect(count(db, 'option_groups')).toBe(4);
  });

  it('gives every item a station from the fixed list, in the places the rules name', () => {
    const rows = getDb().prepare('SELECT name, station FROM items').all() as Array<{ name: string; station: string }>;
    const byName = Object.fromEntries(rows.map((r) => [r.name, r.station]));
    expect(rows.every((r) => ['Grill', 'Cold', 'Bar', 'Desserts'].includes(r.station))).toBe(true);
    expect(byName['House Salad']).toBe('Cold');
    expect(byName['Caesar Salad']).toBe('Cold');
    expect(byName['Garlic Bread']).toBe('Grill');
    expect(byName['Classic Burger']).toBe('Grill');
    expect(byName['Chocolate Fondant']).toBe('Desserts');
    expect(byName['Crème Brûlée']).toBe('Desserts');
    expect(byName['Sparkling Water']).toBe('Bar');
    expect(byName['House Coffee']).toBe('Bar');
  });

  it('sets allergens on every item except Grilled Salmon, which stays not set (NULL)', () => {
    const rows = getDb().prepare('SELECT name, allergens FROM items').all() as Array<{ name: string; allergens: string | null }>;
    const salmon = rows.find((r) => r.name === 'Grilled Salmon');
    expect(salmon?.allergens).toBeNull();
    expect(rows.filter((r) => r.allergens === null)).toHaveLength(1);
    // An empty list means "contains none", and is not NULL
    expect(rows.find((r) => r.name === 'Sparkling Water')?.allergens).toBe('[]');
  });

  it('adds option groups to Classic Burger and Margherita Pizza only', () => {
    const groups = getDb().prepare('SELECT item_id, name, kind, required FROM option_groups ORDER BY item_id, sort_order').all();
    // Size is choose-one but not required in the seed (see the DEVIATION note in db.ts: a required
    // group would break v1's burger and pizza orders, which carry no options).
    expect(groups).toEqual([
      { item_id: 'i-04', name: 'Size', kind: 'one', required: 0 },
      { item_id: 'i-04', name: 'Extras', kind: 'any', required: 0 },
      { item_id: 'i-04', name: 'Leave out', kind: 'leave_out', required: 0 },
      { item_id: 'i-06', name: 'Size', kind: 'one', required: 0 },
    ]);
  });
});

describe('the one-time backfill of the seed details for an old v1 database (code review, Major)', () => {
  let db: Database.Database;

  /** A seeded database turned back into what v1 left: defaults everywhere, no groups, no backfill record. */
  function makeOldV1Database(): Database.Database {
    resetDb();
    seedIfEmpty();
    const d = getDb();
    d.exec(`UPDATE items SET station = 'Grill', allergens = NULL;
            DELETE FROM option_choices; DELETE FROM option_groups; DELETE FROM seed_backfill;`);
    return d;
  }
  const items = () => db.prepare('SELECT id, name, station, allergens FROM items ORDER BY id').all() as Array<{ id: string; name: string; station: string; allergens: string | null }>;
  const groups = () => db.prepare('SELECT item_id, name FROM option_groups ORDER BY item_id, sort_order').all();

  beforeEach(() => {
    db = makeOldV1Database();
  });
  afterEach(() => {
    resetDb();
  });

  it('regression: an old v1 database gets the seed\'s stations, allergens and option groups, and keeps every row', () => {
    const before = { tables: count(db, 'tables'), categories: count(db, 'categories'), items: count(db, 'items') };
    upgradeSchema(db);

    const byName = Object.fromEntries(items().map((i) => [i.name, i]));
    expect(byName['House Salad'].station).toBe('Cold');
    expect(byName['Sparkling Water'].station).toBe('Bar');
    expect(byName['Crème Brûlée'].station).toBe('Desserts');
    expect(byName['Classic Burger'].allergens).toBe('["gluten","dairy","sesame"]');
    expect(byName['Sparkling Water'].allergens).toBe('[]');
    expect(byName['Grilled Salmon'].allergens).toBeNull(); // stays "not set"
    expect(groups()).toEqual([
      { item_id: 'i-04', name: 'Size' },
      { item_id: 'i-04', name: 'Extras' },
      { item_id: 'i-04', name: 'Leave out' },
      { item_id: 'i-06', name: 'Size' },
    ]);
    // Nothing added or removed
    expect({ tables: count(db, 'tables'), categories: count(db, 'categories'), items: count(db, 'items') }).toEqual(before);
    expect(db.prepare('SELECT name FROM seed_backfill').all()).toEqual([{ name: 'v2-seed-details' }]);
  });

  it('an item staff have edited is left alone, and nothing is removed', () => {
    db.prepare("UPDATE items SET station = 'Bar' WHERE id = 'i-02'").run(); // station edited
    db.prepare("UPDATE items SET allergens = '[\"soy\"]' WHERE id = 'i-03'").run(); // allergens edited
    db.prepare("UPDATE items SET name = 'Cheeseburger', station = 'Cold' WHERE id = 'i-04'").run(); // renamed: not the seed item any more
    db.prepare("INSERT INTO option_groups (id, item_id, name, kind, required, sort_order) VALUES ('mine', 'i-06', 'Crust', 'one', 1, 1)").run(); // staff made a group
    db.prepare("INSERT INTO items (id, category_id, name, price_cents) VALUES ('x-1', 'c-01', 'Garlic Bread', 100)").run(); // same name, not the seed id

    upgradeSchema(db);

    const byId = Object.fromEntries(items().map((i) => [i.id, i]));
    expect(byId['i-02'].station).toBe('Bar'); // not set back to Cold
    expect(byId['i-02'].allergens).toBe('[]'); // the other default field is still filled
    expect(byId['i-03'].allergens).toBe('["soy"]'); // not overwritten
    expect(byId['i-03'].station).toBe('Cold');
    expect(byId['i-04']).toMatchObject({ name: 'Cheeseburger', station: 'Cold', allergens: null }); // untouched, and gets no groups
    expect(byId['x-1']).toMatchObject({ station: 'Grill', allergens: null }); // right name, wrong id
    expect(groups()).toEqual([{ item_id: 'i-06', name: 'Crust' }]); // staff's group stays alone; no seed group added next to it
    expect(count(db, 'items')).toBe(13);
  });

  it('runs once: after it has run, a later upgrade does not fill in what staff cleared', () => {
    upgradeSchema(db);
    db.prepare("UPDATE items SET allergens = NULL WHERE id = 'i-02'").run(); // staff mark it "not set" again
    db.prepare("UPDATE items SET station = 'Grill' WHERE id = 'i-02'").run();
    db.prepare("DELETE FROM option_choices WHERE group_id IN (SELECT id FROM option_groups WHERE item_id = 'i-04')").run();
    db.prepare("DELETE FROM option_groups WHERE item_id = 'i-04'").run();

    upgradeSchema(db);

    expect(items().find((i) => i.id === 'i-02')).toMatchObject({ station: 'Grill', allergens: null });
    expect(groups()).toEqual([{ item_id: 'i-06', name: 'Size' }]);
  });

  it('running the upgrade twice changes nothing', () => {
    upgradeSchema(db);
    const snapshot = JSON.stringify([
      db.prepare('SELECT * FROM items ORDER BY id').all(),
      db.prepare('SELECT * FROM option_groups ORDER BY id').all(),
      db.prepare('SELECT * FROM option_choices ORDER BY id').all(),
      db.prepare('SELECT * FROM seed_backfill').all(),
    ]);
    upgradeSchema(db);
    upgradeSchema(db);
    expect(
      JSON.stringify([
        db.prepare('SELECT * FROM items ORDER BY id').all(),
        db.prepare('SELECT * FROM option_groups ORDER BY id').all(),
        db.prepare('SELECT * FROM option_choices ORDER BY id').all(),
        db.prepare('SELECT * FROM seed_backfill').all(),
      ])
    ).toBe(snapshot);
  });

  it('a freshly seeded database counts as done: the backfill is recorded and never runs on it', () => {
    resetDb();
    seedIfEmpty();
    db = getDb();
    expect(db.prepare('SELECT name FROM seed_backfill').all()).toEqual([{ name: 'v2-seed-details' }]);
    db.prepare("UPDATE items SET station = 'Grill', allergens = NULL WHERE id = 'i-10'").run();
    upgradeSchema(db);
    expect(items().find((i) => i.id === 'i-10')).toMatchObject({ station: 'Grill', allergens: null });
  });

  it('an empty database records nothing (the seed will), and the first seed still records it', () => {
    resetDb();
    db = getDb(); // upgrade on an empty file
    expect(count(db, 'seed_backfill')).toBe(0);
    expect(count(db, 'items')).toBe(0);
    seedIfEmpty();
    expect(count(db, 'seed_backfill')).toBe(1);
  });
});
