// U5 Step 10: service call routes (BR6.1 to BR6.3, contract 1 and 2).
process.env.DB_FILE = ':memory:';

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';

const published = vi.hoisted(() => [] as Array<{ channel: string; type: string; data: any }>);
vi.mock('../../sse.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../sse.js')>();
  return {
    ...actual,
    publish: (channel: string, type: string, data: unknown) => {
      published.push({ channel, type, data });
      actual.publish(channel, type, data);
    },
  };
});

import { app } from '../../index.js';
import { getDb, resetDb, seedIfEmpty } from '../../db.js';
import { staffCookie } from '../helpers/staff.js';

const order = (table = 1, key = 'k') =>
  request(app).post(`/api/tables/${table}/orders`).send({ placement_key: key, lines: [{ menu_item_id: 'i-01', quantity: 1 }] });
const call = (table: number, kind: unknown) => request(app).post(`/api/tables/${table}/calls`).send({ kind });
const callEvents = (type: string) => published.filter((e) => e.type === type);

describe('service call API', () => {
  beforeEach(async () => {
    resetDb();
    seedIfEmpty();
    published.length = 0;
  });
  afterEach(() => {
    resetDb();
  });

  it('asking for the bill keeps the payment method (cash or card), in the answer, the list and the event', async () => {
    await order();
    published.length = 0;
    const res = await request(app).post('/api/tables/1/calls').send({ kind: 'bill', payment_method: 'card' });
    expect(res.status).toBe(201);
    expect(res.body.payment_method).toBe('card');
    expect(callEvents('SERVICE_CALL_OPENED')[0].data.payment_method).toBe('card');
    const list = await request(app).get('/api/tables/1/calls');
    expect(list.body.calls[0]).toMatchObject({ kind: 'bill', payment_method: 'card' });
  });

  it('a bill request with no payment method is still accepted and keeps none; a waiter call never keeps one', async () => {
    await order();
    const bill = await call(1, 'bill');
    expect(bill.status).toBe(201);
    expect(bill.body.payment_method).toBeNull();
    const waiter = await request(app).post('/api/tables/1/calls').send({ kind: 'waiter', payment_method: 'cash' });
    expect(waiter.body.payment_method).toBeNull();
  });

  it('wants_receipt is kept for a bill request, defaults to false, and must be true or false', async () => {
    await order();
    const res = await request(app).post('/api/tables/1/calls').send({ kind: 'bill', payment_method: 'cash', wants_receipt: true });
    expect(res.body.wants_receipt).toBe(true);
    expect(callEvents('SERVICE_CALL_OPENED').at(-1)?.data.wants_receipt).toBe(true);
    expect((await request(app).get('/api/tables/1/calls')).body.calls[0].wants_receipt).toBe(true);

    const bad = await request(app).post('/api/tables/1/calls').send({ kind: 'waiter', wants_receipt: 'yes' });
    expect(bad.status).toBe(400);
    expect(bad.body.error.code).toBe('INVALID_WANTS_RECEIPT');
  });

  it('a payment method other than cash or card is refused with 400 INVALID_PAYMENT_METHOD and opens nothing', async () => {
    await order();
    const res = await request(app).post('/api/tables/1/calls').send({ kind: 'bill', payment_method: 'cheque' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_PAYMENT_METHOD');
    expect((await request(app).get('/api/tables/1/calls')).body.calls).toEqual([]);
  });

  it('a press opens a request: 201, and SERVICE_CALL_OPENED goes to staff and that table only', async () => {
    await order();
    published.length = 0;
    const res = await call(1, 'waiter');
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ kind: 'waiter', status: 'open' });
    expect(res.body.id).toBeTruthy();

    const events = callEvents('SERVICE_CALL_OPENED');
    expect(events.map((e) => e.channel).sort()).toEqual(['staff', 'table:1']);
    expect(events[0].data).toEqual({ call_id: res.body.id, table_id: 1, kind: 'waiter', opened_at: res.body.opened_at });
  });

  it('a second press of the same kind is 200 with the same request and publishes nothing', async () => {
    await order();
    const first = await call(1, 'bill');
    published.length = 0;
    const again = await call(1, 'bill');
    expect(again.status).toBe(200);
    expect(again.body.id).toBe(first.body.id);
    expect(published).toHaveLength(0);
  });

  it('two presses at the same moment make one request; both are answered without an error', async () => {
    await order();
    const [a, b] = await Promise.all([call(1, 'waiter'), call(1, 'waiter')]);
    expect([a.status, b.status].sort()).toEqual([200, 201]);
    expect(a.body.id).toBe(b.body.id);
    expect(getDb().prepare('SELECT COUNT(*) AS n FROM service_calls').get()).toEqual({ n: 1 });
  });

  it('a bad kind is 400 INVALID_KIND, an unknown table 404, a table with no open visit 409 NO_OPEN_VISIT', async () => {
    await order();
    for (const kind of ['coffee', undefined, 7, null]) {
      const res = await call(1, kind);
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVALID_KIND');
    }
    const unknown = await call(99, 'waiter');
    expect(unknown.status).toBe(404);
    expect(unknown.body.error.code).toBe('UNKNOWN_TABLE');
    expect((await call(4, 'waiter')).body.error.code).toBe('NO_OPEN_VISIT');
    expect((await call(4, 'waiter')).status).toBe(409);
    expect((await request(app).post('/api/tables/5abc/calls').send({ kind: 'waiter' })).status).toBe(404);
  });

  it('GET lists the current visit\'s requests, open and answered', async () => {
    await order();
    const w = await call(1, 'waiter');
    await call(1, 'bill');
    await request(app).post(`/api/service-calls/${w.body.id}/respond`).set('Cookie', staffCookie());
    const list = await request(app).get('/api/tables/1/calls');
    expect(list.status).toBe(200);
    expect(list.body.calls.map((c: { kind: string; status: string }) => [c.kind, c.status])).toEqual([
      ['waiter', 'responded'],
      ['bill', 'open'],
    ]);
    expect(list.body.calls[0]).toHaveProperty('opened_at');
    // No open visit: an empty list, not an error
    expect((await request(app).get('/api/tables/6/calls')).body).toEqual({ calls: [] });
    expect((await request(app).get('/api/tables/99/calls')).status).toBe(404);
  });

  describe('respond (staff)', () => {
    it('is 200 { id, status: "responded" }, publishes to staff and the table, and the diner can ask again', async () => {
      await order();
      const opened = await call(1, 'waiter');
      published.length = 0;

      const res = await request(app).post(`/api/service-calls/${opened.body.id}/respond`).set('Cookie', staffCookie());
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ id: opened.body.id, status: 'responded' });
      const events = callEvents('SERVICE_CALL_RESPONDED');
      expect(events.map((e) => e.channel).sort()).toEqual(['staff', 'table:1']);
      expect(events[0].data).toMatchObject({ call_id: opened.body.id, table_id: 1, kind: 'waiter' });
      expect(events[0].data.responded_at).toMatch(/Z$/);

      expect((await call(1, 'waiter')).status).toBe(201); // a new request
    });

    it('a second respond is 200 and unchanged, with no second event; an unknown id is 404 UNKNOWN_CALL', async () => {
      await order();
      const opened = await call(1, 'waiter');
      const cookie = staffCookie();
      await request(app).post(`/api/service-calls/${opened.body.id}/respond`).set('Cookie', cookie);
      published.length = 0;
      const again = await request(app).post(`/api/service-calls/${opened.body.id}/respond`).set('Cookie', cookie);
      expect(again.status).toBe(200);
      expect(again.body.status).toBe('responded');
      expect(published).toHaveLength(0);

      const missing = await request(app).post('/api/service-calls/nope/respond').set('Cookie', cookie);
      expect(missing.status).toBe(404);
      expect(missing.body.error.code).toBe('UNKNOWN_CALL');
    });

    it('needs a staff session', async () => {
      await order();
      const opened = await call(1, 'waiter');
      const res = await request(app).post(`/api/service-calls/${opened.body.id}/respond`);
      expect(res.status).toBe(401);
      expect((await request(app).get('/api/tables/1/calls')).body.calls[0].status).toBe('open');
    });
  });

  it('closing the table clears its open requests, and the next visit starts clean (BR6.3)', async () => {
    const n = (await order()).body.order_number;
    const cookie = staffCookie();
    await call(1, 'waiter');
    await call(1, 'bill');
    await request(app).post(`/api/orders/${n}/transition`).set('Cookie', cookie).send({ to: 'Preparing', by: 'staff' });
    await request(app).post(`/api/orders/${n}/transition`).set('Cookie', cookie).send({ to: 'Completed', by: 'staff' });
    published.length = 0;

    const closed = await request(app).post('/api/tables/1/close').set('Cookie', cookie).send({});
    expect(closed.status).toBe(200);
    expect(getDb().prepare('SELECT COUNT(*) AS n FROM service_calls WHERE responded_at IS NULL').get()).toEqual({ n: 0 });
    // Only TABLE_CLOSED is published: no per-request event (BR6.3)
    expect(callEvents('SERVICE_CALL_RESPONDED')).toHaveLength(0);
    expect(callEvents('TABLE_CLOSED').length).toBeGreaterThan(0);
    expect((await request(app).get('/api/tables/1/calls')).body.calls).toEqual([]);
  });
});
