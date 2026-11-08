// U5 Step 10: estimate route (BR4.1, BR4.3).
process.env.DB_FILE = ':memory:';

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { app } from '../../index.js';
import { resetDb, seedIfEmpty } from '../../db.js';
import { staffCookie } from '../helpers/staff.js';

const order = (table: number, key: string) =>
  request(app).post(`/api/tables/${table}/orders`).send({ placement_key: key, lines: [{ menu_item_id: 'i-01', quantity: 1 }] });

describe('estimate API', () => {
  beforeEach(() => {
    resetDb();
    seedIfEmpty();
  });
  afterEach(() => {
    resetDb();
  });

  it('with nothing today it is 15 minutes, basis "default", no open orders', async () => {
    const res = await request(app).get('/api/estimate?table=1');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ estimate_minutes: 15, basis: 'default', open_orders: 0 });
  });

  it('is the same for every table and counts every open order in the restaurant', async () => {
    await order(1, 'a');
    await order(2, 'b');
    for (const t of [1, 2, 3, 10]) {
      const res = await request(app).get(`/api/estimate?table=${t}`);
      expect(res.body).toEqual({ estimate_minutes: 19, basis: 'default', open_orders: 2 }); // 15 + 2 x 2
    }
  });

  it('uses today\'s completed orders once there are some, and an order that is done no longer counts as open', async () => {
    const n = (await order(1, 'a')).body.order_number;
    const cookie = staffCookie();
    await request(app).post(`/api/orders/${n}/transition`).set('Cookie', cookie).send({ to: 'Preparing', by: 'staff' });
    await request(app).post(`/api/orders/${n}/transition`).set('Cookie', cookie).send({ to: 'Completed', by: 'staff' });
    const res = await request(app).get('/api/estimate?table=2');
    expect(res.body.basis).toBe('today');
    expect(res.body.open_orders).toBe(0);
    expect(res.body.estimate_minutes).toBe(1); // it took well under a minute in this test, and the minimum is 1
  });

  it('a table that does not exist, or none, or a bad number is 404 UNKNOWN_TABLE', async () => {
    for (const url of ['/api/estimate?table=99', '/api/estimate', '/api/estimate?table=abc', '/api/estimate?table=1x', '/api/estimate?table=0']) {
      const res = await request(app).get(url);
      expect(res.status, url).toBe(404);
      expect(res.body.error.code).toBe('UNKNOWN_TABLE');
    }
  });
});
