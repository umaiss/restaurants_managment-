// U7 Steps 7 and 9: the menu management routes, and that every successful write is published (BR5.1 to BR5.5).
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
import { staffCookie } from '../helpers/staff.js';
import { cleanup, freshApp } from './setup.js';

const as = (r: request.Test) => r.set('Cookie', staffCookie());
const get = (url: string) => as(request(app).get(url));
const post = (url: string, body: object) => as(request(app).post(url)).send(body);
const patch = (url: string, body: object) => as(request(app).patch(url)).send(body);
const put = (url: string, body: object) => as(request(app).put(url)).send(body);
const menuEvents = () => published.filter((e) => e.type === 'MENU_CHANGED');

describe('GET /api/staff/menu (BR5.1)', () => {
  beforeEach(() => { freshApp(); published.length = 0; });
  afterEach(cleanup);

  it('answers the whole menu with hidden items, categories, stations, allergens and options', async () => {
    await patch('/api/staff/menu/items/i-07', { hidden: true });
    const res = await get('/api/staff/menu');
    expect(res.status).toBe(200);
    expect(res.body.categories).toHaveLength(4);
    expect(res.body.items).toHaveLength(12);
    const carbonara = res.body.items.find((i: any) => i.id === 'i-07');
    expect(carbonara.hidden).toBe(true);
    const burger = res.body.items.find((i: any) => i.id === 'i-04');
    expect(burger).toMatchObject({ station: 'Grill', allergens: ['gluten', 'dairy', 'sesame'] });
    expect(burger.options.map((g: any) => g.name)).toEqual(['Size', 'Extras', 'Leave out']);
    expect(res.body.items.find((i: any) => i.id === 'i-05').allergens).toBeNull();
  });

  it('401 without a session', async () => {
    expect((await request(app).get('/api/staff/menu')).status).toBe(401);
  });
});

describe('items', () => {
  beforeEach(() => { freshApp(); published.length = 0; });
  afterEach(cleanup);
  const body = { name: 'Tomato Soup', price_cents: 700, category_id: 'c-01' };

  it('POST answers 201 with the whole item, and publishes MENU_CHANGED reason item with its id (BR5.5)', async () => {
    const res = await post('/api/staff/menu/items', body);
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ name: 'Tomato Soup', available: true, hidden: false, station: 'Grill', options: [] });
    expect(menuEvents().map((e) => [e.channel, e.data])).toContainEqual(['staff', { reason: 'item', ids: [res.body.id] }]);
    for (let t = 1; t <= 10; t++) expect(menuEvents().some((e) => e.channel === `table:${t}`)).toBe(true);
  });

  it('PATCH answers 200 with the updated item and publishes', async () => {
    const res = await patch('/api/staff/menu/items/i-02', { price_cents: 900, name: 'Garden Salad' });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: 'i-02', price_cents: 900, name: 'Garden Salad' });
    expect(menuEvents().find((e) => e.channel === 'staff')!.data).toEqual({ reason: 'item', ids: ['i-02'] });
  });

  it('hiding and showing are PATCHes and publish', async () => {
    await patch('/api/staff/menu/items/i-02', { hidden: true });
    expect((await request(app).get('/api/menu')).body.items.some((i: any) => i.id === 'i-02')).toBe(false);
    await patch('/api/staff/menu/items/i-02', { hidden: false });
    expect((await request(app).get('/api/menu')).body.items.some((i: any) => i.id === 'i-02')).toBe(true);
    expect(menuEvents().filter((e) => e.channel === 'staff')).toHaveLength(2);
  });

  it('400 INVALID_REQUEST with the field named, nothing saved and nothing published', async () => {
    const res = await post('/api/staff/menu/items', { ...body, name: 'x'.repeat(61) });
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: { code: 'INVALID_REQUEST', message: expect.any(String), details: { field: 'name' } } });
    expect(published).toEqual([]);
    expect((await get('/api/staff/menu')).body.items).toHaveLength(12);
  });

  it('404 UNKNOWN_ITEM for an unknown id', async () => {
    const res = await patch('/api/staff/menu/items/i-nope', { name: 'x' });
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('UNKNOWN_ITEM');
    expect(published).toEqual([]);
  });

  it('there is no delete route: DELETE answers the page (not a deletion)', async () => {
    const res = await as(request(app).delete('/api/staff/menu/items/i-02'));
    expect(res.status).not.toBe(204);
    expect((await get('/api/staff/menu')).body.items.some((i: any) => i.id === 'i-02')).toBe(true);
  });

  it('401 without a session for every write, and nothing changes', async () => {
    for (const [method, url] of [['post', '/api/staff/menu/items'], ['patch', '/api/staff/menu/items/i-02'], ['put', '/api/staff/menu/items/i-02/options'], ['post', '/api/staff/menu/categories'], ['patch', '/api/staff/menu/categories/c-01']] as const) {
      const res = await request(app)[method](url).send({ name: 'x', price_cents: 1, category_id: 'c-01', groups: [] });
      expect(res.status, `${method} ${url}`).toBe(401);
    }
    expect(published).toEqual([]);
  });
});

