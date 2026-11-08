// U6 Step 4 (BR10.1): GET /api/tables/:id/orders?visit=last_closed, plus Step 3's "U6 changes no table".
process.env.DB_FILE = ':memory:';

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { app } from '../../index.js';
import { getDb, resetDb, seedIfEmpty } from '../../db.js';
import { closeTableAndRate } from '../helpers/index.js';

const place = (table: number, key: string, lines: object[]) =>
  request(app).post(`/api/tables/${table}/orders`).send({ placement_key: key, lines });

describe('orders route: visit=last_closed (BR10.1)', () => {
  beforeEach(() => {
    resetDb();
    seedIfEmpty();
  });
  afterEach(() => resetDb());

  it('returns the orders of the most recently closed visit, with lines and options', async () => {
    await place(3, 'k1', [{ menu_item_id: 'i-04', quantity: 1, option_ids: ['oc-04-size-large'] }]);
    closeTableAndRate(3);
    const res = await request(app).get('/api/tables/3/orders?visit=last_closed');
    expect(res.status).toBe(200);
    expect(res.body.orders).toHaveLength(1);
    expect(res.body.orders[0].lines[0].options).toEqual([{ label: 'Large', price_delta_cents: 300 }]);
    expect(res.body.orders[0].status).toBe('Completed');
  });

  it('returns an empty list for a table that was never closed', async () => {
    await place(4, 'k2', [{ menu_item_id: 'i-01', quantity: 1 }]);
    const res = await request(app).get('/api/tables/4/orders?visit=last_closed');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ orders: [] });
  });

  it('with two closed visits it returns the latest one', async () => {
    await place(5, 'a', [{ menu_item_id: 'i-01', quantity: 1 }]);
    const first = closeTableAndRate(5);
    await place(5, 'b', [{ menu_item_id: 'i-02', quantity: 2 }]);
    const second = closeTableAndRate(5);
    expect(second).not.toBe(first);
    const res = await request(app).get('/api/tables/5/orders?visit=last_closed');
    expect(res.body.orders).toHaveLength(1);
    expect(res.body.orders[0].visit_id).toBe(second);
    expect(res.body.orders[0].lines[0].menu_item_id).toBe('i-02');
  });

  it('keeps cancelled orders in the body (the screen leaves them out)', async () => {
    const a = await place(6, 'c1', [{ menu_item_id: 'i-01', quantity: 1 }]);
    await request(app).post(`/api/orders/${a.body.order_number}/transition`).send({ to: 'Cancelled', by: 'diner' });
    await place(6, 'c2', [{ menu_item_id: 'i-02', quantity: 1 }]);
    closeTableAndRate(6);
    const res = await request(app).get('/api/tables/6/orders?visit=last_closed');
    expect(res.body.orders.map((o: { status: string }) => o.status).sort()).toEqual(['Cancelled', 'Completed']);
  });

  it('visit=current, a missing visit and an unknown visit behave as in v1', async () => {
    await place(7, 'd', [{ menu_item_id: 'i-01', quantity: 1 }]);
    const current = await request(app).get('/api/tables/7/orders?visit=current');
    expect(current.body.orders).toHaveLength(1);
    expect((await request(app).get('/api/tables/7/orders')).body).toEqual({ orders: [] });
    expect((await request(app).get('/api/tables/7/orders?visit=whatever')).body).toEqual({ orders: [] });
    closeTableAndRate(7);
    // after the close the current visit is gone but the last closed one is there
    expect((await request(app).get('/api/tables/7/orders?visit=current')).body).toEqual({ orders: [] });
    expect((await request(app).get('/api/tables/7/orders?visit=last_closed')).body.orders).toHaveLength(1);
  });

  it('answers 404 UNKNOWN_TABLE for a table id that is not a table number, as v1 does', async () => {
    const res = await request(app).get('/api/tables/abc/orders?visit=last_closed');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('UNKNOWN_TABLE');
  });
});

describe('U6 changes no table, column or seed', () => {
  beforeEach(() => {
    resetDb();
    seedIfEmpty();
  });
  afterEach(() => resetDb());

  it('the tables the route reads keep their columns', () => {
    const cols = (t: string) => (getDb().prepare(`PRAGMA table_info(${t})`).all() as Array<{ name: string }>).map((c) => c.name);
    expect(cols('visits')).toEqual(expect.arrayContaining(['id', 'table_id', 'opened_at', 'closed_at']));
    expect(cols('orders')).toEqual(expect.arrayContaining(['order_number', 'status', 'visit_id', 'estimate_minutes', 'completed_at']));
    expect(cols('order_items')).toEqual(expect.arrayContaining(['order_id', 'item_id', 'quantity', 'unit_price_cents', 'special_id']));
  });
});
