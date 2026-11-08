// U5 Step 10: staff sign-in, session and sign-out over HTTP (BR1.2 to BR1.5, BR1.9, BR14.4).
process.env.DB_FILE = ':memory:';

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import http from 'http';
import type { AddressInfo } from 'net';
import request from 'supertest';
import { app } from '../../index.js';
import { resetDb, seedIfEmpty } from '../../db.js';
import { _resetForTest } from '../../sse.js';
import { resetStaffAccessForTest } from '../../staffAccess.js';
import { resetPresenceForTest } from '../../presence.js';

const PIN = '4242';
const cookieOf = (res: request.Response): string => {
  const raw = (res.headers['set-cookie'] as unknown as string[] | undefined)?.[0] ?? '';
  return raw.split(';')[0];
};

describe('staff API', () => {
  beforeEach(() => {
    resetDb();
    seedIfEmpty();
    _resetForTest();
    resetPresenceForTest();
    process.env.STAFF_PIN = PIN;
    resetStaffAccessForTest(); // also clears every lockout count: supertest always comes from one address
  });
  afterEach(() => {
    resetDb();
    resetStaffAccessForTest();
  });

  describe('POST /api/staff/login', () => {
    it('a correct PIN answers 204 and sets an HttpOnly, SameSite=Strict, Path=/ cookie with no expiry', async () => {
      const res = await request(app).post('/api/staff/login').send({ pin: PIN });
      expect(res.status).toBe(204);
      const header = (res.headers['set-cookie'] as unknown as string[])[0];
      expect(header).toMatch(/^staff_session=[0-9a-f]{32};/);
      expect(header).toContain('HttpOnly');
      expect(header).toContain('SameSite=Strict');
      expect(header).toContain('Path=/');
      expect(header).not.toMatch(/Max-Age|Expires/i);
      expect(res.text).toBe('');
    });

    it('a wrong PIN answers 401 INVALID_PIN with the tries left and sets no cookie', async () => {
      const res = await request(app).post('/api/staff/login').send({ pin: '0000' });
      expect(res.status).toBe(401);
      expect(res.body).toEqual({ error: { code: 'INVALID_PIN', message: expect.any(String), details: { tries_left: 4 } } });
      expect(res.headers['set-cookie']).toBeUndefined();
    });

    it('a missing or malformed body is a wrong try, never a server error', async () => {
      for (const body of [{}, { pin: 4242 }, { pin: '42' }, { pin: null }]) {
        const res = await request(app).post('/api/staff/login').send(body);
        expect(res.status).toBe(401);
        expect(res.body.error.code).toBe('INVALID_PIN');
      }
      expect((await request(app).post('/api/staff/login')).status).toBe(401);
    });

    it('five wrong tries answer 429 LOCKED with the time left, even for the right PIN', async () => {
      for (let i = 0; i < 5; i++) await request(app).post('/api/staff/login').send({ pin: '0000' });
      const res = await request(app).post('/api/staff/login').send({ pin: PIN });
      expect(res.status).toBe(429);
      expect(res.body.error.code).toBe('LOCKED');
      expect(res.body.error.details.retry_after_seconds).toBeGreaterThan(0);
      expect(res.body.error.details.retry_after_seconds).toBeLessThanOrEqual(60);
      expect(res.headers['retry-after']).toBe(String(res.body.error.details.retry_after_seconds));
      expect(res.headers['set-cookie']).toBeUndefined();
    });

    it('the lock follows the connection\'s address, not the cookie: a request that sends no cookie is still locked', async () => {
      for (let i = 0; i < 5; i++) await request(app).post('/api/staff/login').send({ pin: '0000' });
      // A header the client sets cannot move it to another address
      const res = await request(app).post('/api/staff/login').set('X-Forwarded-For', '203.0.113.9').send({ pin: PIN });
      expect(res.status).toBe(429);
    });
  });

  describe('GET /api/staff/session', () => {
    it('is 200 { signed_in: true } with the cookie and 401 without it', async () => {
      const login = await request(app).post('/api/staff/login').send({ pin: PIN });
      const ok = await request(app).get('/api/staff/session').set('Cookie', cookieOf(login));
      expect(ok.status).toBe(200);
      expect(ok.body).toEqual({ signed_in: true });
      const no = await request(app).get('/api/staff/session');
      expect(no.status).toBe(401);
      expect(no.body.error.code).toBe('UNAUTHORIZED');
    });
  });

  describe('POST /api/staff/logout', () => {
    it('answers 204, clears the cookie and ends the session', async () => {
      const login = await request(app).post('/api/staff/login').send({ pin: PIN });
      const cookie = cookieOf(login);
      const out = await request(app).post('/api/staff/logout').set('Cookie', cookie);
      expect(out.status).toBe(204);
      expect((out.headers['set-cookie'] as unknown as string[])[0]).toMatch(/staff_session=;.*Max-Age=0/);
      // The old cookie no longer works
      expect((await request(app).get('/api/staff/session').set('Cookie', cookie)).status).toBe(401);
    });

    it('without a session it is 401, like every staff route', async () => {
      expect((await request(app).post('/api/staff/logout')).status).toBe(401);
    });

    it('regression: a session that has already ended is answered 401 and the old cookie is cleared', async () => {
      const login = await request(app).post('/api/staff/login').send({ pin: PIN });
      const cookie = cookieOf(login);
      expect((await request(app).post('/api/staff/logout').set('Cookie', cookie)).status).toBe(204);

      // The browser still holds the dead cookie and signs out again (another tab, the 12-hour end)
      const again = await request(app).post('/api/staff/logout').set('Cookie', cookie);
      expect(again.status).toBe(401);
      expect(again.body).toEqual({ error: { code: 'UNAUTHORIZED', message: expect.any(String) } });
      const cleared = (again.headers['set-cookie'] as unknown as string[] | undefined)?.[0] ?? '';
      expect(cleared).toMatch(/^staff_session=;/);
      expect(cleared).toContain('Max-Age=0');
      expect(cleared).toContain('HttpOnly');
      expect(cleared).toContain('Path=/');
    });

    it('a made-up cookie and no cookie at all are both answered 401 with the cookie cleared', async () => {
      for (const req of [request(app).post('/api/staff/logout').set('Cookie', 'staff_session=0123456789abcdef0123456789abcdef'), request(app).post('/api/staff/logout')]) {
        const res = await req;
        expect(res.status).toBe(401);
        expect((res.headers['set-cookie'] as unknown as string[])[0]).toMatch(/staff_session=;.*Max-Age=0/);
      }
    });

    it('a signed-in logout still answers 204 with the cleared cookie (the 204 case is unchanged)', async () => {
      const login = await request(app).post('/api/staff/login').send({ pin: PIN });
      const out = await request(app).post('/api/staff/logout').set('Cookie', cookieOf(login));
      expect(out.status).toBe(204);
      expect((out.headers['set-cookie'] as unknown as string[])[0]).toMatch(/staff_session=;.*Max-Age=0/);
    });
  });

  describe('the staff live stream (BR1.9)', () => {
    let server: http.Server;
    let port: number;
    const open: http.ClientRequest[] = [];
    beforeEach(async () => {
      server = app.listen(0);
      await new Promise((r) => server.once('listening', r));
      port = (server.address() as AddressInfo).port;
    });
    afterEach(async () => {
      open.splice(0).forEach((r) => r.destroy());
      await new Promise((r) => server.close(r));
    });

    /** Opens a stream and reports what it received and when the server ended it. */
    function openStream(cookie?: string) {
      return new Promise<{ status: number; text: () => string; ended: Promise<void> }>((resolve) => {
        let text = '';
        const req = http.get({ port, path: '/sse/staff', headers: cookie ? { Cookie: cookie } : {} }, (res) => {
          res.setEncoding('utf8');
          res.on('data', (c: string) => (text += c));
          const ended = new Promise<void>((done) => res.on('end', () => done()));
          resolve({ status: res.statusCode ?? 0, text: () => text, ended });
        });
        req.on('error', () => undefined);
        open.push(req);
      });
    }

    it('needs the cookie and then receives HELLO', async () => {
      const refused = await openStream();
      expect(refused.status).toBe(401);
      expect(refused.text()).toContain('UNAUTHORIZED');

      const login = await request(app).post('/api/staff/login').send({ pin: PIN });
      const stream = await openStream(cookieOf(login));
      expect(stream.status).toBe(200);
      await new Promise((r) => setTimeout(r, 100));
      expect(stream.text()).toContain('event: HELLO');
    });

    it('signing out closes the session\'s open stream at once', async () => {
      const login = await request(app).post('/api/staff/login').send({ pin: PIN });
      const cookie = cookieOf(login);
      const stream = await openStream(cookie);
      expect(stream.status).toBe(200);

      await request(app).post('/api/staff/logout').set('Cookie', cookie);
      await Promise.race([
        stream.ended,
        new Promise((_, reject) => setTimeout(() => reject(new Error('the staff stream stayed open after sign-out')), 2000)),
      ]);
    });
  });
});
