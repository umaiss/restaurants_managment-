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

  it('POST /api/tables/1/orders with same placement_key same table returns same order_number', async () => {
    const res1 = await request(app)
      .post('/api/tables/1/orders')
      .send({ placement_key: 'key-idem-api', lines: [{ menu_item_id: 'i-01', quantity: 1 }] });
    expect(res1.status).toBe(201);

    const res2 = await request(app)
      .post('/api/tables/1/orders')
      .send({ placement_key: 'key-idem-api', lines: [{ menu_item_id: 'i-01', quantity: 1 }] });
    expect(res2.body.order_number).toBe(res1.body.order_number);
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
