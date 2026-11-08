// U5 Step 10: new routes are mounted before the page catch-all and the page is served with a root
// setting (BR11.4, BR11.5, BR14.1).
process.env.DB_FILE = ':memory:';

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import request from 'supertest';
import { app } from '../../index.js';
import { resetDb, seedIfEmpty } from '../../db.js';
import { routeModules } from '../../routes/registry.js';
import { staffCookie } from '../helpers/staff.js';

describe('route order and the page catch-all', () => {
  beforeEach(() => {
    resetDb();
    seedIfEmpty();
  });
  afterEach(() => {
    resetDb();
  });

  it('every new route answers with its own JSON, never with the page', async () => {
    const cookie = staffCookie();
    const urls: Array<[string, string]> = [
      ['get', '/api/estimate?table=1'],
      ['get', '/api/specials/current'],
      ['get', '/api/tables/1/calls'],
      ['post', '/api/tables/1/calls'],
      ['post', '/api/tables/1/presence'],
      ['post', '/api/tables/1/ratings'],
      ['post', '/api/staff/login'],
      ['get', '/api/staff/session'],
      ['get', '/api/staff/menu'],
      ['get', '/api/staff/tables'],
      ['get', '/api/staff/stations/Grill/board'],
      ['get', '/api/staff/sales'],
      ['get', '/api/staff/qr/1'],
      ['post', '/api/service-calls/x/respond'],
      ['delete', '/api/specials/current'],
    ];
    for (const [method, url] of urls) {
      const res = await (request(app) as any)[method](url).set('Cookie', cookie).send({});
      if (res.status === 204) {
        expect(res.text, `${method} ${url}`).toBe(''); // its own empty answer, not the page
        continue;
      }
      expect(res.headers['content-type'], `${method} ${url}`).toMatch(/json/);
      expect(res.text, `${method} ${url}`).not.toMatch(/<html|<!DOCTYPE/i);
    }
  });

  it('without a session a staff route is answered 401 JSON, not the page', async () => {
    const res = await request(app).get('/api/staff/menu');
    expect(res.status).toBe(401);
    expect(res.headers['content-type']).toMatch(/json/);
  });

  it('a page address is still served the page (the catch-all still works)', async () => {
    const res = await request(app).get('/table/5');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/html/);
    expect((await request(app).get('/staff')).headers['content-type']).toMatch(/html/);
  });

  it('the registry lists every module once, with U7\'s five stubs in it (contract 7)', () => {
    const names = routeModules.map((m) => m.name);
    expect(new Set(names).size).toBe(names.length);
    expect(names).toEqual(
      expect.arrayContaining([
        'menu', 'orders', 'billing', 'staff', 'specials', 'calls', 'ratings', 'presence', 'estimate',
        'staff-stations', 'staff-menu', 'staff-floor', 'staff-sales', 'staff-qr', 'sse',
      ])
    );
    expect(routeModules.filter((m) => m.owner === 'U7').map((m) => m.name)).toEqual([
      'staff-stations', 'staff-menu', 'staff-floor', 'staff-sales', 'staff-qr',
    ]);
    // The staff module (open login, then the guard) comes before every U7 module
    expect(names.indexOf('staff')).toBeLessThan(names.indexOf('staff-stations'));
  });

  it('the server file serves the page with { root: distDir } and never with an absolute path, and reads ports from the environment', () => {
    const source = fs.readFileSync('src/server/index.ts', 'utf8');
    expect(source).toContain("res.sendFile('index.html', { root: distDir }");
    expect(source).not.toMatch(/sendFile\(\s*(path\.|`|__dirname|distDir\s*\+)/);
    // The registry is mounted before the catch-all
    expect(source.indexOf('routeModules')).toBeLessThan(source.indexOf("app.get('*'"));
    expect(source).not.toMatch(/listen\(\s*\d+/);
    expect(source).toContain('getPort()');
    const config = fs.readFileSync('src/server/config.ts', 'utf8');
    expect(config).toContain('process.env.PORT');
    expect(config).toContain('process.env.E2E_PORT');
    expect(config).toContain('process.env.DB_FILE');
  });
});
