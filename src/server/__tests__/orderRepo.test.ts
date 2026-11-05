process.env.DB_FILE = ':memory:';

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getDb, resetDb, seedIfEmpty, openVisit } from '../db.js';
import { placeOrder, transitionOrder } from '../repositories/orderRepo.js';

describe('orderRepo', () => {
  beforeEach(() => {
    resetDb();
    seedIfEmpty();
  });

  afterEach(() => {
    resetDb();
  });

  it('placeOrder creates an order and returns order_number with empty dropped_lines', () => {
    const visitId = openVisit(1);
    const result = placeOrder(1, visitId, 'key-001', [{ menu_item_id: 'i-01', quantity: 2 }]);
    expect(result.order_number).toBeGreaterThan(0);
    expect(result.status).toBe('Pending');
    expect(result.dropped_lines).toHaveLength(0);
    expect(result.lines).toHaveLength(1);
    expect(result.lines[0].menu_item_id).toBe('i-01');
    expect(result.lines[0].quantity).toBe(2);
  });

  it('placeOrder with same placement_key on same table returns same order_number (idempotent)', () => {
    const visitId = openVisit(1);
    const result1 = placeOrder(1, visitId, 'key-idem', [{ menu_item_id: 'i-01', quantity: 1 }]);
    const result2 = placeOrder(1, visitId, 'key-idem', [{ menu_item_id: 'i-01', quantity: 1 }]);
    expect(result2.order_number).toBe(result1.order_number);
  });

  it('placeOrder with same placement_key on different table creates a NEW order', () => {
    const visitId1 = openVisit(1);
    const visitId2 = openVisit(2);
    const result1 = placeOrder(1, visitId1, 'key-shared', [{ menu_item_id: 'i-01', quantity: 1 }]);
    const result2 = placeOrder(2, visitId2, 'key-shared', [{ menu_item_id: 'i-01', quantity: 1 }]);
    expect(result2.order_number).not.toBe(result1.order_number);
  });

  it('placeOrder drops lines for unavailable items and lists them in dropped_lines', () => {
    getDb().prepare('UPDATE items SET available = 0 WHERE id = ?').run('i-02');
    const visitId = openVisit(1);
    const result = placeOrder(1, visitId, 'key-drop', [
      { menu_item_id: 'i-01', quantity: 1 },
      { menu_item_id: 'i-02', quantity: 1 },
    ]);
    expect(result.lines).toHaveLength(1);
    expect(result.lines[0].menu_item_id).toBe('i-01');
    expect(result.dropped_lines).toHaveLength(1);
    expect(result.dropped_lines[0].menu_item_id).toBe('i-02');
    expect(result.dropped_lines[0].reason).toBe('SOLD_OUT_AT_SUBMIT');
  });

  it('transitionOrder Pending→Preparing by staff succeeds', () => {
    const visitId = openVisit(1);
    const order = placeOrder(1, visitId, 'key-t1', [{ menu_item_id: 'i-01', quantity: 1 }]);
    const result = transitionOrder(order.order_number, 'Preparing', 'staff');
    expect(result.status).toBe('Preparing');
  });

  it('transitionOrder Preparing→Completed by staff succeeds', () => {
    const visitId = openVisit(1);
    const order = placeOrder(1, visitId, 'key-t2', [{ menu_item_id: 'i-01', quantity: 1 }]);
    transitionOrder(order.order_number, 'Preparing', 'staff');
    const result = transitionOrder(order.order_number, 'Completed', 'staff');
    expect(result.status).toBe('Completed');
  });

  it('transitionOrder Pending→Completed by staff throws ILLEGAL_TRANSITION', () => {
    const visitId = openVisit(1);
    const order = placeOrder(1, visitId, 'key-t3', [{ menu_item_id: 'i-01', quantity: 1 }]);
    expect(() => transitionOrder(order.order_number, 'Completed', 'staff')).toThrow(/ILLEGAL_TRANSITION/);
  });

  it('transitionOrder with by=diner on Preparing→Completed throws', () => {
    const visitId = openVisit(1);
    const order = placeOrder(1, visitId, 'key-t4', [{ menu_item_id: 'i-01', quantity: 1 }]);
    transitionOrder(order.order_number, 'Preparing', 'staff');
    // Diner trying to complete — ILLEGAL_TRANSITION (diner has no allowed transitions from Preparing)
    expect(() => transitionOrder(order.order_number, 'Completed', 'diner')).toThrow();
  });

  it('transitionOrder Pending→Cancelled by diner succeeds', () => {
    const visitId = openVisit(1);
    const order = placeOrder(1, visitId, 'key-t5', [{ menu_item_id: 'i-01', quantity: 1 }]);
    const result = transitionOrder(order.order_number, 'Cancelled', 'diner');
    expect(result.status).toBe('Cancelled');
  });

  it('transitionOrder with unknown by value throws INVALID_ACTOR', () => {
    const visitId = openVisit(1);
    const order = placeOrder(1, visitId, 'key-t6', [{ menu_item_id: 'i-01', quantity: 1 }]);
    expect(() => transitionOrder(order.order_number, 'Preparing', 'manager')).toThrow(/INVALID_ACTOR/);
  });
});
