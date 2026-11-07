import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Runs before any import below is evaluated, so this file always gets its own in-memory database.
vi.hoisted(() => {
  process.env.DB_FILE = ':memory:';
});

import request from 'supertest';
import { app } from '../index.js';
import { getDb, resetDb, seedIfEmpty } from '../db.js';
import { getTableStatus, closeCurrentVisit } from '../repositories/tableRepo.js';
import { getOrOpenVisit, placeOrder } from '../repositories/orderRepo.js';

function openVisitWithOrder(tableId: number, key: string): string {
  const visitId = getOrOpenVisit(tableId);
  placeOrder(tableId, visitId, key, [{ menu_item_id: 'i-04', quantity: 1 }]);
  return visitId;
}

describe('table status: last_closed_visit_id', () => {
  beforeEach(() => {
    resetDb();
    seedIfEmpty();
  });
  afterEach(() => {
    resetDb();
  });

  it('is null for a table that was never closed, and every existing field is still there', () => {
    const status = getTableStatus(1);
    expect(status).toEqual({
      id: 1,
      visit_id: null,
      has_open_orders: false,
      has_any_orders: false,
      state: 'closed',
      last_closed_visit_id: null,
    });
  });

  it('is null while the first visit is still open', () => {
    const visitId = openVisitWithOrder(1, 'a');
    const status = getTableStatus(1);
    expect(status.visit_id).toBe(visitId);
    expect(status.state).toBe('active');
    expect(status.last_closed_visit_id).toBeNull();
  });

  it('is the id of the visit that was just closed', () => {
    const visitId = openVisitWithOrder(2, 'a');
    closeCurrentVisit(2);
    expect(getTableStatus(2).last_closed_visit_id).toBe(visitId);
  });

  it('is the newest closed visit after several closes, even when they close in the same second', () => {
    openVisitWithOrder(3, 'a');
    closeCurrentVisit(3);
    const second = openVisitWithOrder(3, 'b');
    closeCurrentVisit(3);
    expect(getTableStatus(3).last_closed_visit_id).toBe(second);
    // A new, still open visit does not change it.
    openVisitWithOrder(3, 'c');
    expect(getTableStatus(3).last_closed_visit_id).toBe(second);
  });

  it("is per table: closing one table does not change another's value", () => {
    openVisitWithOrder(4, 'a');
    openVisitWithOrder(5, 'a');
    closeCurrentVisit(4);
    expect(getTableStatus(5).last_closed_visit_id).toBeNull();
    expect(getDb().prepare('SELECT COUNT(*) AS n FROM visits WHERE closed_at IS NOT NULL').get()).toEqual({ n: 1 });
  });

  it('GET /api/tables/:id carries the field next to the existing ones', async () => {
    const before = await request(app).get('/api/tables/6');
    expect(before.status).toBe(200);
    expect(before.body).toMatchObject({ id: 6, visit_id: null, state: 'closed', last_closed_visit_id: null });

    const visitId = openVisitWithOrder(6, 'a');
    closeCurrentVisit(6);
    const after = await request(app).get('/api/tables/6');
    expect(after.body.last_closed_visit_id).toBe(visitId);
    expect(after.body).toHaveProperty('has_open_orders');
    expect(after.body).toHaveProperty('has_any_orders');
  });
});
