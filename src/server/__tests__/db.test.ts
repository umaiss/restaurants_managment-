// Set DB_FILE before any module that uses it is loaded
process.env.DB_FILE = ':memory:';

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getDb, resetDb, seedIfEmpty, openVisit, getCurrentVisit, nextOrderNumber } from '../db.js';

describe('db schema and seed', () => {
  beforeEach(() => {
    resetDb();
  });

  afterEach(() => {
    resetDb();
  });

  it('seedIfEmpty creates 10 tables, 4 categories, 12 items', () => {
    seedIfEmpty();
    const db = getDb();
    const tables = (db.prepare('SELECT COUNT(*) as cnt FROM tables').get() as { cnt: number }).cnt;
    const categories = (db.prepare('SELECT COUNT(*) as cnt FROM categories').get() as { cnt: number }).cnt;
    const items = (db.prepare('SELECT COUNT(*) as cnt FROM items').get() as { cnt: number }).cnt;
    expect(tables).toBe(10);
    expect(categories).toBe(4);
    expect(items).toBe(12);
  });

  it('seedIfEmpty is idempotent — calling twice keeps counts the same', () => {
    seedIfEmpty();
    seedIfEmpty();
    const db = getDb();
    const tables = (db.prepare('SELECT COUNT(*) as cnt FROM tables').get() as { cnt: number }).cnt;
    const items = (db.prepare('SELECT COUNT(*) as cnt FROM items').get() as { cnt: number }).cnt;
    expect(tables).toBe(10);
    expect(items).toBe(12);
  });

  it('openVisit creates a visit row with the correct table_id', () => {
    seedIfEmpty();
    const visitId = openVisit(3);
    const db = getDb();
    const row = db.prepare('SELECT * FROM visits WHERE id = ?').get(visitId) as { table_id: number } | undefined;
    expect(row).toBeDefined();
    expect(row!.table_id).toBe(3);
  });

  it('getCurrentVisit returns the open visit; null when none', () => {
    seedIfEmpty();
    // No visit yet
    expect(getCurrentVisit(1)).toBeNull();
    // Open a visit
    const visitId = openVisit(1);
    const result = getCurrentVisit(1);
    expect(result).not.toBeNull();
    expect(result!.id).toBe(visitId);
    expect(result!.tableId).toBe(1);
  });

  it('schema enforces UNIQUE constraint on (table_id, visit_id, placement_key)', () => {
    seedIfEmpty();
    const visitId = openVisit(1);
    const db = getDb();
    const orderNum = nextOrderNumber();
    db.prepare(
      'INSERT INTO orders (order_number, visit_id, table_id, placement_key) VALUES (?, ?, ?, ?)'
    ).run(orderNum, visitId, 1, 'key-abc');

    expect(() => {
      const orderNum2 = nextOrderNumber();
      db.prepare(
        'INSERT INTO orders (order_number, visit_id, table_id, placement_key) VALUES (?, ?, ?, ?)'
      ).run(orderNum2, visitId, 1, 'key-abc');
    }).toThrow();
  });

  it('same placement_key on different table is allowed (different scope)', () => {
    seedIfEmpty();
    const visit1 = openVisit(1);
    const visit2 = openVisit(2);
    const db = getDb();
    db.prepare(
      'INSERT INTO orders (order_number, visit_id, table_id, placement_key) VALUES (?, ?, ?, ?)'
    ).run(nextOrderNumber(), visit1, 1, 'key-xyz');
    // Should not throw — different table_id
    expect(() => {
      db.prepare(
        'INSERT INTO orders (order_number, visit_id, table_id, placement_key) VALUES (?, ?, ?, ?)'
      ).run(nextOrderNumber(), visit2, 2, 'key-xyz');
    }).not.toThrow();
  });
});
