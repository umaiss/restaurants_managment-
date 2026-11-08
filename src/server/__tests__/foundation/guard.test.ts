// U5 Step 10: the staff guard (BR1.5, BR1.6, BR14.1): every staff route answers 401 without a session
// and the diner routes stay open.
process.env.DB_FILE = ':memory:';

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { app } from '../../index.js';
import { getDb, resetDb, seedIfEmpty } from '../../db.js';
import { _resetForTest } from '../../sse.js';
import { resetStaffAccessForTest, resetLoginAttemptsForTest } from '../../staffAccess.js';
import { resetPresenceForTest } from '../../presence.js';
import { staffCookie } from '../helpers/staff.js';

type Method = 'get' | 'post' | 'put' | 'patch' | 'delete';

/** Every route that needs a staff session, with a body that would be valid if the guard let it through. */
const STAFF_ROUTES: Array<[Method, string, object?]> = [
  ['post', '/api/staff/logout'],
  ['get', '/api/staff/session'],
  ['post', '/api/menu/items/i-01/availability', { available: false }],
  ['get', '/api/tables/1/bill'],
  ['post', '/api/tables/1/close', {}],
  ['post', '/api/specials', { item_id: 'i-04', special_price_cents: 900, stock: 5, minutes: 30 }],
  ['delete', '/api/specials/current'],
  ['post', '/api/service-calls/some-id/respond'],
  // U7 (Bolt 7): the routes it built, still behind the guard. No body is sent, so a signed-in call is refused
  // by the route's own checks (400, 404 or 422) and never writes anything.
  ['get', '/api/staff/stations/Grill/board'],
  ['post', '/api/staff/orders/1/stations/Grill/done'],
  ['get', '/api/staff/menu'],
  ['post', '/api/staff/menu/items'],
  ['patch', '/api/staff/menu/items/i-01'],
  ['put', '/api/staff/menu/items/i-01/options'],
  ['post', '/api/staff/menu/categories'],
  ['patch', '/api/staff/menu/categories/c-01'],
  ['get', '/api/staff/tables'],
  ['get', '/api/staff/sales'],
  ['get', '/api/staff/ratings'],
];

/**
 * The routes U7 owns that are still guarded stubs (BR14.1). U7 (Bolt 7) built the stations, menu, floor and
 * sales modules, so their entries are gone from this list: a route that works must not be expected to answer
 * 501. They are checked for the guard (401 first) in STAFF_ROUTES below. Only the QR stub is left, because
 * U7 draws the QR codes in the browser and leaves that module as U5 made it.
 */
const STUB_ROUTES: Array<[Method, string]> = [['get', '/api/staff/qr/1']];