describe('options', () => {
  beforeEach(() => { freshApp(); published.length = 0; });
  afterEach(cleanup);

  it('PUT answers 200 with the groups and their ids, and publishes reason options', async () => {
    const res = await put('/api/staff/menu/items/i-10/options', { groups: [{ name: 'Ice', kind: 'one', required: true, choices: [{ label: 'With', price_delta_cents: 0 }, { label: 'Without', price_delta_cents: 0 }] }] });
    expect(res.status).toBe(200);
    expect(res.body.item_id).toBe('i-10');
    expect(res.body.options[0]).toMatchObject({ name: 'Ice', kind: 'one', required: true });
    expect(res.body.options[0].id).toMatch(/^og-/);
    expect(res.body.options[0].choices.map((c: any) => c.label)).toEqual(['With', 'Without']);
    expect(menuEvents().find((e) => e.channel === 'staff')!.data).toEqual({ reason: 'options', ids: ['i-10'] });
  });

  it('a diner order uses the new groups at once (a required group is enforced)', async () => {
    await put('/api/staff/menu/items/i-10/options', { groups: [{ name: 'Ice', kind: 'one', required: true, choices: [{ label: 'With' }] }] });
    const res = await request(app).post('/api/tables/3/orders').send({ placement_key: 'k1', lines: [{ menu_item_id: 'i-10', quantity: 1 }] });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_OPTIONS');
  });

  it('400 with the nested field name, and nothing saved or published', async () => {
    const res = await put('/api/staff/menu/items/i-10/options', { groups: [{ name: 'Bad', kind: 'any', choices: [{ label: 'x', price_delta_cents: -999 }] }] });
    expect(res.status).toBe(400);
    expect(res.body.error.details.field).toBe('groups[0].choices[0].price_delta_cents');
    expect(published).toEqual([]);
    expect((await get('/api/staff/menu')).body.items.find((i: any) => i.id === 'i-10').options).toEqual([]);
  });

  it('404 UNKNOWN_ITEM', async () => {
    expect((await put('/api/staff/menu/items/nope/options', { groups: [] })).status).toBe(404);
  });
});

describe('categories', () => {
  beforeEach(() => { freshApp(); published.length = 0; });
  afterEach(cleanup);

  it('POST answers 201 and publishes reason category', async () => {
    const res = await post('/api/staff/menu/categories', { name: 'Sides' });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ name: 'Sides', order: 5, hidden: false });
    expect(menuEvents().find((e) => e.channel === 'staff')!.data).toEqual({ reason: 'category', ids: [res.body.id] });
  });

  it('PATCH renames, hides and moves, and answers the category', async () => {
    const res = await patch('/api/staff/menu/categories/c-02', { name: 'Big plates', move: 'up' });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: 'c-02', name: 'Big plates', order: 1 });
    expect((await patch('/api/staff/menu/categories/c-02', { hidden: true })).body.hidden).toBe(true);
  });

  it('400 for a duplicate name, 404 UNKNOWN_CATEGORY for an unknown id, and nothing published for either', async () => {
    const dup = await post('/api/staff/menu/categories', { name: 'DRINKS' });
    expect(dup.status).toBe(400);
    expect(dup.body.error.details.field).toBe('name');
    const nope = await patch('/api/staff/menu/categories/c-99', { name: 'x' });
    expect(nope.status).toBe(404);
    expect(nope.body.error.code).toBe('UNKNOWN_CATEGORY');
    expect(published).toEqual([]);
  });
});
