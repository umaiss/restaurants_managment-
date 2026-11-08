// U7 Step 9: U7's routes are mounted before the page catch-all and from any folder (BR10.2).
process.env.DB_FILE = ':memory:';

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import request from 'supertest';
import { app } from '../../index.js';
import { routeModules } from '../../routes/registry.js';
import { staffCookie } from '../helpers/staff.js';
import { cleanup, freshApp } from './setup.js';

const ROUTES: Array<['get' | 'post' | 'put' | 'patch', string]> = [
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

describe('U7 routes and the page catch-all (BR10.2)', () => {
  beforeEach(freshApp);
  afterEach(cleanup);

  it.each(ROUTES)('%s %s never returns the page, signed in or not', async (method, url) => {
    const signedOut = await request(app)[method](url).send({});
    expect(signedOut.status).toBe(401);
    expect(signedOut.headers['content-type']).toMatch(/json/);
    const signedIn = await request(app)[method](url).set('Cookie', staffCookie()).send({});
    expect(signedIn.headers['content-type']).toMatch(/json/);
    expect(signedIn.status).not.toBe(501); // no longer a stub
  });

  it('the four U7 modules are in the registry as before, behind the staff module (U5 is not edited)', () => {
    const names = routeModules.map((m) => m.name);
    for (const n of ['staff-stations', 'staff-menu', 'staff-floor', 'staff-sales']) expect(names.indexOf(n)).toBeGreaterThan(names.indexOf('staff'));
    expect(routeModules.filter((m) => m.owner === 'U7')).toHaveLength(5);
  });

  it('page addresses are still served the page', async () => {
    for (const path of ['/staff', '/staff/floor', '/staff/menu', '/staff/qr', '/staff/stations/Grill', '/staff/sales']) {
      const res = await request(app).get(path);
      expect(res.status, path).toBe(200);
      expect(res.headers['content-type'], path).toMatch(/html/);
    }
  });

  it('U7\'s server files read no port or database name of their own', () => {
    for (const f of fs.readdirSync('src/server/routes/u7')) {
      const text = fs.readFileSync(`src/server/routes/u7/${f}`, 'utf8');
      expect(text, f).not.toMatch(/listen\(|\.db['"]|3000|3100/);
    }
  });
});
