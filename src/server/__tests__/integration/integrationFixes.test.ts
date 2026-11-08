// Integration fixes at the meeting point of U5, U6 and U7 (findings 1, 2 and 4): a special and the hidden or
// sold-out state of its item, a special with a negative option, and an item edit that is saved all at once.
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
import { getDb } from '../../db.js';
import { staffCookie } from '../helpers/staff.js';
import { cleanup, freshApp } from '../u7/setup.js';

const as = (r: request.Test) => r.set('Cookie', staffCookie());
const get = (url: string) => as(request(app).get(url));
const post = (url: string, body: object) => as(request(app).post(url)).send(body);
const patch = (url: string, body: object) => as(request(app).patch(url)).send(body);
const put = (url: string, body: object) => as(request(app).put(url)).send(body);
const current = async () => (await request(app).get('/api/specials/current')).body.special;
const specialEvents = () => published.filter((e) => e.type === 'SPECIAL_CHANGED' && e.channel === 'table:5');
const launch = (item_id: string, price = 500) => post('/api/specials', { item_id, special_price_cents: price, stock: 5, minutes: 30 });
const place = (lines: object[], key = `k-${Math.random()}`) => request(app).post('/api/tables/5/orders').send({ placement_key: key, lines });

beforeEach(() => {
  freshApp();
  published.length = 0;
});
afterEach(cleanup);

describe('finding 1: a special whose item is hidden, in a hidden category or sold out is not live', () => {
  it('regression: hiding the item ends the live special for the diner and publishes SPECIAL_CHANGED with null', async () => {
    const sp = await launch('i-02');
    expect(sp.status).toBe(201);
    expect((await current()).item_id).toBe('i-02');
    published.length = 0;
    expect((await patch('/api/staff/menu/items/i-02', { hidden: true })).status).toBe(200);
    expect(await current()).toBeNull();
    expect(specialEvents().map((e) => e.data)).toEqual([{ special: null }]);
  });

  it('regression: hiding the item\'s category does the same, and showing it again brings the special back with an event', async () => {
    await launch('i-02'); // a Starter (c-01)
    published.length = 0;
    await patch('/api/staff/menu/categories/c-01', { hidden: true });
    expect(await current()).toBeNull();
    expect(specialEvents().map((e) => e.data.special)).toEqual([null]);
    await patch('/api/staff/menu/categories/c-01', { hidden: false });
    expect((await current()).item_id).toBe('i-02');
    expect(specialEvents()).toHaveLength(2);
    expect(specialEvents()[1].data.special.item_id).toBe('i-02');
  });

  it('regression: selling the item out through the v1 sold-out route does the same', async () => {
    await launch('i-02');
    published.length = 0;
    expect((await as(request(app).post('/api/menu/items/i-02/availability')).send({ available: false })).status).toBe(200);
    expect(await current()).toBeNull();
    expect(specialEvents().map((e) => e.data)).toEqual([{ special: null }]);
    await as(request(app).post('/api/menu/items/i-02/availability')).send({ available: true });
    expect((await current()).item_id).toBe('i-02');
  });

  it('an options change or a change to another item publishes no SPECIAL_CHANGED', async () => {
    await launch('i-02');
    published.length = 0;
    await put('/api/staff/menu/items/i-02/options', { groups: [{ name: 'Dressing', kind: 'one', choices: [{ label: 'Oil' }] }] });
    await patch('/api/staff/menu/items/i-07', { hidden: true });
    expect(specialEvents()).toEqual([]);
  });

  it('an order cannot take such a special: a sold-out item drops the line, a hidden one is refused', async () => {
    const sp = (await launch('i-02')).body;
    await as(request(app).post('/api/menu/items/i-02/availability')).send({ available: false });
    const soldOut = await place([{ menu_item_id: 'i-02', quantity: 1, special_id: sp.id }]);
    expect(soldOut.status).toBe(400);
    expect(soldOut.body.error.code).toBe('EMPTY_ORDER');
    await as(request(app).post('/api/menu/items/i-02/availability')).send({ available: true });
    await patch('/api/staff/menu/items/i-02', { hidden: true });
    const hidden = await place([{ menu_item_id: 'i-02', quantity: 1, special_id: sp.id }]);
    expect(hidden.status).toBe(400);
    expect(hidden.body.error.code).toBe('UNKNOWN_ITEM');
  });
});

describe('finding 2: a special and a negative option', () => {
  const discount = (cents: number) => ({ groups: [{ name: 'Voucher', kind: 'any', choices: [{ label: 'Voucher', price_delta_cents: -cents }] }] });

  it('regression: launching a special whose price plus the cheapest options is below zero is refused on special_price_cents', async () => {
    expect((await put('/api/staff/menu/items/i-04/options', discount(900))).status).toBe(200); // 14.50 - 9.00 is fine
    const res = await launch('i-04', 500); // 5.00 - 9.00 < 0
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_REQUEST');
    expect(res.body.error.details.field).toBe('special_price_cents');
    expect(res.body.error.message).toMatch(/below \$0\.00|less than \$0\.00/);
    expect(await current()).toBeNull();
  });

  it('launches when the cheapest possible price is not below zero', async () => {
    await put('/api/staff/menu/items/i-04/options', discount(900));
    expect((await launch('i-04', 900)).status).toBe(201);
  });

  it('regression: replacing the options is checked against a live special\'s price, not only the regular price', async () => {
    expect((await launch('i-04', 500)).status).toBe(201);
    const refused = await put('/api/staff/menu/items/i-04/options', discount(900)); // fine against 14.50, below zero against 5.00
    expect(refused.status).toBe(400);
    expect(refused.body.error.details.field).toMatch(/price_delta_cents/);
    expect((await put('/api/staff/menu/items/i-04/options', discount(400))).status).toBe(200);
  });

  it('a special on another item does not change the check', async () => {
    await launch('i-02', 100);
    expect((await put('/api/staff/menu/items/i-04/options', discount(900))).status).toBe(200);
  });
});

