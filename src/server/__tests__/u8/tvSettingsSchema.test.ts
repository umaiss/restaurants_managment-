// U8 Step 4: the 'tv-settings' upgrade step (BR1.1, BR1.4, plan R-01).
process.env.DB_FILE = ':memory:';

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { getDb, initSchema, resetDb, seedIfEmpty, upgradeSchema } from '../../db.js';

const tableNames = (db: Database.Database) =>
  (db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all() as Array<{ name: string }>).map((r) => r.name);
const indexOn = (db: Database.Database, name: string) =>
  db.prepare("SELECT tbl_name, sql FROM sqlite_master WHERE type = 'index' AND name = ?").get(name) as { tbl_name: string; sql: string } | undefined;
const count = (db: Database.Database, table: string) => (db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get() as { n: number }).n;
const dump = (db: Database.Database) =>
  JSON.stringify(['tables', 'categories', 'items', 'visits', 'orders', 'order_items', 'service_calls', 'option_groups'].map((t) => db.prepare(`SELECT * FROM ${t} ORDER BY rowid`).all()));

describe("the 'tv-settings' upgrade step (BR1.4)", () => {
  let db: Database.Database;
  beforeEach(() => {
    db = new Database(':memory:');
    db.pragma('foreign_keys = ON');
  });
  afterEach(() => {
    db.close();
    resetDb();
  });

  it('a fresh database has the tv_settings table, both indexes, and no setting row (so takings read as hidden)', () => {
    initSchema(db);
    upgradeSchema(db);
    expect(tableNames(db)).toContain('tv_settings');
    const cols = db.prepare('PRAGMA table_info(tv_settings)').all() as Array<{ name: string; type: string; notnull: number; dflt_value: string | null; pk: number }>;
    expect(cols.map((c) => [c.name, c.type, c.notnull, c.pk])).toEqual([
      ['key', 'TEXT', 0, 1],
      ['value', 'INTEGER', 1, 0],
      ['updated_at', 'TEXT', 0, 0],
    ]);
    expect(cols.find((c) => c.name === 'value')!.dflt_value).toBe('0');
    expect(indexOn(db, 'visits_closed_at')).toMatchObject({ tbl_name: 'visits' });
    expect(indexOn(db, 'visits_closed_at')!.sql).toContain('closed_at');
    expect(indexOn(db, 'orders_placed_at')).toMatchObject({ tbl_name: 'orders' });
    expect(indexOn(db, 'orders_placed_at')!.sql).toContain('placed_at');
    expect(count(db, 'tv_settings')).toBe(0);
  });

  it('an existing v2 database (made before U8) upgrades with every row unchanged, and the seed still loads', () => {
    // A v2 database as it was before U8: the full v2 schema without the new table and indexes, with data in it.
    resetDb();
    seedIfEmpty();
    const v2 = getDb();
    v2.exec('DROP TABLE tv_settings; DROP INDEX visits_closed_at; DROP INDEX orders_placed_at;');
    v2.prepare("INSERT INTO visits (id, table_id, opened_at, closed_at) VALUES ('v-old', 3, '2026-11-01 10:00:00', '2026-11-01 11:00:00')").run();
    v2.prepare("INSERT INTO orders (order_number, visit_id, table_id, status, placement_key, placed_at) VALUES (900, 'v-old', 3, 'Completed', 'k', '2026-11-01 10:05:00')").run();
    v2.prepare("INSERT INTO order_items (order_id, item_id, quantity, unit_price_cents) VALUES (last_insert_rowid(), 'i-04', 2, 1450)").run();
    v2.prepare("INSERT INTO service_calls (id, visit_id, table_id, kind, opened_at) VALUES ('c-old', 'v-old', 3, 'bill', '2026-11-01T10:30:00.000Z')").run();
    expect(tableNames(v2)).not.toContain('tv_settings');
    const before = dump(v2);

    upgradeSchema(v2);

    expect(dump(v2)).toBe(before);
    expect(tableNames(v2)).toContain('tv_settings');
    expect(count(v2, 'tv_settings')).toBe(0);
    expect(indexOn(v2, 'visits_closed_at')).toBeDefined();
    expect(indexOn(v2, 'orders_placed_at')).toBeDefined();
    // v1's seed counts are still what they were
    expect([count(v2, 'tables'), count(v2, 'categories'), count(v2, 'items')]).toEqual([10, 4, 12]);
  });

  it('running the upgrade twice changes nothing: same schema, same rows, still no setting row', () => {
    initSchema(db);
    upgradeSchema(db);
    db.prepare("INSERT INTO tv_settings (key, value, updated_at) VALUES ('show_takings', 1, '2026-11-10T09:00:00.000Z')").run();
    const schema = JSON.stringify(db.prepare('SELECT type, name, sql FROM sqlite_master ORDER BY type, name').all());
    const rows = JSON.stringify(db.prepare('SELECT * FROM tv_settings').all());

    upgradeSchema(db);
    upgradeSchema(db);

    expect(JSON.stringify(db.prepare('SELECT type, name, sql FROM sqlite_master ORDER BY type, name').all())).toBe(schema);
    expect(JSON.stringify(db.prepare('SELECT * FROM tv_settings').all())).toBe(rows); // a saved setting survives
  });
});
