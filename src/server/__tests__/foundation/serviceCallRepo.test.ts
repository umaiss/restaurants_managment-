// U5 Step 6: service calls (BR6.1, BR6.2, BR6.3).
process.env.DB_FILE = ':memory:';

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getDb, resetDb, seedIfEmpty, openVisit } from '../../db.js';
import { openCall, respondCall, listCalls, clearOpenCalls } from '../../repositories/serviceCallRepo.js';
import { placeOrder, transitionOrder } from '../../repositories/orderRepo.js';
import { closeTable } from '../../repositories/billingRepo.js';

describe('serviceCallRepo', () => {
  beforeEach(() => {
    resetDb();
    seedIfEmpty();
  });
  afterEach(() => {
    resetDb();
  });

  it('opens a request for a table with an open visit', () => {
    openVisit(1);
    const { call, created } = openCall(1, 'waiter');
    expect(created).toBe(true);
    expect(call).toMatchObject({ table_id: 1, kind: 'waiter', status: 'open', responded_at: null });
    expect(call.id).toBeTruthy();
  });

  it('refuses with NO_OPEN_VISIT when the table has no open visit, and UNKNOWN_TABLE for a table that does not exist', () => {
    expect(() => openCall(1, 'bill')).toThrowError(expect.objectContaining({ code: 'NO_OPEN_VISIT' }));
    expect(() => openCall(99, 'bill')).toThrowError(expect.objectContaining({ code: 'UNKNOWN_TABLE' }));
  });

  it('a second press of the same kind returns the same open request; another kind is a new one (BR6.1)', () => {
    openVisit(1);
    const first = openCall(1, 'waiter');
    const again = openCall(1, 'waiter');
    expect(again.created).toBe(false);
    expect(again.call.id).toBe(first.call.id);
    const bill = openCall(1, 'bill');
    expect(bill.created).toBe(true);
    expect(bill.call.id).not.toBe(first.call.id);
    expect(listCalls(1)).toHaveLength(2);
  });

  it('after staff respond, the diner can raise a new request of that kind (BR6.2)', () => {
    openVisit(1);
    const first = openCall(1, 'waiter').call;
    const { call, changed } = respondCall(first.id);
    expect(changed).toBe(true);
    expect(call).toMatchObject({ status: 'responded' });
    expect(call.responded_at).not.toBeNull();

    const next = openCall(1, 'waiter');
    expect(next.created).toBe(true);
    expect(next.call.id).not.toBe(first.id);
  });

  it('a second respond answers the same call unchanged; an unknown id is UNKNOWN_CALL', () => {
    openVisit(1);
    const id = openCall(1, 'waiter').call.id;
    const first = respondCall(id);
    const second = respondCall(id);
    expect(second.changed).toBe(false);
    expect(second.call.responded_at).toBe(first.call.responded_at);
    expect(() => respondCall('nope')).toThrowError(expect.objectContaining({ code: 'UNKNOWN_CALL' }));
  });

  it('a lost race (the unique index refuses the insert) answers with the existing request, not an error', () => {
    const visit = openVisit(1);
    // Another press got in between our check and our insert: simulate by inserting the row ourselves
    // and calling with the same kind; the check finds it, and the index is the second line of defence.
    getDb()
      .prepare("INSERT INTO service_calls (id, visit_id, table_id, kind, opened_at) VALUES ('winner', ?, 1, 'bill', '2026-11-08T10:00:00.000Z')")
      .run(visit);
    const r = openCall(1, 'bill');
    expect(r.created).toBe(false);
    expect(r.call.id).toBe('winner');
  });

  it('lists the current visit\'s requests, open and answered, oldest first; no visit means none', () => {
    expect(listCalls(2)).toEqual([]);
    openVisit(2);
    const a = openCall(2, 'waiter', new Date('2026-11-08T10:00:00.000Z')).call;
    openCall(2, 'bill', new Date('2026-11-08T10:01:00.000Z'));
    respondCall(a.id);
    expect(listCalls(2).map((c) => [c.kind, c.status])).toEqual([
      ['waiter', 'responded'],
      ['bill', 'open'],
    ]);
    expect(() => listCalls(99)).toThrowError(expect.objectContaining({ code: 'UNKNOWN_TABLE' }));
  });

  it('closing the table clears its open requests in the same step (BR6.3)', () => {
    const visit = openVisit(1);
    const order = placeOrder(1, visit, 'k-1', [{ menu_item_id: 'i-01', quantity: 1 }]);
    transitionOrder(order.order_number, 'Preparing', 'staff');
    transitionOrder(order.order_number, 'Completed', 'staff');
    openCall(1, 'waiter');
    openCall(1, 'bill');

    closeTable(1);

    const rows = getDb().prepare('SELECT kind, responded_at FROM service_calls WHERE visit_id = ?').all(visit) as Array<{
      kind: string;
      responded_at: string | null;
    }>;
    expect(rows).toHaveLength(2);
    expect(rows.every((r) => r.responded_at !== null)).toBe(true);
    // The next visit starts clean
    expect(listCalls(1)).toEqual([]);
  });

  it('a close that is refused (open orders) leaves the requests open', () => {
    const visit = openVisit(1);
    placeOrder(1, visit, 'k-1', [{ menu_item_id: 'i-01', quantity: 1 }]);
    openCall(1, 'waiter');
    expect(() => closeTable(1)).toThrow(/CLOSE_BLOCKED/);
    expect(listCalls(1)[0].status).toBe('open');
  });

  it('clearOpenCalls reports how many it cleared', () => {
    const visit = openVisit(1);
    openCall(1, 'waiter');
    openCall(1, 'bill');
    expect(clearOpenCalls(visit)).toBe(2);
    expect(clearOpenCalls(visit)).toBe(0);
  });
});
