// U8 Step 7: the TV wall routes and the TV_SETTINGS_CHANGED event (BR1.2, BR1.3, BR6.1, BR6.2, C1, C2, C3).
process.env.DB_FILE = ':memory:';

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';

const sse = vi.hoisted(() => ({
  published: [] as Array<{ channel: string; type: string; data: any; savedAtPublish: unknown }>,
  /** Read at the moment of publishing, so a test can check the save came first. */
  probe: null as null | (() => unknown),
}));
vi.mock('../../sse.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../sse.js')>();
  return {
    ...actual,
    publish: (channel: string, type: string, data: unknown) => {
      sse.published.push({ channel, type, data, savedAtPublish: sse.probe?.() });
      actual.publish(channel, type, data);
    },
  };
});

import { app } from '../../index.js';
import { getDb } from '../../db.js';
import { STAFF_IDLE_MS } from '../../config.js';
import { isSessionValid, signIn } from '../../staffAccess.js';
import { getTvSettings } from '../../tvSettings.js';
import { staffCookie } from '../helpers/staff.js';
import { cleanup, freshApp } from './fixtures.js';

const tvEvents = () => sse.published.filter((e) => e.type === 'TV_SETTINGS_CHANGED');
const put = (body: unknown) => request(app).put('/api/staff/tv/settings').set('Cookie', staffCookie()).send(body as object);

describe('the TV wall routes (BR6.1, BR6.2)', () => {
  beforeEach(() => {
    freshApp();
    sse.published.length = 0;
    sse.probe = () => getTvSettings();
  });
  afterEach(() => {
    sse.probe = null;
    vi.restoreAllMocks();
    cleanup();
  });

  it.each([
    ['get', '/api/staff/tv/summary'],
    ['get', '/api/staff/tv/settings'],
    ['put', '/api/staff/tv/settings'],
  ] as const)('%s %s answers 401 UNAUTHORIZED without a session, with no data and nothing changed', async (method, url) => {
    const res = await request(app)[method](url).send({ show_takings: true });
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: { code: 'UNAUTHORIZED', message: 'Staff sign-in is required.' } });
    expect(getTvSettings().show_takings).toBe(false);
    expect(tvEvents()).toHaveLength(0);
  });

  it('a summary read refreshes the session, so an open TV wall is not signed out by the idle limit', async () => {
    const createdAt = Date.now() - STAFF_IDLE_MS + 60_000; // one minute before the idle end
    const token = signIn('u8-tv-idle-test', process.env.STAFF_PIN, createdAt);
    const res = await request(app).get('/api/staff/tv/summary').set('Cookie', `staff_session=${token}`);
    expect(res.status).toBe(200);
    // Without the refresh the session would have ended a minute from now; it is still valid long after.
    expect(isSessionValid(token, Date.now() + STAFF_IDLE_MS - 60_000)).toBe(true);
  });

  it('the summary answers C1, with no takings key on a fresh database', async () => {
    const res = await request(app).get('/api/staff/tv/summary').set('Cookie', staffCookie());
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/json/);
    expect(Object.keys(res.body).sort()).toEqual(['busiest_table', 'day', 'day_ends_at', 'orders', 'requests', 'server_time', 'show_takings', 'top_dish']);
    expect(res.body.show_takings).toBe(false);
  });
});

describe('PUT and GET /api/staff/tv/settings (BR1.2, BR1.3, C3)', () => {
  beforeEach(() => {
    freshApp();
    sse.published.length = 0;
    sse.probe = () => getTvSettings();
  });
  afterEach(() => {
    sse.probe = null;
    vi.restoreAllMocks();
    cleanup();
  });

  it('a round trip: GET reads hidden, PUT true answers the new setting, GET reads it back, and the summary then carries takings', async () => {
    const before = await request(app).get('/api/staff/tv/settings').set('Cookie', staffCookie());
    expect(before.status).toBe(200);
    expect(before.body).toEqual({ show_takings: false, updated_at: null });

    const changed = await put({ show_takings: true });
    expect(changed.status).toBe(200);
    expect(changed.body.show_takings).toBe(true);
    expect(Date.parse(changed.body.updated_at)).not.toBeNaN();

    const after = await request(app).get('/api/staff/tv/settings').set('Cookie', staffCookie());
    expect(after.body).toEqual(changed.body);
    const summary = await request(app).get('/api/staff/tv/summary').set('Cookie', staffCookie());
    expect(summary.body.takings).toEqual({ closed_cents: 0, open_cents: 0 });
  });

  it.each([
    ['a missing field', {}],
    ['a value that is not a boolean', { show_takings: 'true' }],
    ['an extra field', { show_takings: true, colour: 'red' }],
    ['a body that is not an object', [true]],
  ])('400 INVALID_REQUEST for %s, nothing saved and nothing published', async (_what, body) => {
    const res = await put(body);
    expect(res.status).toBe(400);
    expect(res.body.error).toMatchObject({ code: 'INVALID_REQUEST', details: { field: 'show_takings' } });
    expect(getTvSettings()).toEqual({ show_takings: false, updated_at: null });
    expect(tvEvents()).toHaveLength(0);
  });

  it('a change publishes exactly one TV_SETTINGS_CHANGED on the staff channel, after the save, with the new value', async () => {
    const res = await put({ show_takings: true });
    expect(tvEvents()).toHaveLength(1);
    const [event] = tvEvents();
    expect(event.channel).toBe('staff');
    expect(event.data).toEqual({ show_takings: true, updated_at: res.body.updated_at });
    expect(event.savedAtPublish).toEqual({ show_takings: true, updated_at: res.body.updated_at }); // already saved when published
  });

  it('the same value again publishes nothing and keeps updated_at', async () => {
    const first = await put({ show_takings: true });
    sse.published.length = 0;
    await new Promise((r) => setTimeout(r, 5));
    const again = await put({ show_takings: true });
    expect(again.status).toBe(200);
    expect(again.body).toEqual(first.body);
    expect(tvEvents()).toHaveLength(0);
    // hidden while already hidden (no row) is also unchanged
    getDb().exec('DELETE FROM tv_settings');
    const hidden = await put({ show_takings: false });
    expect(hidden.body).toEqual({ show_takings: false, updated_at: null });
    expect(tvEvents()).toHaveLength(0);
  });

  it('a failed save answers 500 INTERNAL_ERROR, is logged, and publishes nothing; a failed summary read is a logged 500 too', async () => {
    const logged = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    getDb().exec('DROP TABLE tv_settings');
    const res = await put({ show_takings: true });
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } });
    expect(tvEvents()).toHaveLength(0);
    const summary = await request(app).get('/api/staff/tv/summary').set('Cookie', staffCookie());
    expect(summary.status).toBe(500);
    const settings = await request(app).get('/api/staff/tv/settings').set('Cookie', staffCookie());
    expect(settings.status).toBe(500);
    expect(logged.mock.calls.map((c) => String(c[0]))).toEqual([
      'PUT /api/staff/tv/settings error:',
      'GET /api/staff/tv/summary error:',
      'GET /api/staff/tv/settings error:',
    ]);
  });
});