describe('the staff guard', () => {
  beforeEach(() => {
    resetDb();
    seedIfEmpty();
    _resetForTest();
    resetStaffAccessForTest();
    resetPresenceForTest();
    resetLoginAttemptsForTest();
  });
  afterEach(() => {
    resetDb();
    resetStaffAccessForTest();
  });

  describe.each(STAFF_ROUTES)('%s %s', (method, url, body) => {
    it('answers 401 UNAUTHORIZED in v1\'s error shape with no session, and changes nothing', async () => {
      const res = await request(app)[method](url).send(body ?? {});
      expect(res.status).toBe(401);
      expect(res.body).toEqual({ error: { code: 'UNAUTHORIZED', message: expect.any(String) } });
      expect(getDb().prepare('SELECT COUNT(*) AS n FROM chef_specials').get()).toEqual({ n: 0 });
      expect(getDb().prepare('SELECT available FROM items WHERE id = ?').get('i-01')).toEqual({ available: 1 });
    });

    it('answers 401 for a made-up session cookie', async () => {
      const res = await request(app)[method](url).set('Cookie', 'staff_session=0123456789abcdef0123456789abcdef').send(body ?? {});
      expect(res.status).toBe(401);
    });

    it('does not answer 401 for a signed-in session', async () => {
      const res = await request(app)[method](url).set('Cookie', staffCookie()).send(body ?? {});
      expect(res.status).not.toBe(401);
    });
  });

  describe.each(STUB_ROUTES)('U7 stub %s %s', (method, url) => {
    it('answers 401 first without a session, then 501 NOT_BUILT with one', async () => {
      const noSession = await request(app)[method](url).send({});
      expect(noSession.status).toBe(401);
      expect(noSession.body.error.code).toBe('UNAUTHORIZED');

      const signedIn = await request(app)[method](url).set('Cookie', staffCookie()).send({});
      expect(signedIn.status).toBe(501);
      expect(signedIn.body.error.code).toBe('NOT_BUILT');
    });
  });

  it('an unknown path under /api/staff is guarded too (401 without a session)', async () => {
    expect((await request(app).get('/api/staff/something-new')).status).toBe(401);
  });

  it('the staff live stream answers 401 without a session', async () => {
    const res = await request(app).get('/sse/staff');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  describe('diner routes stay open (BR1.5)', () => {
    it('menu, a table\'s status, estimate, the current special, calls and the orders list need no session', async () => {
      for (const url of ['/api/menu', '/api/tables/1', '/api/estimate?table=1', '/api/specials/current', '/api/tables/1/calls', '/api/tables/1/orders?visit=current']) {
        const res = await request(app).get(url);
        expect(res.status, url).toBe(200);
      }
    });

    it('placing an order, a heartbeat and a service call need no session', async () => {
      const order = await request(app).post('/api/tables/1/orders').send({ placement_key: 'g-1', lines: [{ menu_item_id: 'i-01', quantity: 1 }] });
      expect(order.status).toBe(201);
      expect((await request(app).post('/api/tables/1/presence').send({ page_id: 'page-guard-1' })).status).toBe(204);
      expect((await request(app).post('/api/tables/1/calls').send({ kind: 'waiter' })).status).toBe(201);
    });

    it('a rating is open to everyone (it fails on its own rules, not on the guard)', async () => {
      const res = await request(app).post('/api/tables/1/ratings').send({ visit_id: 'v', ratings: [] });
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('VISIT_NOT_CLOSED');
    });
  });

  describe('order status changes (BR1.5, BR1.6)', () => {
    async function pendingOrder(key: string) {
      const res = await request(app).post('/api/tables/1/orders').send({ placement_key: key, lines: [{ menu_item_id: 'i-01', quantity: 1 }] });
      return res.body.order_number as number;
    }
    const status = (n: number) => (getDb().prepare('SELECT status FROM orders WHERE order_number = ?').get(n) as { status: string }).status;

    it('by=staff without a session is 401 and the order is untouched', async () => {
      const n = await pendingOrder('o-1');
      const res = await request(app).post(`/api/orders/${n}/transition`).send({ to: 'Preparing', by: 'staff' });
      expect(res.status).toBe(401);
      expect(status(n)).toBe('Pending');
    });

    it('by=staff with a session works', async () => {
      const n = await pendingOrder('o-2');
      const res = await request(app).post(`/api/orders/${n}/transition`).set('Cookie', staffCookie()).send({ to: 'Preparing', by: 'staff' });
      expect(res.status).toBe(200);
      expect(status(n)).toBe('Preparing');
    });

    it('by=diner needs no session and may cancel a Pending order, exactly as in v1', async () => {
      const n = await pendingOrder('o-3');
      const res = await request(app).post(`/api/orders/${n}/transition`).send({ to: 'Cancelled', by: 'diner' });
      expect(res.status).toBe(200);
      expect(status(n)).toBe('Cancelled');
    });

    it('by=diner may do nothing else: Pending to Preparing is 422 ILLEGAL_TRANSITION', async () => {
      const n = await pendingOrder('o-4');
      const res = await request(app).post(`/api/orders/${n}/transition`).send({ to: 'Preparing', by: 'diner' });
      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe('ILLEGAL_TRANSITION');
      expect(status(n)).toBe('Pending');
    });

    it('a request can never claim to be the kitchen station: by=station is 400 INVALID_ACTOR', async () => {
      const n = await pendingOrder('o-5');
      for (const cookie of [undefined, staffCookie()]) {
        const req = request(app).post(`/api/orders/${n}/transition`);
        if (cookie) req.set('Cookie', cookie);
        const res = await req.send({ to: 'Preparing', by: 'station' });
        expect(res.status).toBe(400);
        expect(res.body.error.code).toBe('INVALID_ACTOR');
      }
      expect(status(n)).toBe('Pending');
    });
  });
});
