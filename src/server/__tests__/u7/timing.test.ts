// U7 Step 9: every new read answers within 300 ms on the seed data (NFR1).
process.env.DB_FILE = ':memory:';

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { app } from '../../index.js';
import { placeOrderWithOptions } from '../helpers/index.js';
import { staffCookie } from '../helpers/staff.js';
import { cleanup, freshApp, localIso, makeClosedVisit } from './setup.js';

const LIMIT_MS = 300;

async function timed(label: string, url: string) {
  const start = performance.now();
  const res = await request(app).get(url).set('Cookie', staffCookie());
  const ms = performance.now() - start;
  expect(res.status, label).toBe(200);
  expect(ms, `${label} took ${Math.round(ms)} ms`).toBeLessThan(LIMIT_MS);
}

describe('response time of the new reads', () => {
  beforeEach(() => {
    freshApp();
    for (let t = 1; t <= 10; t++) placeOrderWithOptions(t, [{ menu_item_id: 'i-04', quantity: 1 }, { menu_item_id: 'i-11', quantity: 1 }]);
    for (let d = 1; d <= 20; d++) {
      makeClosedVisit(1, localIso(2026, 10, d, 12), [{ placedAt: localIso(2026, 10, d, 11), completedAt: localIso(2026, 10, d, 11, 9), lines: [{ item_id: 'i-04', quantity: 2, unit_price_cents: 1450 }] }]);
    }
  });
  afterEach(cleanup);

  it('station boards, the staff menu, the table list, sales and ratings', async () => {
    await timed('station board', '/api/staff/stations/Grill/board');
    await timed('staff menu', '/api/staff/menu');
    await timed('table list', '/api/staff/tables');
    await timed('sales', '/api/staff/sales');
    await timed('ratings', '/api/staff/ratings');
  });
});
