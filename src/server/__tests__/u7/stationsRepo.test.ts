// U7 Step 5: a station's board and the done mark (BR1.1, BR1.2).
process.env.DB_FILE = ':memory:';

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getDb } from '../../db.js';
import { getStationBoard, markStationDone } from '../../routes/u7/stations.js';
import { placeOrderWithOptions, moveOrder } from '../helpers/index.js';
import { cleanup, freshApp } from './setup.js';

// i-04 Classic Burger (Grill, has options), i-11 Fresh Orange Juice (Bar), i-02 House Salad (Cold), i-08 Chocolate Fondant (Desserts)
const mixed = () =>
  placeOrderWithOptions(5, [
    { menu_item_id: 'i-04', quantity: 1, option_ids: ['oc-04-size-large', 'oc-04-extras-cheese', 'oc-04-leave-onions'] },
    { menu_item_id: 'i-11', quantity: 2 },
  ]);

describe('a station board (BR1.1)', () => {
  beforeEach(freshApp);
  afterEach(cleanup);

  it('lists an open order only on the stations it has lines for, with only that station\'s lines and their options', () => {
    const order = mixed();
    const grill = getStationBoard('Grill');
    expect(grill).toHaveLength(1);
    expect(grill[0]).toMatchObject({ order_number: order.order_number, table_id: 5, status: 'Pending' });
    expect(grill[0].lines).toEqual([
      { menu_item_id: 'i-04', name: 'Classic Burger', quantity: 1, options: [
        { label: 'Large', price_delta_cents: 300 },
        { label: 'Extra cheese', price_delta_cents: 100 },
        { label: 'No onions', price_delta_cents: 0 },
      ] },
    ]);
    const bar = getStationBoard('Bar');
    expect(bar[0].lines.map((l) => l.name)).toEqual(['Fresh Orange Juice']);
    expect(getStationBoard('Cold')).toEqual([]);
    expect(getStationBoard('Desserts')).toEqual([]);
  });

  it('shows the other stations of the order and whether they are done or waiting', () => {
    const order = mixed();
    expect(getStationBoard('Grill')[0].other_stations).toEqual([{ station: 'Bar', state: 'waiting' }]);
    markStationDone(order.order_number, 'Bar');
    expect(getStationBoard('Grill')[0].other_stations).toEqual([{ station: 'Bar', state: 'done' }]);
  });

  it('drops an order from a station\'s board once that station is marked done, and keeps it on the others', () => {
    const order = mixed();
    markStationDone(order.order_number, 'Grill');
    expect(getStationBoard('Grill')).toEqual([]);
    expect(getStationBoard('Bar')).toHaveLength(1);
  });

  it('leaves out Completed and Cancelled orders', () => {
    const a = placeOrderWithOptions(1, [{ menu_item_id: 'i-04', quantity: 1 }]);
    const b = placeOrderWithOptions(2, [{ menu_item_id: 'i-04', quantity: 1 }]);
    moveOrder(a.order_number, 'Preparing');
    moveOrder(a.order_number, 'Completed');
    moveOrder(b.order_number, 'Cancelled');
    expect(getStationBoard('Grill')).toEqual([]);
  });

  it('lists a Preparing order too, oldest first', () => {
    const first = placeOrderWithOptions(1, [{ menu_item_id: 'i-04', quantity: 1 }]);
    const second = placeOrderWithOptions(2, [{ menu_item_id: 'i-05', quantity: 1 }]);
    moveOrder(second.order_number, 'Preparing');
    expect(getStationBoard('Grill').map((t) => t.order_number)).toEqual([first.order_number, second.order_number]);
    expect(getStationBoard('Grill')[1].status).toBe('Preparing');
  });

  it('counts a line frozen with no station as Grill (the column default)', () => {
    const order = placeOrderWithOptions(3, [{ menu_item_id: 'i-02', quantity: 1 }]);
    getDb().prepare("UPDATE order_items SET station = 'Grill' WHERE order_id = (SELECT id FROM orders WHERE order_number = ?)").run(order.order_number);
    expect(getStationBoard('Grill').map((t) => t.order_number)).toContain(order.order_number);
    expect(getStationBoard('Cold')).toEqual([]);
  });
});

