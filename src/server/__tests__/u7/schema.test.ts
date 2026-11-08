// U7 Step 3: U7 changes no table, column or seed; the schema it reads is U5's (contract 5).
process.env.DB_FILE = ':memory:';

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import { getDb } from '../../db.js';
import { cleanup, freshApp } from './setup.js';

const columns = (table: string) => (getDb().prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>).map((c) => c.name);

describe('the schema U7 reads is U5\'s (contract 5)', () => {
  beforeEach(freshApp);
  afterEach(cleanup);

  it('the tables and columns U7 reads exist', () => {
    expect(columns('station_done')).toEqual(['order_number', 'station', 'done_at']);
    expect(columns('items')).toEqual(expect.arrayContaining(['hidden', 'station', 'allergens']));
    expect(columns('categories')).toEqual(expect.arrayContaining(['hidden', 'sort_order']));
    expect(columns('orders')).toEqual(expect.arrayContaining(['completed_at']));
    expect(columns('service_calls')).toEqual(['id', 'visit_id', 'table_id', 'kind', 'opened_at', 'responded_at']);
    expect(columns('dish_ratings')).toEqual(expect.arrayContaining(['visit_id', 'item_id', 'thumb', 'rated_at']));
    expect(columns('option_groups')).toEqual(['id', 'item_id', 'name', 'kind', 'required', 'sort_order']);
  });

  it('the seed is v1\'s: 10 tables, 4 categories, 12 items', () => {
    const count = (t: string) => (getDb().prepare(`SELECT COUNT(*) AS n FROM ${t}`).get() as { n: number }).n;
    expect([count('tables'), count('categories'), count('items')]).toEqual([10, 4, 12]);
  });

  it('U7\'s code never changes the schema: none of its server files creates or alters a table', () => {
    const files = [
      'src/server/routes/staff-stations.ts', 'src/server/routes/staff-menu.ts', 'src/server/routes/staff-floor.ts', 'src/server/routes/staff-sales.ts',
      ...fs.readdirSync('src/server/routes/u7').map((f) => `src/server/routes/u7/${f}`),
    ];
    for (const f of files) expect(fs.readFileSync(f, 'utf8'), f).not.toMatch(/CREATE TABLE|ALTER TABLE|DROP TABLE/i);
  });
});
