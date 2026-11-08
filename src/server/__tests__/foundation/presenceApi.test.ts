// U5 Step 10: the heartbeat route and the page parameter on the table stream (BR8.1 to BR8.3).
process.env.DB_FILE = ':memory:';

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import http from 'http';
import type { AddressInfo } from 'net';
import request from 'supertest';
import { app } from '../../index.js';
import { resetDb, seedIfEmpty } from '../../db.js';
import { _resetForTest } from '../../sse.js';
import { getPresence, resetPresenceForTest, _presenceSizes } from '../../presence.js';
import { staffCookie } from '../helpers/staff.js';

const settle = (ms = 150) => new Promise((r) => setTimeout(r, ms));

describe('presence API', () => {
  let server: http.Server;
  let port: number;
  const open: http.ClientRequest[] = [];

  beforeEach(async () => {
    resetDb();
    seedIfEmpty();
    _resetForTest();
    resetPresenceForTest();
    server = app.listen(0);
    await new Promise((r) => server.once('listening', r));
    port = (server.address() as AddressInfo).port;
  });
  afterEach(async () => {
    open.splice(0).forEach((r) => r.destroy());
    await settle(50);
    await new Promise((r) => server.close(r));
    resetPresenceForTest();
    resetDb();
  });

  /** Opens a stream; returns what it received and a function that closes it from the client side. */
  function openStream(path: string, headers: http.OutgoingHttpHeaders = {}) {
    return new Promise<{ status: number; text: () => string; close: () => void }>((resolve) => {
      let text = '';
      const req = http.get({ port, path, headers }, (res) => {
        res.setEncoding('utf8');
        res.on('data', (c: string) => (text += c));
        resolve({ status: res.statusCode ?? 0, text: () => text, close: () => req.destroy() });
      });
      req.on('error', () => undefined);
      open.push(req);
    });
  }

  describe('POST /api/tables/:id/presence (heartbeat)', () => {
    it('answers 204 and records a sign of life for the page id', async () => {
      const res = await request(app).post('/api/tables/3/presence').send({ page_id: 'page-heart-01' });
      expect(res.status).toBe(204);
      // A heartbeat alone is not an open page: it needs the stream too
      expect(getPresence(3).connected).toBe(0);
    });

    it('refuses a page id that does not match the allowed form with 400 INVALID_REQUEST', async () => {
      for (const page_id of ['short', 'has space in it', 'x'.repeat(65), 12345678, '', null, undefined]) {
        const res = await request(app).post('/api/tables/3/presence').send({ page_id });
        expect(res.status).toBe(400);
        expect(res.body.error).toMatchObject({ code: 'INVALID_REQUEST', details: { field: 'page_id' } });
      }
      expect(_presenceSizes().pages).toBe(0);
    });

    it('a table that does not exist is 404 UNKNOWN_TABLE, and nothing is remembered for it', async () => {
      const res = await request(app).post('/api/tables/99/presence').send({ page_id: 'page-heart-01' });
      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('UNKNOWN_TABLE');
      expect((await request(app).post('/api/tables/3x/presence').send({ page_id: 'page-heart-01' })).status).toBe(404);
      expect(_presenceSizes().pages).toBe(0);
    });
  });

  describe('GET /sse/tables/:id?page=', () => {
    it('a page with its stream open counts as present, and closing it removes it at once', async () => {
      const stream = await openStream('/sse/tables/3?page=page-aaaa1111');
      expect(stream.status).toBe(200);
      await settle();
      expect(getPresence(3).connected).toBe(1);
      expect(getPresence(4).connected).toBe(0);

      stream.close();
      await settle();
      expect(getPresence(3).connected).toBe(0);
      expect(_presenceSizes().pages).toBe(0);
    });

    it('the heartbeat with the same page id does not make it count twice', async () => {
      await openStream('/sse/tables/3?page=page-aaaa1111');
      await settle();
      await request(app).post('/api/tables/3/presence').send({ page_id: 'page-aaaa1111' });
      expect(getPresence(3).connected).toBe(1);
    });

    it('a stream opened without a page id (an older client) is counted for as long as it lasts', async () => {
      const stream = await openStream('/sse/tables/3');
      await settle();
      expect(getPresence(3).connected).toBe(1);
      stream.close();
      await settle();
      expect(getPresence(3).connected).toBe(0);
    });

    it('a bad page id is 400 INVALID_REQUEST and opens no stream', async () => {
      const res = await request(app).get('/sse/tables/3?page=no');
      expect(res.status).toBe(400);
      expect(res.body.error).toMatchObject({ code: 'INVALID_REQUEST', details: { field: 'page' } });
      expect(getPresence(3).connected).toBe(0);
    });

    it('a stream to a table that does not exist still opens (as in v1) but is not remembered', async () => {
      const stream = await openStream('/sse/tables/99?page=page-ghost-99');
      expect(stream.status).toBe(200);
      await settle();
      expect(_presenceSizes().pages).toBe(0);
    });

    it('staff are told: TABLE_PRESENCE_CHANGED reaches the staff stream with the table and count, never the table channel', async () => {
      const staff = await openStream('/sse/staff', { Cookie: staffCookie() });
      const sameTable = await openStream('/sse/tables/3?page=page-watcher-1');
      await settle();
      // Both opened; the staff stream saw the first page arrive (the watcher itself)
      expect(staff.text()).toContain('event: TABLE_PRESENCE_CHANGED');
      expect(staff.text()).toMatch(/"table_id":3,"connected":1/);
      // The table channel is not told about presence (staff channel only)
      expect(sameTable.text()).not.toContain('TABLE_PRESENCE_CHANGED');

      await openStream('/sse/tables/3?page=page-second-02');
      await settle(1300); // inside the 1-second merge window the second page waits, then goes out
      expect(staff.text()).toMatch(/"table_id":3,"connected":2/);
    });
  });
});
