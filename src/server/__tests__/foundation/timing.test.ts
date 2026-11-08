// U5 Step 10: every API answer comes back within 300 ms with the seed data (BR13.1, NFR1).
process.env.DB_FILE = ':memory:';

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../../index.js';
import { resetDb, seedIfEmpty } from '../../db.js';
import { launchSpecial } from '../../repositories/specialsRepo.js';
import { staffCookie } from '../helpers/staff.js';

const LIMIT_MS = 300;

/** Times one request and fails with the route's name when it is slower than the limit. */
async function timed<T extends { status: number }>(name: string, run: () => PromiseLike<T>): Promise<T> {
  const start = performance.now();
  const res = await run();
  const took = performance.now() - start;
  expect(took, `${name} took ${took.toFixed(0)} ms`).toBeLessThan(LIMIT_MS);
  return res;
}

describe('API answers within 300 ms with the seed data', () => {
  beforeAll(() => {
    resetDb();
    seedIfEmpty();
  });
  afterAll(() => {
    resetDb();
  });

  it('placing orders (with options and a special) and reading them', async () => {
    const cookie = staffCookie();
    const special = launchSpecial({ item_id: 'i-06', special_price_cents: 900, stock: 100, minutes: 60 });
    // A busy restaurant: 40 orders over 10 tables, some with options, some on the special
    for (let i = 0; i < 40; i++) {
      const table = 1 + (i % 10);
      const lines =
        i % 3 === 0
          ? [{ menu_item_id: 'i-04', quantity: 2, option_ids: ['oc-04-size-large', 'oc-04-extras-cheese'] }, { menu_item_id: 'i-10', quantity: 1 }]
          : i % 3 === 1
            ? [{ menu_item_id: 'i-06', quantity: 1, special_id: special.id }]
            : [{ menu_item_id: 'i-01', quantity: 3 }, { menu_item_id: 'i-12', quantity: 1 }];
      const res = await timed(`POST orders #${i}`, () => request(app).post(`/api/tables/${table}/orders`).send({ placement_key: `t-${i}`, lines }));
      expect(res.status).toBe(201);
    }

    for (const table of [1, 5, 10]) {
      expect((await timed(`GET orders table ${table}`, () => request(app).get(`/api/tables/${table}/orders?visit=current`))).status).toBe(200);
      expect((await timed(`GET bill table ${table}`, () => request(app).get(`/api/tables/${table}/bill`).set('Cookie', cookie))).status).toBe(200);
      expect((await timed(`GET table ${table}`, () => request(app).get(`/api/tables/${table}`))).status).toBe(200);
    }
  });

  it('the menu, the estimate, the current special, calls, presence and rating checks', async () => {
    expect((await timed('GET menu', () => request(app).get('/api/menu'))).status).toBe(200);
    expect((await timed('GET estimate', () => request(app).get('/api/estimate?table=1'))).status).toBe(200);
    expect((await timed('GET special', () => request(app).get('/api/specials/current'))).status).toBe(200);
    expect((await timed('GET calls', () => request(app).get('/api/tables/1/calls'))).status).toBe(200);
    expect((await timed('POST call', () => request(app).post('/api/tables/1/calls').send({ kind: 'waiter' }))).status).toBe(201);
    expect((await timed('POST presence', () => request(app).post('/api/tables/1/presence').send({ page_id: 'page-timing-1' }))).status).toBe(204);
    expect((await timed('POST rating', () => request(app).post('/api/tables/1/ratings').send({ visit_id: 'v', ratings: [] }))).status).toBe(409);
  });

  it('signing in and the staff guard', async () => {
    const login = await timed('POST login', () => request(app).post('/api/staff/login').send({ pin: '4242' }));
    expect(login.status).toBe(204);
    expect((await timed('GET session', () => request(app).get('/api/staff/session').set('Cookie', staffCookie()))).status).toBe(200);
    expect((await timed('GET stub', () => request(app).get('/api/staff/menu'))).status).toBe(401);
  });
});
