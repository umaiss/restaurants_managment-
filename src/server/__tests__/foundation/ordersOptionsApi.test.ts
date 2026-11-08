// U5 Step 10: orders with options and specials over HTTP (contract 1, BR3.x, BR9.1, BR5.5, BR3.6).
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
import { launchSpecial } from '../../repositories/specialsRepo.js';
import { staffCookie } from '../helpers/staff.js';

const place = (table: number, key: string, lines: object[]) =>
  request(app).post(`/api/tables/${table}/orders`).send({ placement_key: key, lines });
const eventsOf = (type: string) => published.filter((e) => e.type === type);
const count = (sql: string) => (getDb().prepare(sql).get() as { n: number }).n;

describe('orders with options and specials (API)', () => {
  beforeEach(() => {
    resetDb();
    seedIfEmpty();
    published.length = 0;
  });
  afterEach(() => {
    resetDb();
  });

  it('places a line with options: 201 with the estimate, the frozen price, station and options', async () => {
    const res = await place(1, 'a', [
      { menu_item_id: 'i-04', quantity: 2, option_ids: ['oc-04-size-large', 'oc-04-extras-cheese'] },
    ]);
    expect(res.status).toBe(201);
    expect(res.body.estimate_minutes).toBe(15); // nothing completed today and nothing open before this order
    expect(res.body.status).toBe('Pending');
    expect(res.body.dropped_lines).toEqual([]);
    expect(res.body.lines).toEqual([
      {
        menu_item_id: 'i-04',
        name: 'Classic Burger',
        quantity: 2,
        price_cents_each: 1850,
        subtotal_cents: 3700,
        station: 'Grill',
        options: [
          { label: 'Large', price_delta_cents: 300 },
          { label: 'Extra cheese', price_delta_cents: 100 },
        ],
      },
    ]);
  });

  it('the next estimate counts the open order: 15 + 2 x 1', async () => {
    await place(1, 'a', [{ menu_item_id: 'i-01', quantity: 1 }]);
    const res = await place(2, 'b', [{ menu_item_id: 'i-01', quantity: 1 }]);
    expect(res.body.estimate_minutes).toBe(17);
  });

  it('a line with no options still works exactly as in v1', async () => {
    const res = await place(1, 'a', [{ menu_item_id: 'i-01', quantity: 1 }]);
    expect(res.status).toBe(201);
    expect(res.body.lines[0]).toMatchObject({ price_cents_each: 650, station: 'Grill', options: [] });
  });

  it('ORDER_PLACED carries estimate_minutes and, per line, station and options, to staff and the table', async () => {
    await place(3, 'a', [{ menu_item_id: 'i-04', quantity: 1, option_ids: ['oc-04-leave-onions'] }]);
    const events = eventsOf('ORDER_PLACED');
    expect(events.map((e) => e.channel).sort()).toEqual(['staff', 'table:3']);
    for (const e of events) {
      expect(e.data.estimate_minutes).toBe(15);
      expect(e.data.lines[0]).toMatchObject({
        station: 'Grill',
        options: [{ label: 'No onions', price_delta_cents: 0 }],
      });
      expect(e.data.total_cents).toBe(1450);
    }
  });

  it('a refused option choice is 400 INVALID_OPTIONS with details, and nothing is written or published', async () => {
    getDb().prepare("UPDATE option_groups SET required = 1 WHERE id = 'og-04-size'").run();
    const missing = await place(1, 'a', [{ menu_item_id: 'i-04', quantity: 1 }]);
    expect(missing.status).toBe(400);
    expect(missing.body.error.code).toBe('INVALID_OPTIONS');
    expect(missing.body.error.details).toEqual({ menu_item_id: 'i-04', group: 'Size' });

    const two = await place(1, 'b', [{ menu_item_id: 'i-04', quantity: 1, option_ids: ['oc-04-size-regular', 'oc-04-size-large'] }]);
    expect(two.body.error.code).toBe('INVALID_OPTIONS');
    const other = await place(1, 'c', [{ menu_item_id: 'i-06', quantity: 1, option_ids: ['oc-04-size-large'] }]);
    expect(other.body.error.code).toBe('INVALID_OPTIONS');

    expect(count('SELECT COUNT(*) AS n FROM orders')).toBe(0);
    expect(count('SELECT COUNT(*) AS n FROM visits')).toBe(0);
    expect(eventsOf('ORDER_PLACED')).toHaveLength(0);
  });

  it('a removed option drops its line with OPTION_UNAVAILABLE and the order is still placed', async () => {
    getDb().prepare("DELETE FROM option_choices WHERE id = 'oc-04-extras-bacon'").run();
    const res = await place(1, 'a', [
      { menu_item_id: 'i-04', quantity: 1, option_ids: ['oc-04-extras-bacon'] },
      { menu_item_id: 'i-10', quantity: 1 },
    ]);
    expect(res.status).toBe(201);
    expect(res.body.dropped_lines).toEqual([{ menu_item_id: 'i-04', reason: 'OPTION_UNAVAILABLE' }]);
    expect(res.body.lines.map((l: { menu_item_id: string }) => l.menu_item_id)).toEqual(['i-10']);
  });

  it('a hidden item is 400 UNKNOWN_ITEM', async () => {
    getDb().prepare('UPDATE items SET hidden = 1 WHERE id = ?').run('i-01');
    const res = await place(1, 'a', [{ menu_item_id: 'i-01', quantity: 1 }]);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('UNKNOWN_ITEM');
  });

  it.each([
    ['option_ids that is not a list', { option_ids: 'oc-04-size-large' }, 'option_ids'],
    ['option_ids with a number in it', { option_ids: [7] }, 'option_ids'],
    ['a special_id that is a number', { special_id: 5 }, 'special_id'],
    ['an empty special_id', { special_id: '' }, 'special_id'],
  ])('%s is 400 INVALID_REQUEST naming the field, never a 500', async (_name, extra, field) => {
    const res = await place(1, 'a', [{ menu_item_id: 'i-04', quantity: 1, ...extra }]);
    expect(res.status).toBe(400);
    expect(res.body.error).toMatchObject({ code: 'INVALID_REQUEST', details: { field } });
  });

  it('more than 50 lines in one order is 400 INVALID_REQUEST naming "lines"; 50 is accepted', async () => {
    const line = { menu_item_id: 'i-10', quantity: 1 };
    const tooMany = await place(1, 'many', Array.from({ length: 51 }, () => line));
    expect(tooMany.status).toBe(400);
    expect(tooMany.body.error).toMatchObject({ code: 'INVALID_REQUEST', details: { field: 'lines' } });
    expect(count('SELECT COUNT(*) AS n FROM orders')).toBe(0);
    expect(count('SELECT COUNT(*) AS n FROM visits')).toBe(0);

    const fifty = await place(1, 'fifty', Array.from({ length: 50 }, () => line));
    expect(fifty.status).toBe(201);
    expect(fifty.body.lines).toHaveLength(50);
  });

  it('more than 20 option_ids on one line is 400 INVALID_REQUEST naming "option_ids"; 20 reach the option checks', async () => {
    const ids = (n: number) => Array.from({ length: n }, (_, i) => `oc-04-extras-cheese-${i}`);
    const tooMany = await place(1, 'opt-many', [{ menu_item_id: 'i-04', quantity: 1, option_ids: ids(21) }]);
    expect(tooMany.status).toBe(400);
    expect(tooMany.body.error).toMatchObject({ code: 'INVALID_REQUEST', details: { field: 'option_ids' } });

    // 20 is within the cap: they are checked as before (ids that exist nowhere drop the line)
    const twenty = await place(1, 'opt-twenty', [{ menu_item_id: 'i-04', quantity: 1, option_ids: ids(20) }, { menu_item_id: 'i-10', quantity: 1 }]);
    expect(twenty.status).toBe(201);
    expect(twenty.body.dropped_lines).toEqual([{ menu_item_id: 'i-04', reason: 'OPTION_UNAVAILABLE' }]);
  });

  it('a repeated placement key is 200 with the same body and publishes nothing more (BR3.7)', async () => {
    const first = await place(1, 'same', [{ menu_item_id: 'i-04', quantity: 1, option_ids: ['oc-04-size-large'] }]);
    const placedEvents = published.length;
    const again = await place(1, 'same', [{ menu_item_id: 'i-04', quantity: 1, option_ids: ['oc-04-size-large'] }]);
    expect(again.status).toBe(200);
    expect(again.body).toEqual(first.body);
    expect(published).toHaveLength(placedEvents);
  });

  it('GET orders returns estimate_minutes, completed_at and, per line, station and options', async () => {
    const placed = await place(1, 'a', [{ menu_item_id: 'i-04', quantity: 1, option_ids: ['oc-04-extras-bacon'] }]);
    const list = await request(app).get('/api/tables/1/orders?visit=current');
    expect(list.body.orders[0]).toMatchObject({
      order_number: placed.body.order_number,
      estimate_minutes: 15,
      completed_at: null,
    });
    expect(list.body.orders[0].lines[0]).toMatchObject({ station: 'Grill', options: [{ label: 'Bacon', price_delta_cents: 150 }] });
  });

  it('the bill lines carry station and options too', async () => {
    await place(1, 'a', [{ menu_item_id: 'i-04', quantity: 1, option_ids: ['oc-04-extras-cheese'] }]);
    const bill = await request(app).get('/api/tables/1/bill').set('Cookie', staffCookie());
    expect(bill.status).toBe(200);
    expect(bill.body.orders[0].lines[0]).toMatchObject({
      price_cents_each: 1550,
      station: 'Grill',
      options: [{ label: 'Extra cheese', price_delta_cents: 100 }],
    });
  });

  describe('Completed time on the status event (BR3.6)', () => {
    it('ORDER_STATUS_CHANGED carries completed_at when the order becomes Completed, and not before', async () => {
      const n = (await place(1, 'a', [{ menu_item_id: 'i-01', quantity: 1 }])).body.order_number as number;
      const cookie = staffCookie();
      await request(app).post(`/api/orders/${n}/transition`).set('Cookie', cookie).send({ to: 'Preparing', by: 'staff' });
      let changed = eventsOf('ORDER_STATUS_CHANGED');
      expect(changed.map((e) => e.channel).sort()).toEqual(['staff', 'table:1']);
      expect(changed[0].data).toEqual({ order_number: n, table_id: 1, status: 'Preparing' }); // v1's payload, unchanged

      published.length = 0;
      await request(app).post(`/api/orders/${n}/transition`).set('Cookie', cookie).send({ to: 'Completed', by: 'staff' });
      changed = eventsOf('ORDER_STATUS_CHANGED');
      expect(changed).toHaveLength(2);
      for (const e of changed) {
        expect(e.data).toMatchObject({ order_number: n, status: 'Completed' });
        expect(e.data.completed_at).toMatch(/^\d{4}-\d{2}-\d{2}T.*Z$/);
      }
      const list = await request(app).get('/api/tables/1/orders?visit=current');
      expect(list.body.orders[0].completed_at).toBe(changed[0].data.completed_at);
    });

    it('a refused change publishes nothing', async () => {
      const n = (await place(1, 'a', [{ menu_item_id: 'i-01', quantity: 1 }])).body.order_number as number;
      published.length = 0;
      const res = await request(app).post(`/api/orders/${n}/transition`).set('Cookie', staffCookie()).send({ to: 'Completed', by: 'staff' });
      expect(res.status).toBe(422);
      expect(published).toHaveLength(0);
    });
  });

  describe('the diner menu (GET /api/menu)', () => {
    it('carries station, allergens and options, and leaves out hidden items and categories', async () => {
      getDb().prepare('UPDATE items SET hidden = 1 WHERE id = ?').run('i-02');
      getDb().prepare('UPDATE categories SET hidden = 1 WHERE id = ?').run('c-03');
      const res = await request(app).get('/api/menu');
      expect(res.body.categories.map((c: { id: string }) => c.id)).toEqual(['c-01', 'c-02', 'c-04']);
      const ids = res.body.items.map((i: { id: string }) => i.id);
      expect(ids).not.toContain('i-02');
      expect(ids).not.toContain('i-08');
      const burger = res.body.items.find((i: { id: string }) => i.id === 'i-04');
      expect(burger).toMatchObject({ station: 'Grill', allergens: ['gluten', 'dairy', 'sesame'] });
      expect(burger.options[0]).toMatchObject({ name: 'Size', kind: 'one', required: false });
      expect(res.body.items.find((i: { id: string }) => i.id === 'i-05').allergens).toBeNull();
    });
  });

  describe('a Chef\'s special line (BR5.3 to BR5.5)', () => {
    it('is priced by the server, reduces the stock and publishes SPECIAL_CHANGED with the new stock', async () => {
      const special = launchSpecial({ item_id: 'i-04', special_price_cents: 1000, stock: 3, minutes: 30 });
      const res = await place(1, 'a', [{ menu_item_id: 'i-04', quantity: 2, special_id: special.id }]);
      expect(res.status).toBe(201);
      expect(res.body.lines[0]).toMatchObject({ price_cents_each: 1000, subtotal_cents: 2000, special_id: special.id });

      const changed = eventsOf('SPECIAL_CHANGED');
      expect(changed.some((e) => e.channel === 'staff')).toBe(true);
      expect(changed.some((e) => e.channel === 'table:7')).toBe(true); // every table, not only the one that ordered
      expect(changed[0].data.special).toMatchObject({ id: special.id, stock_left: 1 });
    });

    it('the last one goes to one diner: the other\'s line is dropped, the rest of the order is placed, and the sell-out is published as null', async () => {
      const special = launchSpecial({ item_id: 'i-01', special_price_cents: 400, stock: 1, minutes: 30 });
      const [a, b] = await Promise.all([
        place(1, 'a', [{ menu_item_id: 'i-01', quantity: 1, special_id: special.id }, { menu_item_id: 'i-10', quantity: 1 }]),
        place(2, 'b', [{ menu_item_id: 'i-01', quantity: 1, special_id: special.id }, { menu_item_id: 'i-10', quantity: 1 }]),
      ]);
      expect(a.status).toBe(201);
      expect(b.status).toBe(201);
      const dropped = [a, b].flatMap((r) => r.body.dropped_lines);
      expect(dropped).toEqual([{ menu_item_id: 'i-01', reason: 'SPECIAL_SOLD_OUT' }]); // exactly one lost
      expect(count('SELECT SUM(quantity) AS n FROM order_items WHERE special_id IS NOT NULL')).toBe(1);
      expect(getDb().prepare('SELECT stock_left FROM chef_specials').get()).toEqual({ stock_left: 0 });

      const last = eventsOf('SPECIAL_CHANGED').filter((e) => e.channel === 'staff').pop()!;
      expect(last.data.special).toBeNull();
      const current = await request(app).get('/api/specials/current');
      expect(current.body).toEqual({ special: null });
    });

    it('an order that places nothing publishes no special change', async () => {
      const special = launchSpecial({ item_id: 'i-01', special_price_cents: 400, stock: 1, minutes: 30 });
      const res = await place(1, 'a', [{ menu_item_id: 'i-01', quantity: 5, special_id: special.id }]);
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('EMPTY_ORDER');
      expect(eventsOf('SPECIAL_CHANGED')).toHaveLength(0);
      expect(getDb().prepare('SELECT stock_left FROM chef_specials').get()).toEqual({ stock_left: 1 });
    });
  });
});
