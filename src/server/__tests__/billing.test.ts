import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Runs before any import below is evaluated, so this file always gets its own in-memory database.
vi.hoisted(() => {
  process.env.DB_FILE = ':memory:';
});

import { getDb, resetDb, seedIfEmpty } from '../db.js';
import { placeOrder, transitionOrder, getOrOpenVisit } from '../repositories/orderRepo.js';
import { buildBill, closeTable, BillingError } from '../repositories/billingRepo.js';

function place(tableId: number, key: string, lines: Array<{ menu_item_id: string; quantity: number }>): number {
  const visitId = getOrOpenVisit(tableId);
  const result = placeOrder(tableId, visitId, key, lines);
  expect(result.isDuplicate, `order ${key} on table ${tableId} was a duplicate`).toBeUndefined();
  expect(result.status).toBe('Pending');
  expect(typeof result.order_number).toBe('number');
  return result.order_number;
}

function complete(n: number) {
  expect(transitionOrder(n, 'Preparing', 'staff').status).toBe('Preparing');
  expect(transitionOrder(n, 'Completed', 'staff').status).toBe('Completed');
}

function codeOf(fn: () => unknown): string | undefined {
  try {
    fn();
  } catch (e) {
    return (e as BillingError).code;
  }
  return undefined;
}

describe('billing rules', () => {
  beforeEach(() => {
    resetDb();
    seedIfEmpty();
  });
  afterEach(() => {
    resetDb();
  });

  describe('buildBill', () => {
    it('lists orders in placement order with line and order subtotals and one combined total', () => {
      const a = place(1, 'a', [{ menu_item_id: 'i-04', quantity: 2 }, { menu_item_id: 'i-10', quantity: 1 }]);
      const b = place(1, 'b', [{ menu_item_id: 'i-06', quantity: 1 }]);
      const bill = buildBill(1);
      expect(bill.orders.map((o) => o.order_number)).toEqual([a, b]);
      expect(bill.orders[0].lines[0].subtotal_cents).toBe(2900);
      expect(bill.orders[0].subtotal_cents).toBe(3250);
      expect(bill.orders[1].subtotal_cents).toBe(1350);
      expect(bill.combined_total_cents).toBe(4600);
    });

    it('leaves Cancelled orders out of the list, the subtotals and the total', () => {
      const a = place(1, 'a', [{ menu_item_id: 'i-04', quantity: 1 }]);
      const b = place(1, 'b', [{ menu_item_id: 'i-10', quantity: 2 }]);
      transitionOrder(b, 'Cancelled', 'staff');
      const bill = buildBill(1);
      expect(bill.orders.map((o) => o.order_number)).toEqual([a]);
      expect(bill.combined_total_cents).toBe(1450);
      expect(bill.blocking_orders).toEqual([a]);
    });

    it('uses the stored order-line price, not the current menu price', () => {
      place(1, 'a', [{ menu_item_id: 'i-04', quantity: 1 }]);
      getDb().prepare('UPDATE items SET price_cents = 9999 WHERE id = ?').run('i-04');
      const bill = buildBill(1);
      expect(bill.orders[0].lines[0].price_cents_each).toBe(1450);
      expect(bill.combined_total_cents).toBe(1450);
    });

    it('carries the menu item emoji on each line', () => {
      place(1, 'a', [{ menu_item_id: 'i-04', quantity: 1 }]);
      expect(buildBill(1).orders[0].lines[0].image).toBe('🍔');
    });

    it('close_available is false with a Pending or a Preparing order and lists them', () => {
      const a = place(1, 'a', [{ menu_item_id: 'i-04', quantity: 1 }]);
      const b = place(1, 'b', [{ menu_item_id: 'i-10', quantity: 1 }]);
      transitionOrder(b, 'Preparing', 'staff');
      const bill = buildBill(1);
      expect(bill.close_available).toBe(false);
      expect(bill.blocking_orders).toEqual([a, b]);
    });

    it('close_available is true when every order is Completed or Cancelled', () => {
      const a = place(1, 'a', [{ menu_item_id: 'i-04', quantity: 1 }]);
      const b = place(1, 'b', [{ menu_item_id: 'i-10', quantity: 1 }]);
      complete(a);
      transitionOrder(b, 'Cancelled', 'staff');
      const bill = buildBill(1);
      expect(bill.close_available).toBe(true);
      expect(bill.blocking_orders).toEqual([]);
    });

    it('a visit whose only orders are Cancelled has an empty bill at $0 and can still be closed', () => {
      const a = place(1, 'a', [{ menu_item_id: 'i-04', quantity: 1 }]);
      transitionOrder(a, 'Cancelled', 'staff');
      const bill = buildBill(1);
      expect(bill.orders).toEqual([]);
      expect(bill.combined_total_cents).toBe(0);
      expect(bill.close_available).toBe(true);
      expect(closeTable(1).closed).toBe(true);
    });

    it('a table with no open visit has an empty bill and close_available false', () => {
      const bill = buildBill(2);
      expect(bill).toEqual({ table_id: 2, orders: [], combined_total_cents: 0, close_available: false, blocking_orders: [] });
    });

    it('an unknown table throws UNKNOWN_TABLE', () => {
      expect(codeOf(() => buildBill(99))).toBe('UNKNOWN_TABLE');
    });
  });

  describe('closeTable', () => {
    it('refuses CLOSE_BLOCKED with the open order numbers', () => {
      const a = place(1, 'a', [{ menu_item_id: 'i-04', quantity: 1 }]);
      try {
        closeTable(1);
        throw new Error('should have thrown');
      } catch (e) {
        expect((e as BillingError).code).toBe('CLOSE_BLOCKED');
        expect((e as BillingError).details?.blocking_orders).toEqual([a]);
      }
    });

    it('refuses TABLE_EMPTY for a table that was never used', () => {
      expect(codeOf(() => closeTable(3))).toBe('TABLE_EMPTY');
    });

    it('refuses TABLE_EMPTY for an open visit with no order in it', () => {
      getOrOpenVisit(3);
      expect(codeOf(() => closeTable(3))).toBe('TABLE_EMPTY');
    });

    it('refuses TABLE_ALREADY_CLOSED for a table closed before', () => {
      complete(place(1, 'a', [{ menu_item_id: 'i-04', quantity: 1 }]));
      closeTable(1);
      expect(codeOf(() => closeTable(1))).toBe('TABLE_ALREADY_CLOSED');
    });

    it('refuses UNKNOWN_TABLE for a table that does not exist', () => {
      expect(codeOf(() => closeTable(99))).toBe('UNKNOWN_TABLE');
    });

    it('archives the visit and returns its id on success', () => {
      const visitId = getOrOpenVisit(1);
      const n = placeOrder(1, visitId, 'a', [{ menu_item_id: 'i-04', quantity: 1 }]).order_number;
      complete(n);
      const result = closeTable(1);
      expect(result).toEqual({ closed: true, archived_visit_id: visitId });
      expect(buildBill(1).orders).toEqual([]);
    });
  });
});
