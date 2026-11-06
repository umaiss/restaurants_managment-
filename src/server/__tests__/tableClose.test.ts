import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Runs before any import below is evaluated, so this file always gets its own in-memory database.
vi.hoisted(() => {
  process.env.DB_FILE = ':memory:';
});

import { getDb, resetDb, seedIfEmpty, getCurrentVisit } from '../db.js';
import { placeOrder, getOrOpenVisit, getOrdersByVisit } from '../repositories/orderRepo.js';
import { closeCurrentVisit, hasClosedVisit, getTableStatus } from '../repositories/tableRepo.js';

describe('closing a visit (tableRepo)', () => {
  beforeEach(() => {
    resetDb();
    seedIfEmpty();
  });
  afterEach(() => {
    resetDb();
  });

  function order(tableId: number, key: string) {
    const visitId = getOrOpenVisit(tableId);
    const result = placeOrder(tableId, visitId, key, [{ menu_item_id: 'i-04', quantity: 1 }]);
    expect(result.isDuplicate, `order ${key} on table ${tableId} was a duplicate`).toBeUndefined();
    expect(result.status).toBe('Pending');
    return visitId;
  }

  it('closeCurrentVisit returns the open visit id and sets closed_at', () => {
    const visitId = order(1, 'k1');
    expect(closeCurrentVisit(1)).toBe(visitId);
    const row = getDb().prepare('SELECT closed_at FROM visits WHERE id = ?').get(visitId) as { closed_at: string | null };
    expect(row.closed_at).not.toBeNull();
  });

  it('closeCurrentVisit returns null when no visit is open', () => {
    expect(closeCurrentVisit(2)).toBeNull();
  });

  it('closing twice returns null the second time', () => {
    order(1, 'k1');
    expect(closeCurrentVisit(1)).not.toBeNull();
    expect(closeCurrentVisit(1)).toBeNull();
  });

  it('hasClosedVisit is false for a never-used table and true after a close', () => {
    expect(hasClosedVisit(3)).toBe(false);
    order(3, 'k3');
    expect(hasClosedVisit(3)).toBe(false);
    closeCurrentVisit(3);
    expect(hasClosedVisit(3)).toBe(true);
  });

  it('after a close the table reports closed with no visit', () => {
    order(4, 'k4');
    closeCurrentVisit(4);
    const status = getTableStatus(4);
    expect(status.state).toBe('closed');
    expect(status.visit_id).toBeNull();
  });

  it('after a close a new order opens a different visit that does not hold the old orders', () => {
    const oldVisit = order(5, 'k5');
    closeCurrentVisit(5);
    const newVisit = order(5, 'k5-again');
    expect(newVisit).not.toBe(oldVisit);
    expect(getCurrentVisit(5)?.id).toBe(newVisit);
    expect(getOrdersByVisit(newVisit)).toHaveLength(1);
  });

  it('the orders of the archived visit stay in the database', () => {
    const oldVisit = order(6, 'k6');
    closeCurrentVisit(6);
    expect(getOrdersByVisit(oldVisit)).toHaveLength(1);
  });
});
