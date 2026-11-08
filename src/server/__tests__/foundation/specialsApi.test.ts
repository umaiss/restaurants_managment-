// U5 Step 10: Chef's special routes and the expiry check (BR5.1, BR5.2, BR5.5, BR9.1).
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
import { checkSpecialExpiry, startBackgroundJobs, stopBackgroundJobs } from '../../background.js';
import { staffCookie } from '../helpers/staff.js';

const valid = { item_id: 'i-04', special_price_cents: 1000, stock: 5, minutes: 30 };
const launch = (body: object = valid) => request(app).post('/api/specials').set('Cookie', staffCookie()).send(body);
const specialEvents = () => published.filter((e) => e.type === 'SPECIAL_CHANGED');

describe('Chef\'s special API', () => {
  beforeEach(() => {
    resetDb();
    seedIfEmpty();
    published.length = 0;
  });
  afterEach(() => {
    stopBackgroundJobs();
    vi.useRealTimers();
    resetDb();
  });

  it('launches a special: 201 with the special, and SPECIAL_CHANGED goes to staff and every table', async () => {
    const res = await launch();
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ item_id: 'i-04', name: 'Classic Burger', special_price_cents: 1000, stock_left: 5 });
    expect(res.body.ends_at).toMatch(/^\d{4}-\d{2}-\d{2}T.*Z$/);

    const channels = specialEvents().map((e) => e.channel);
    expect(channels).toContain('staff');
    for (let t = 1; t <= 10; t++) expect(channels).toContain(`table:${t}`);
    for (const e of specialEvents()) expect(e.data.special.id).toBe(res.body.id);

    const current = await request(app).get('/api/specials/current');
    expect(current.body.special).toEqual({
      id: res.body.id,
      item_id: 'i-04',
      name: 'Classic Burger',
      special_price_cents: 1000,
      stock_left: 5,
      ends_at: res.body.ends_at,
    });
  });

  it('a new launch ends the live one: only the new special is current', async () => {
    const first = await launch();
    const second = await launch({ ...valid, item_id: 'i-06' });
    expect(second.status).toBe(201);
    const current = await request(app).get('/api/specials/current');
    expect(current.body.special.id).toBe(second.body.id);
    expect(current.body.special.id).not.toBe(first.body.id);
  });

  it.each([
    ['item_id', { ...valid, item_id: 'nope' }],
    ['special_price_cents', { ...valid, special_price_cents: 0 }],
    ['stock', { ...valid, stock: 1000 }],
    ['minutes', { ...valid, minutes: 721 }],
  ])('a bad %s is 400 INVALID_REQUEST with details.field, and publishes nothing', async (field, body) => {
    const res = await launch(body);
    expect(res.status).toBe(400);
    expect(res.body.error).toMatchObject({ code: 'INVALID_REQUEST', details: { field } });
    expect(specialEvents()).toHaveLength(0);
  });

  it('with no body at all it is 400 INVALID_REQUEST, not a 500', async () => {
    const res = await request(app).post('/api/specials').set('Cookie', staffCookie());
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_REQUEST');
  });

  it('GET current is null when there is none, and needs no session', async () => {
    const res = await request(app).get('/api/specials/current');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ special: null });
  });

  it('DELETE ends it at once: 204 and SPECIAL_CHANGED with null; ending when there is none is 204 and silent', async () => {
    await launch();
    published.length = 0;
    const res = await request(app).delete('/api/specials/current').set('Cookie', staffCookie());
    expect(res.status).toBe(204);
    expect(specialEvents().length).toBeGreaterThan(0);
    for (const e of specialEvents()) expect(e.data).toEqual({ special: null });
    expect((await request(app).get('/api/specials/current')).body.special).toBeNull();

    published.length = 0;
    const again = await request(app).delete('/api/specials/current').set('Cookie', staffCookie());
    expect(again.status).toBe(204);
    expect(specialEvents()).toHaveLength(0);
  });

  describe('expiry (BR5.5)', () => {
    it('the check publishes null once when the special\'s time has passed', async () => {
      await launch({ ...valid, minutes: 5 });
      published.length = 0;
      checkSpecialExpiry(new Date(Date.now() + 4 * 60_000));
      expect(specialEvents()).toHaveLength(0);

      checkSpecialExpiry(new Date(Date.now() + 5 * 60_000 + 1000));
      expect(specialEvents().length).toBeGreaterThan(0);
      for (const e of specialEvents()) expect(e.data).toEqual({ special: null });

      published.length = 0;
      checkSpecialExpiry(new Date(Date.now() + 6 * 60_000));
      expect(specialEvents()).toHaveLength(0); // once only
    });

    it('runs by itself every 5 seconds once the background jobs are started', async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-11-08T12:00:00.000Z'));
      await launch({ ...valid, minutes: 1 });
      published.length = 0;
      startBackgroundJobs();
      vi.advanceTimersByTime(55_000);
      expect(specialEvents()).toHaveLength(0);
      vi.advanceTimersByTime(10_000); // past the end time; the next 5-second tick notices
      expect(specialEvents().length).toBeGreaterThan(0);
      expect(specialEvents()[0].data).toEqual({ special: null });
      const rows = getDb().prepare('SELECT ended_at FROM chef_specials').all() as Array<{ ended_at: string | null }>;
      expect(rows[0].ended_at).not.toBeNull();
    });

    it('a failing check does not stop the server: the error is logged and the next tick tries again', () => {
      const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
      resetDb();
      process.env.DB_FILE = '/this/folder/does/not/exist/db.sqlite';
      expect(() => checkSpecialExpiry()).not.toThrow();
      expect(error).toHaveBeenCalled();
      process.env.DB_FILE = ':memory:';
      error.mockRestore();
    });
  });
});
