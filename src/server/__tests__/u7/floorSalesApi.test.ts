// U7 Step 9: the table list, sales and ratings routes (BR4.1, BR7.1 to BR7.6).
process.env.DB_FILE = ':memory:';

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { app } from '../../index.js';
import { openCall, placeOrderWithOptions, setPresence } from '../helpers/index.js';
import { staffCookie } from '../helpers/staff.js';
import { addRating, cleanup, freshApp, localIso, makeClosedVisit } from './setup.js';

const get = (url: string) => request(app).get(url).set('Cookie', staffCookie());

describe('GET /api/staff/tables', () => {
  beforeEach(freshApp);
  afterEach(cleanup);

  it('answers every table with its state, pages present and open requests', async () => {
    placeOrderWithOptions(5, [{ menu_item_id: 'i-04', quantity: 1 }]);
    const { call } = openCall(5, 'bill');
    setPresence(4, 2);
    const res = await get('/api/staff/tables');
    expect(res.status).toBe(200);
    expect(res.body.tables).toHaveLength(10);
    expect(res.body.tables[4]).toMatchObject({ id: 5, label: 'Table 5', state: 'needs_bill', open_calls: [{ id: call.id, kind: 'bill' }] });
    expect(res.body.tables[3]).toMatchObject({ id: 4, state: 'browsing', connected: 2 });
    expect(res.body.tables[0]).toMatchObject({ id: 1, state: 'empty', connected: 0, last_activity_at: null, open_calls: [] });
  });

  it('401 without a session', async () => {
    const res = await request(app).get('/api/staff/tables');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('follows the database: an added table shows with no fixed number anywhere', async () => {
    const { getDb } = await import('../../db.js');
    getDb().prepare("INSERT INTO tables (id, label, status) VALUES (11, 'Patio 1', 'open')").run();
    const res = await get('/api/staff/tables');
    expect(res.body.tables).toHaveLength(11);
    expect(res.body.tables[10]).toMatchObject({ id: 11, label: 'Patio 1' });
  });
});

describe('GET /api/staff/sales', () => {
  beforeEach(freshApp);
  afterEach(cleanup);

  it('answers an empty list when nothing has closed', async () => {
    const res = await get('/api/staff/sales');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ days: [] });
  });

  it('answers a day with totals, the average and best sellers', async () => {
    makeClosedVisit(1, localIso(2026, 11, 7, 12), [{ placedAt: localIso(2026, 11, 7, 11), completedAt: localIso(2026, 11, 7, 11, 12), lines: [{ item_id: 'i-04', quantity: 2, unit_price_cents: 1450 }] }]);
    const res = await get('/api/staff/sales');
    expect(res.body.days).toEqual([
      { day: '2026-11-07', visits: 1, orders: 1, total_cents: 2900, average_minutes: 12, average_per_visit_cents: 2900, best_sellers: [{ item_id: 'i-04', name: 'Classic Burger', quantity: 2 }] },
    ]);
  });

  it('filters by from and to, and 400s an unreadable value with the field named', async () => {
    makeClosedVisit(1, localIso(2026, 11, 6, 12), [{ placedAt: localIso(2026, 11, 6, 11), completedAt: null, lines: [{ item_id: 'i-04', quantity: 1, unit_price_cents: 100 }] }]);
    expect((await get('/api/staff/sales?from=2026-11-07')).body.days).toEqual([]);
    expect((await get('/api/staff/sales?from=2026-11-06&to=2026-11-06')).body.days).toHaveLength(1);
    const bad = await get('/api/staff/sales?from=soon');
    expect(bad.status).toBe(400);
    expect(bad.body.error).toMatchObject({ code: 'INVALID_REQUEST', details: { field: 'from' } });
  });

  it('401 without a session', async () => {
    expect((await request(app).get('/api/staff/sales')).status).toBe(401);
  });
});

describe('GET /api/staff/ratings', () => {
  beforeEach(freshApp);
  afterEach(cleanup);

  it('answers best, worst and the tie rule for a day', async () => {
    const visit = makeClosedVisit(1, localIso(2026, 11, 7, 12), [{ placedAt: localIso(2026, 11, 7, 11), completedAt: localIso(2026, 11, 7, 11, 5), lines: [{ item_id: 'i-08', quantity: 1, unit_price_cents: 950 }] }]);
    addRating(visit, 'i-08', 'up', localIso(2026, 11, 7, 12));
    const res = await get('/api/staff/ratings?day=2026-11-07');
    expect(res.status).toBe(200);
    expect(res.body.day).toBe('2026-11-07');
    expect(res.body.best[0]).toMatchObject({ item_id: 'i-08', name: 'Chocolate Fondant', up: 1, total: 1, share: 1 });
    expect(res.body.tie_rule).toEqual(expect.any(String));
  });

  it('defaults to today, and has nothing ranked with no ratings', async () => {
    const res = await get('/api/staff/ratings');
    expect(res.status).toBe(200);
    expect(res.body.day).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(res.body.best).toEqual([]);
  });

  it('400 for an unreadable day', async () => {
    const res = await get('/api/staff/ratings?day=2026-99-99');
    expect(res.status).toBe(400);
    expect(res.body.error.details.field).toBe('day');
  });

  it('401 without a session', async () => {
    expect((await request(app).get('/api/staff/ratings')).status).toBe(401);
  });
});