describe('finding 4: an item edit with its options is saved all at once', () => {
  const getItem = async (id: string) => (await get('/api/staff/menu')).body.items.find((i: any) => i.id === id);
  const negative = { groups: [{ name: 'Voucher', kind: 'any', choices: [{ label: 'Voucher', price_delta_cents: -900 }] }] };

  it('regression: lowering the price and dropping the negative option in one PATCH is accepted', async () => {
    await put('/api/staff/menu/items/i-02/options', negative); // 8.50 - 9.00 is below zero? it is refused:
    // (8.50 is below 9.00, so set the price high first)
    await patch('/api/staff/menu/items/i-02', { price_cents: 1200 });
    expect((await put('/api/staff/menu/items/i-02/options', negative)).status).toBe(200);
    // lowering the price alone is refused against the OLD options ...
    const alone = await patch('/api/staff/menu/items/i-02', { price_cents: 400 });
    expect(alone.status).toBe(400);
    expect(alone.body.error.details.field).toBe('price_cents');
    // ... but together with the new options (the voucher dropped) it is valid
    const both = await patch('/api/staff/menu/items/i-02', { price_cents: 400, options: [] });
    expect(both.status).toBe(200);
    expect(both.body.price_cents).toBe(400);
    expect(both.body.options).toEqual([]);
  });

  it('regression: an invalid options array leaves the price (and everything else) unchanged', async () => {
    const before = await getItem('i-04');
    const res = await patch('/api/staff/menu/items/i-04', { price_cents: 100, name: 'Changed', options: [{ name: '', kind: 'one', choices: [{ label: 'x' }] }] });
    expect(res.status).toBe(400);
    const after = await getItem('i-04');
    expect(after.price_cents).toBe(before.price_cents);
    expect(after.name).toBe(before.name);
    expect(after.options).toEqual(before.options);
  });

  it('a new price that is below zero against the NEW options is refused and nothing is saved', async () => {
    const before = await getItem('i-02');
    const res = await patch('/api/staff/menu/items/i-02', { price_cents: 300, options: negative.groups });
    expect(res.status).toBe(400);
    expect((await getItem('i-02')).price_cents).toBe(before.price_cents);
    expect((await getItem('i-02')).options).toEqual(before.options);
  });

  it('keeps the ids of groups and choices that are listed with their id', async () => {
    const burger = await getItem('i-04');
    const groups = burger.options.map((g: any) => ({ id: g.id, name: g.name, kind: g.kind, required: g.required, choices: g.choices.map((c: any) => ({ id: c.id, label: c.label, price_delta_cents: c.price_delta_cents })) }));
    groups[0].choices[1].price_delta_cents = 350;
    const res = await patch('/api/staff/menu/items/i-04', { price_cents: 1500, options: groups });
    expect(res.status).toBe(200);
    expect(res.body.options.map((g: any) => g.id)).toEqual(burger.options.map((g: any) => g.id));
    expect(res.body.options[0].choices.map((c: any) => c.id)).toEqual(burger.options[0].choices.map((c: any) => c.id));
    expect(res.body.options[0].choices[1].price_delta_cents).toBe(350);
    expect(res.body.price_cents).toBe(1500);
  });

  it('publishes one MENU_CHANGED for the whole edit', async () => {
    published.length = 0;
    const res = await patch('/api/staff/menu/items/i-02', { price_cents: 900, options: [{ name: 'Dressing', kind: 'one', choices: [{ label: 'Oil' }] }] });
    expect(res.status).toBe(200);
    expect(published.filter((e) => e.type === 'MENU_CHANGED' && e.channel === 'staff')).toHaveLength(1);
  });

  it('a PATCH without options still leaves the options alone, and PUT .../options still works as before', async () => {
    const before = await getItem('i-04');
    await patch('/api/staff/menu/items/i-04', { price_cents: 1400 });
    expect((await getItem('i-04')).options).toEqual(before.options);
    expect((await put('/api/staff/menu/items/i-04/options', { groups: [] })).status).toBe(200);
  });

  it('is all or nothing even when the write fails half-way (a database error rolls the price back)', async () => {
    const db = getDb();
    db.exec(`CREATE TRIGGER fail_choice BEFORE INSERT ON option_choices WHEN NEW.label = 'Boom' BEGIN SELECT RAISE(ABORT, 'boom'); END;`);
    const before = await getItem('i-02');
    const res = await patch('/api/staff/menu/items/i-02', { price_cents: 777, options: [{ name: 'G', kind: 'one', choices: [{ label: 'Boom' }] }] });
    expect(res.status).toBe(500);
    expect((await getItem('i-02')).price_cents).toBe(before.price_cents);
    db.exec('DROP TRIGGER fail_choice');
  });
});
