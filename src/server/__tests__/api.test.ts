process.env.DB_FILE = ':memory:';

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { app } from '../index.js';
import { resetDb, seedIfEmpty } from '../db.js';

describe('API endpoints', () => {
  beforeEach(() => {
    resetDb();
    seedIfEmpty();
  });

  afterEach(() => {
    resetDb();
  });

  it('GET /api/menu returns categories and items with seeded data', async () => {
    const res = await request(app).get('/api/menu');
    expect(res.status).toBe(200);
    expect(res.body.categories).toHaveLength(4);
    expect(res.body.items).toHaveLength(12);
    const item = res.body.items[0];
    expect(item).toHaveProperty('id');
    expect(item).toHaveProperty('name');
    expect(item).toHaveProperty('price_cents');
    expect(item).toHaveProperty('available');
  });

  it('POST /api/tables/1/orders with valid body returns 201 and an order_number', async () => {
    const res = await request(app)
      .post('/api/tables/1/orders')
      .send({ placement_key: 'test-key-001', lines: [{ menu_item_id: 'i-01', quantity: 2 }] });
    expect(res.status).toBe(201);
    expect(res.body.order_number).toBeGreaterThan(0);
    expect(res.body.status).toBe('Pending');
    expect(res.body.lines).toHaveLength(1);
  });

  it('regression: duplicate placement_key returns 200 with the existing order, not 409', async () => {
    const res1 = await request(app)
      .post('/api/tables/1/orders')
      .send({ placement_key: 'key-idem-api', lines: [{ menu_item_id: 'i-01', quantity: 1 }] });
    expect(res1.status).toBe(201);

    const res2 = await request(app)
      .post('/api/tables/1/orders')
      .send({ placement_key: 'key-idem-api', lines: [{ menu_item_id: 'i-01', quantity: 1 }] });
    expect(res2.status).toBe(200);
    expect(res2.body.order_number).toBe(res1.body.order_number);
    expect(res2.body.lines).toHaveLength(1);
  });

  describe('regression: order input is validated and refused with 400, never a 500', () => {
    const post = (body: unknown) => request(app).post('/api/tables/1/orders').send(body as object);
    const ok = { menu_item_id: 'i-01', quantity: 1 };

    it.each([
      ['a fractional quantity', { placement_key: 'v-1', lines: [{ ...ok, quantity: 1.5 }] }, 'INVALID_QUANTITY'],
      ['a quantity sent as a string', { placement_key: 'v-2', lines: [{ ...ok, quantity: '2' }] }, 'INVALID_QUANTITY'],
      ['a quantity that is not a number', { placement_key: 'v-3', lines: [{ ...ok, quantity: 'abc' }] }, 'INVALID_QUANTITY'],
      ['a quantity of 21', { placement_key: 'v-4', lines: [{ ...ok, quantity: 21 }] }, 'INVALID_QUANTITY'],
      ['a null line', { placement_key: 'v-5', lines: [null] }, 'INVALID_REQUEST'],
      ['a line that is not an object', { placement_key: 'v-6', lines: ['i-01'] }, 'INVALID_REQUEST'],
      ['a menu_item_id that is not a string', { placement_key: 'v-7', lines: [{ menu_item_id: 7, quantity: 1 }] }, 'INVALID_REQUEST'],
      ['a placement_key that is not a string', { placement_key: 12, lines: [ok] }, 'INVALID_REQUEST'],
      ['an empty placement_key', { placement_key: '  ', lines: [ok] }, 'INVALID_REQUEST'],
      ['no lines', { placement_key: 'v-8' }, 'EMPTY_ORDER'],
    ])('rejects %s', async (_name, body, code) => {
      const res = await post(body);
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe(code);
    });

    it('rejects a request with no body at all', async () => {
      const res = await request(app).post('/api/tables/1/orders');
      expect(res.status).toBe(400);
    });
  });

  it('POST /api/tables/2/orders with same placement_key but different table returns different order_number', async () => {
    const res1 = await request(app)
      .post('/api/tables/1/orders')
      .send({ placement_key: 'key-cross-table', lines: [{ menu_item_id: 'i-01', quantity: 1 }] });
    const res2 = await request(app)
      .post('/api/tables/2/orders')
      .send({ placement_key: 'key-cross-table', lines: [{ menu_item_id: 'i-01', quantity: 1 }] });
    expect(res2.body.order_number).not.toBe(res1.body.order_number);
  });

  it('POST /api/orders/:number/transition with {to:"Preparing", by:"staff"} returns 200', async () => {
    const orderRes = await request(app)
      .post('/api/tables/1/orders')
      .send({ placement_key: 'key-trans-001', lines: [{ menu_item_id: 'i-01', quantity: 1 }] });
    const orderNumber = orderRes.body.order_number;

    const res = await request(app)
      .post(`/api/orders/${orderNumber}/transition`)
      .send({ to: 'Preparing', by: 'staff' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('Preparing');
  });

  it('POST /api/orders/:number/transition with {to:"Completed", by:"diner"} returns 422 ILLEGAL_TRANSITION', async () => {
    const orderRes = await request(app)
      .post('/api/tables/1/orders')
      .send({ placement_key: 'key-trans-002', lines: [{ menu_item_id: 'i-01', quantity: 1 }] });
    const orderNumber = orderRes.body.order_number;

    const res = await request(app)
      .post(`/api/orders/${orderNumber}/transition`)
      .send({ to: 'Completed', by: 'diner' });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('ILLEGAL_TRANSITION');
  });

  it('POST /api/orders/:number/transition with invalid by value returns 400 INVALID_ACTOR', async () => {
    const orderRes = await request(app)
      .post('/api/tables/1/orders')
      .send({ placement_key: 'key-trans-003', lines: [{ menu_item_id: 'i-01', quantity: 1 }] });
    const orderNumber = orderRes.body.order_number;

    const res = await request(app)
      .post(`/api/orders/${orderNumber}/transition`)
      .send({ to: 'Preparing', by: 'manager' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_ACTOR');
  });
});
