// U5 Step 8: the one function that changes an order's status (BR3.6, BR3.8).
process.env.DB_FILE = ':memory:';

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getDb, resetDb, seedIfEmpty, openVisit } from '../../db.js';
import { placeOrder, transitionOrder, type Actor, type OrderStatus } from '../../repositories/orderRepo.js';

const STATUSES: OrderStatus[] = ['Pending', 'Preparing', 'Completed', 'Cancelled'];
const ACTORS: Actor[] = ['staff', 'diner', 'station'];

/** The rules, written out independently of the implementation: every legal move per actor. */
const LEGAL: Record<Actor, Array<[OrderStatus, OrderStatus]>> = {
  staff: [
    ['Pending', 'Preparing'],
    ['Pending', 'Cancelled'],
    ['Preparing', 'Completed'],
    ['Preparing', 'Cancelled'],
  ],
  diner: [['Pending', 'Cancelled']],
  station: [
    ['Pending', 'Preparing'],
    ['Preparing', 'Completed'],
  ],
};

let n = 0;
function orderInStatus(status: OrderStatus): number {
  const visit = openVisit(1 + (n % 10));
  const order = placeOrder(1 + (n % 10), visit, `k-${n++}`, [{ menu_item_id: 'i-01', quantity: 1 }]);
  getDb().prepare('UPDATE orders SET status = ? WHERE order_number = ?').run(status, order.order_number);
  return order.order_number;
}
const row = (orderNumber: number) =>
  getDb().prepare('SELECT status, completed_at FROM orders WHERE order_number = ?').get(orderNumber) as {
    status: string;
    completed_at: string | null;
  };

describe('transitionOrder (BR3.8)', () => {
  beforeEach(() => {
    resetDb();
    seedIfEmpty();
    n = 0;
  });
  afterEach(() => {
    resetDb();
  });

  const cases: Array<[Actor, OrderStatus, OrderStatus, boolean]> = [];
  for (const actor of ACTORS) {
    for (const from of STATUSES) {
      for (const to of STATUSES) {
        cases.push([actor, from, to, LEGAL[actor].some(([f, t]) => f === from && t === to)]);
      }
    }
  }

  it.each(cases)('%s: %s to %s is %s', (actor, from, to, legal) => {
    const number = orderInStatus(from);
    if (legal) {
      expect(transitionOrder(number, to, actor).status).toBe(to);
      expect(row(number).status).toBe(to);
    } else {
      expect(() => transitionOrder(number, to, actor)).toThrow(/ILLEGAL_TRANSITION/);
      expect(row(number).status).toBe(from); // nothing changed
    }
  });

  it('the station actor can never cancel', () => {
    for (const from of ['Pending', 'Preparing'] as OrderStatus[]) {
      expect(() => transitionOrder(orderInStatus(from), 'Cancelled', 'station')).toThrow(/ILLEGAL_TRANSITION/);
    }
  });

  it('an unknown actor is INVALID_ACTOR, an unknown order is UNKNOWN_ORDER', () => {
    const number = orderInStatus('Pending');
    expect(() => transitionOrder(number, 'Preparing', 'manager')).toThrowError(expect.objectContaining({ code: 'INVALID_ACTOR' }));
    expect(() => transitionOrder(99999, 'Preparing', 'staff')).toThrowError(expect.objectContaining({ code: 'UNKNOWN_ORDER' }));
  });
});

describe('completed_at (BR3.6)', () => {
  beforeEach(() => {
    resetDb();
    seedIfEmpty();
    n = 0;
  });
  afterEach(() => {
    resetDb();
  });

  it('is set as ISO 8601 UTC text when an order becomes Completed, and only then', () => {
    const number = orderInStatus('Pending');
    const preparing = transitionOrder(number, 'Preparing', 'staff');
    expect(preparing.completed_at).toBeNull();
    expect(row(number).completed_at).toBeNull();

    const now = new Date('2026-11-08T12:34:56.789Z');
    const done = transitionOrder(number, 'Completed', 'staff', now);
    expect(done.completed_at).toBe('2026-11-08T12:34:56.789Z');
    expect(row(number).completed_at).toBe('2026-11-08T12:34:56.789Z');
  });

  it('stays empty for an order that is cancelled', () => {
    const number = orderInStatus('Pending');
    transitionOrder(number, 'Cancelled', 'diner');
    expect(row(number).completed_at).toBeNull();
  });

  it('is set once: a second Completed is refused and the first time stays', () => {
    const number = orderInStatus('Preparing');
    const first = new Date('2026-11-08T12:00:00.000Z');
    transitionOrder(number, 'Completed', 'station', first);
    expect(() => transitionOrder(number, 'Completed', 'staff', new Date('2026-11-08T13:00:00.000Z'))).toThrow(/ILLEGAL_TRANSITION/);
    expect(row(number).completed_at).toBe(first.toISOString());
  });

  it('the status check in the update stops a change that raced in between (nothing is overwritten)', () => {
    const number = orderInStatus('Preparing');
    // Complete it, then try a Preparing->Cancelled that was decided while it was still Preparing
    transitionOrder(number, 'Completed', 'staff');
    expect(() => transitionOrder(number, 'Cancelled', 'staff')).toThrow(/ILLEGAL_TRANSITION/);
    expect(row(number).status).toBe('Completed');
  });
});
