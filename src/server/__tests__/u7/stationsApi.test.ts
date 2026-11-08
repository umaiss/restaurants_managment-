// U7 Steps 7 and 9: the station routes and the events they publish (BR1.1 to BR1.3).
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
import { placeOrderWithOptions } from '../helpers/index.js';
import { staffCookie } from '../helpers/staff.js';
import { cleanup, freshApp } from './setup.js';

const get = (url: string) => request(app).get(url).set('Cookie', staffCookie());
const post = (url: string) => request(app).post(url).set('Cookie', staffCookie()).send({});
const mixed = () => placeOrderWithOptions(5, [{ menu_item_id: 'i-04', quantity: 1, option_ids: ['oc-04-size-large'] }, { menu_item_id: 'i-11', quantity: 1 }]);
const after = (mark: number) => published.slice(mark);

describe('GET /api/staff/stations/:station/board', () => {
  beforeEach(() => { freshApp(); published.length = 0; });
  afterEach(cleanup);

  it('answers the station\'s tickets', async () => {
    const order = mixed();
    const res = await get('/api/staff/stations/Grill/board');
    expect(res.status).toBe(200);
    expect(res.body.station).toBe('Grill');
    expect(res.body.orders).toHaveLength(1);
    expect(res.body.orders[0]).toMatchObject({ order_number: order.order_number, table_id: 5, status: 'Pending' });
    expect(res.body.orders[0].lines[0].options).toEqual([{ label: 'Large', price_delta_cents: 300 }]);
  });

  it('answers an empty list for a station with nothing to do', async () => {
    const res = await get('/api/staff/stations/Desserts/board');
    expect(res.body).toEqual({ station: 'Desserts', orders: [] });
  });

  it('401 without a session, before anything else', async () => {
    const res = await request(app).get('/api/staff/stations/Grill/board');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('404 UNKNOWN_STATION for any other value, in v1\'s error shape', async () => {
    const res = await get('/api/staff/stations/Pantry/board');
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: { code: 'UNKNOWN_STATION', message: expect.any(String) } });
    expect((await get('/api/staff/stations/grill/board')).status).toBe(404);
  });
});

describe('POST /api/staff/orders/:n/stations/:station/done', () => {
  beforeEach(() => { freshApp(); published.length = 0; });
  afterEach(cleanup);
  const url = (n: number, s: string) => `/api/staff/orders/${n}/stations/${s}/done`;

  it('marks a station done: 200 with the status and the stations done and remaining', async () => {
    const order = mixed();
    const res = await post(url(order.order_number, 'Grill'));
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ order_number: order.order_number, status: 'Preparing', stations_done: ['Grill'], stations_remaining: ['Bar'] });
  });

  it('the last mark completes the order', async () => {
    const order = mixed();
    await post(url(order.order_number, 'Grill'));
    const res = await post(url(order.order_number, 'Bar'));
    expect(res.body).toMatchObject({ status: 'Completed', stations_remaining: [] });
  });

  it('a second press is 200 and changes nothing, even after the order is Completed', async () => {
    const order = mixed();
    await post(url(order.order_number, 'Grill'));
    await post(url(order.order_number, 'Bar'));
    const again = await post(url(order.order_number, 'Bar'));
    expect(again.status).toBe(200);
    expect(again.body.status).toBe('Completed');
  });

  it('publishes STATION_DONE to staff, then ORDER_STATUS_CHANGED to staff and the table for each change, after the write (BR1.3)', async () => {
    const order = mixed();
    published.length = 0;
    await post(url(order.order_number, 'Grill'));
    expect(published.map((e) => `${e.channel} ${e.type}`)).toEqual(['staff STATION_DONE', 'staff ORDER_STATUS_CHANGED', 'table:5 ORDER_STATUS_CHANGED']);
    expect(published[0].data).toEqual({ order_number: order.order_number, table_id: 5, station: 'Grill', remaining: ['Bar'] });
    expect(published[1].data).toEqual({ order_number: order.order_number, table_id: 5, status: 'Preparing' });

    published.length = 0;
    await post(url(order.order_number, 'Bar'));
    expect(published.map((e) => e.type)).toEqual(['STATION_DONE', 'ORDER_STATUS_CHANGED', 'ORDER_STATUS_CHANGED']);
    expect(published[1].data).toMatchObject({ status: 'Completed', completed_at: expect.stringMatching(/Z$/) });
  });

  it('a single-station order publishes Preparing and then Completed, in that order', async () => {
    const order = placeOrderWithOptions(2, [{ menu_item_id: 'i-04', quantity: 1 }]);
    published.length = 0;
    await post(url(order.order_number, 'Grill'));
    const statuses = published.filter((e) => e.type === 'ORDER_STATUS_CHANGED' && e.channel === 'staff').map((e) => e.data.status);
    expect(statuses).toEqual(['Preparing', 'Completed']);
  });

  it('a repeated mark publishes nothing', async () => {
    const order = mixed();
    await post(url(order.order_number, 'Grill'));
    published.length = 0;
    await post(url(order.order_number, 'Grill'));
    expect(published).toEqual([]);
  });

  it('a refused mark publishes nothing and writes nothing', async () => {
    const order = mixed();
    published.length = 0;
    expect((await post(url(order.order_number, 'Cold'))).status).toBe(422);
    expect(published).toEqual([]);
  });

  it('401 without a session', async () => {
    const order = mixed();
    const res = await request(app).post(url(order.order_number, 'Grill')).send({});
    expect(res.status).toBe(401);
  });

  it('404 for an unknown station, and 404 UNKNOWN_ORDER for an unknown or malformed order number', async () => {
    const order = mixed();
    expect((await post(url(order.order_number, 'Pantry'))).body.error.code).toBe('UNKNOWN_STATION');
    expect((await post(url(9999, 'Grill'))).body.error.code).toBe('UNKNOWN_ORDER');
    expect((await post('/api/staff/orders/12abc/stations/Grill/done')).status).toBe(404);
  });

  it('422 NO_LINES_FOR_STATION when the order has nothing for the station', async () => {
    const order = mixed();
    const res = await post(url(order.order_number, 'Desserts'));
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('NO_LINES_FOR_STATION');
  });

  it('422 ILLEGAL_TRANSITION for a first mark on a Cancelled order', async () => {
    const order = mixed();
    await request(app).post(`/api/orders/${order.order_number}/transition`).set('Cookie', staffCookie()).send({ to: 'Cancelled', by: 'staff' });
    const res = await post(url(order.order_number, 'Grill'));
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('ILLEGAL_TRANSITION');
  });
});
