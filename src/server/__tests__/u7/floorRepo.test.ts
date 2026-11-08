// U7 Step 5: each table's floor state and the table list (BR4.1, BR4.2).
process.env.DB_FILE = ':memory:';

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getFloorTables, decideFloorState } from '../../routes/u7/floor.js';
import { placeOrderWithOptions, moveOrder, openCall, respondCall, setPresence, closeTableAndRate } from '../helpers/index.js';
import { cleanup, freshApp } from './setup.js';

const state = (id: number) => getFloorTables().find((t) => t.id === id)!.state;

describe('floor state of a table (BR4.2)', () => {
  beforeEach(freshApp);
  afterEach(cleanup);

  it('lists every table of the database in order, with its label, and keeps no fixed number (BR4.1)', () => {
    const tables = getFloorTables();
    expect(tables.map((t) => t.id)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(tables[0]).toMatchObject({ label: 'Table 1', state: 'empty', connected: 0, open_calls: [] });
  });

  it('Empty: no visit, no pages', () => {
    expect(state(2)).toBe('empty');
  });

  it('Browsing: a page is present and nothing else applies', () => {
    setPresence(4, 2);
    const t = getFloorTables().find((x) => x.id === 4)!;
    expect(t.state).toBe('browsing');
    expect(t.connected).toBe(2);
    expect(t.last_activity_at).not.toBeNull();
  });

  it('Waiting: an order is Pending or Preparing', () => {
    const order = placeOrderWithOptions(1, [{ menu_item_id: 'i-04', quantity: 1 }]);
    expect(state(1)).toBe('waiting');
    moveOrder(order.order_number, 'Preparing');
    expect(state(1)).toBe('waiting');
  });

  it('Eating: the visit has an order that is not Cancelled and none is open', () => {
    const order = placeOrderWithOptions(3, [{ menu_item_id: 'i-04', quantity: 1 }]);
    moveOrder(order.order_number, 'Preparing');
    moveOrder(order.order_number, 'Completed');
    expect(state(3)).toBe('eating');
  });

  it('a visit with only Cancelled orders is not Eating: it is Browsing with a page, else Empty', () => {
    const order = placeOrderWithOptions(6, [{ menu_item_id: 'i-04', quantity: 1 }]);
    moveOrder(order.order_number, 'Cancelled');
    expect(state(6)).toBe('empty');
    setPresence(6, 1);
    expect(state(6)).toBe('browsing');
  });

  it('Needs the bill: an open bill request beats everything else', () => {
    placeOrderWithOptions(5, [{ menu_item_id: 'i-04', quantity: 1 }]);
    setPresence(5, 3);
    openCall(5, 'bill');
    expect(state(5)).toBe('needs_bill');
  });

  it('a waiter request alone does not change the state, but is listed with the table', () => {
    placeOrderWithOptions(5, [{ menu_item_id: 'i-04', quantity: 1 }]);
    const { call } = openCall(5, 'waiter');
    const t = getFloorTables().find((x) => x.id === 5)!;
    expect(t.state).toBe('waiting');
    expect(t.open_calls).toEqual([{ id: call.id, kind: 'waiter', opened_at: call.opened_at }]);
  });

  it('both requests can be open at once', () => {
    placeOrderWithOptions(7, [{ menu_item_id: 'i-04', quantity: 1 }]);
    openCall(7, 'waiter');
    openCall(7, 'bill');
    expect(getFloorTables().find((x) => x.id === 7)!.open_calls.map((c) => c.kind).sort()).toEqual(['bill', 'waiter']);
  });

  it('a responded request is no longer listed and the state falls back', () => {
    placeOrderWithOptions(5, [{ menu_item_id: 'i-04', quantity: 1 }]);
    const { call } = openCall(5, 'bill');
    respondCall(call.id);
    const t = getFloorTables().find((x) => x.id === 5)!;
    expect(t.open_calls).toEqual([]);
    expect(t.state).toBe('waiting');
  });

  it('closing the table empties it and clears its requests', () => {
    placeOrderWithOptions(8, [{ menu_item_id: 'i-04', quantity: 1 }]);
    openCall(8, 'bill');
    closeTableAndRate(8);
    const t = getFloorTables().find((x) => x.id === 8)!;
    expect(t.state).toBe('empty');
    expect(t.open_calls).toEqual([]);
  });

  it('decideFloorState takes the first rule that applies', () => {
    const base = { hasOpenBillCall: false, hasOpenOrder: false, hasLiveOrder: false, connected: 0 };
    expect(decideFloorState({ ...base, hasOpenBillCall: true, hasOpenOrder: true, hasLiveOrder: true, connected: 2 })).toBe('needs_bill');
    expect(decideFloorState({ ...base, hasOpenOrder: true, hasLiveOrder: true, connected: 2 })).toBe('waiting');
    expect(decideFloorState({ ...base, hasLiveOrder: true, connected: 2 })).toBe('eating');
    expect(decideFloorState({ ...base, connected: 1 })).toBe('browsing');
    expect(decideFloorState(base)).toBe('empty');
  });
});