describe('marking a station done (BR1.2)', () => {
  beforeEach(freshApp);
  afterEach(cleanup);

  it('writes the mark and moves a Pending order to Preparing', () => {
    const order = mixed();
    const r = markStationDone(order.order_number, 'Grill');
    expect(r).toMatchObject({ status: 'Preparing', changed: true, stations_done: ['Grill'], stations_remaining: ['Bar'] });
    expect(r.changes.map((c) => c.status)).toEqual(['Preparing']);
    expect(getDb().prepare('SELECT status FROM orders WHERE order_number = ?').get(order.order_number)).toEqual({ status: 'Preparing' });
  });

  it('completes the order, with completed_at, when the last station is marked', () => {
    const order = mixed();
    markStationDone(order.order_number, 'Grill');
    const r = markStationDone(order.order_number, 'Bar');
    expect(r.status).toBe('Completed');
    expect(r.stations_remaining).toEqual([]);
    expect(r.changes).toHaveLength(1);
    expect(r.changes[0].completed_at).toMatch(/^\d{4}-\d{2}-\d{2}T.*Z$/);
    expect(getDb().prepare('SELECT status, completed_at FROM orders WHERE order_number = ?').get(order.order_number)).toEqual({
      status: 'Completed',
      completed_at: r.changes[0].completed_at,
    });
  });

  it('an order with lines for one station goes Preparing and then Completed with one mark, both changes reported in order', () => {
    const order = placeOrderWithOptions(4, [{ menu_item_id: 'i-04', quantity: 2 }]);
    const r = markStationDone(order.order_number, 'Grill');
    expect(r.changes.map((c) => c.status)).toEqual(['Preparing', 'Completed']);
    expect(r.status).toBe('Completed');
  });

  it('marking an order already Preparing does not move it to Preparing again', () => {
    const order = mixed();
    moveOrder(order.order_number, 'Preparing');
    const r = markStationDone(order.order_number, 'Grill');
    expect(r.changes).toEqual([]);
    expect(r.status).toBe('Preparing');
  });

  it('a repeated mark changes nothing and is not an error, even after the order is Completed', () => {
    const order = mixed();
    markStationDone(order.order_number, 'Grill');
    markStationDone(order.order_number, 'Bar');
    const again = markStationDone(order.order_number, 'Bar');
    expect(again).toMatchObject({ changed: false, status: 'Completed', changes: [] });
    expect(getDb().prepare('SELECT COUNT(*) AS n FROM station_done WHERE order_number = ?').get(order.order_number)).toEqual({ n: 2 });
  });

  it('refuses a station the order has no lines for, and writes nothing', () => {
    const order = mixed();
    expect(() => markStationDone(order.order_number, 'Cold')).toThrowError(expect.objectContaining({ code: 'NO_LINES_FOR_STATION' }));
    expect(getDb().prepare('SELECT COUNT(*) AS n FROM station_done').get()).toEqual({ n: 0 });
  });

  it('refuses an unknown order', () => {
    expect(() => markStationDone(9999, 'Grill')).toThrowError(expect.objectContaining({ code: 'UNKNOWN_ORDER' }));
  });

  it('refuses a first mark on a Cancelled order, and writes nothing', () => {
    const order = mixed();
    moveOrder(order.order_number, 'Cancelled');
    expect(() => markStationDone(order.order_number, 'Grill')).toThrowError(expect.objectContaining({ code: 'ILLEGAL_TRANSITION' }));
    expect(getDb().prepare('SELECT COUNT(*) AS n FROM station_done').get()).toEqual({ n: 0 });
  });

  it('refuses a first mark on an order that was Completed from the All stations view', () => {
    const order = mixed();
    moveOrder(order.order_number, 'Preparing');
    moveOrder(order.order_number, 'Completed');
    expect(() => markStationDone(order.order_number, 'Bar')).toThrowError(expect.objectContaining({ code: 'ILLEGAL_TRANSITION' }));
  });

  it('two presses of the last station (each runs in its own transaction): the first completes the order, the second changes nothing', () => {
    const order = mixed();
    markStationDone(order.order_number, 'Grill');
    const first = markStationDone(order.order_number, 'Bar');
    const second = markStationDone(order.order_number, 'Bar');
    expect([first.changed, second.changed]).toEqual([true, false]);
    expect(first.changes.map((c) => c.status)).toEqual(['Completed']);
    expect(second.changes).toEqual([]);
  });
});
