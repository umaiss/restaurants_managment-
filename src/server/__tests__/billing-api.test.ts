import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Runs before any import below is evaluated, so this file always gets its own in-memory database.
vi.hoisted(() => {
  process.env.DB_FILE = ':memory:';
});

// U5 (BR11.3): staff routes now need a session, so every request carries the signed-in test staff cookie.
import { requestAsStaff as request } from './helpers/staff.js';
import type { Response } from 'express';
import { app } from '../index.js';
import { resetDb, seedIfEmpty } from '../db.js';
import { subscribe, _resetForTest } from '../sse.js';

/** Places an order and checks it really was created (201 and a numeric order_number). */
async function place(table: number, key: string, item = 'i-04', quantity = 1): Promise<number> {
  const res = await request(app)
    .post(`/api/tables/${table}/orders`)
    .send({ placement_key: key, lines: [{ menu_item_id: item, quantity }] });
  expect(res.status, `placing order ${key} on table ${table}: ${JSON.stringify(res.body)}`).toBe(201);
  expect(typeof res.body.order_number).toBe('number');
  expect(res.body.status).toBe('Pending');
  return res.body.order_number as number;
}

/** Moves an order to a new status and checks the change was accepted. */
async function transition(n: number, to: string) {
  const res = await request(app).post(`/api/orders/${n}/transition`).send({ to, by: 'staff' });
  expect(res.status, `moving order ${n} to ${to}: ${JSON.stringify(res.body)}`).toBe(200);
  expect(res.body.status).toBe(to);
}

/** A stand-in response that records everything written to it. */
function stubResponse(): { res: Response; written: string[] } {
  const written: string[] = [];
  const res = {
    req: { headers: {}, query: {} },
    setHeader: () => undefined,
    flushHeaders: () => undefined,
    write: (chunk: string) => {
      written.push(chunk);
      return true;
    },
    on: () => undefined,
  } as unknown as Response;
  return { res, written };
}

describe('billing API', () => {
  beforeEach(() => {
    resetDb();
    seedIfEmpty();
    _resetForTest();
  });
  afterEach(() => {
    resetDb();
  });

  it('GET /bill returns the contract shape for a table with two orders', async () => {
    const a = await place(1, 'a', 'i-04', 2);
    const b = await place(1, 'b', 'i-10', 1);
    const res = await request(app).get('/api/tables/1/bill');
    expect(res.status).toBe(200);
    expect(res.body.table_id).toBe(1);
    expect(res.body.orders.map((o: { order_number: number }) => o.order_number)).toEqual([a, b]);
    expect(res.body.orders[0].lines[0]).toMatchObject({ menu_item_id: 'i-04', quantity: 2, price_cents_each: 1450, subtotal_cents: 2900 });
    expect(res.body.combined_total_cents).toBe(3250);
    expect(res.body.close_available).toBe(false);
    expect(res.body.blocking_orders).toEqual([a, b]);
  });

  it('GET /bill carries no tax or service charge: the total is the sum of the line subtotals (NFR4)', async () => {
    await place(1, 'a', 'i-04', 2);
    await place(1, 'b', 'i-10', 1);
    const res = await request(app).get('/api/tables/1/bill');
    expect(res.status).toBe(200);
    expect(Object.keys(res.body).sort()).toEqual(['blocking_orders', 'close_available', 'combined_total_cents', 'orders', 'table_id']);
    const lineSum = res.body.orders.reduce(
      (sum: number, o: { lines: Array<{ subtotal_cents: number }> }) => sum + o.lines.reduce((s, l) => s + l.subtotal_cents, 0),
      0,
    );
    expect(res.body.combined_total_cents).toBe(lineSum);
    expect(JSON.stringify(res.body)).not.toMatch(/tax|service_charge|tip/i);
  });

  it('GET /bill for an unknown table is 404 UNKNOWN_TABLE, also for a non-numeric id', async () => {
    const r1 = await request(app).get('/api/tables/99/bill');
    expect(r1.status).toBe(404);
    expect(r1.body.error.code).toBe('UNKNOWN_TABLE');
    const r2 = await request(app).get('/api/tables/abc/bill');
    expect(r2.status).toBe(404);
    expect(r2.body.error.code).toBe('UNKNOWN_TABLE');
  });

  it('GET /bill for an unused table is 200 with an empty bill and close_available false', async () => {
    const res = await request(app).get('/api/tables/2/bill');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ table_id: 2, orders: [], combined_total_cents: 0, close_available: false, blocking_orders: [] });
  });

  it('POST /close is 422 CLOSE_BLOCKED while an order is Pending, then 200 once it is Completed', async () => {
    const n = await place(1, 'a');
    const blocked = await request(app).post('/api/tables/1/close').send({});
    expect(blocked.status).toBe(422);
    expect(blocked.body.error.code).toBe('CLOSE_BLOCKED');
    expect(blocked.body.error.details.blocking_orders).toEqual([n]);

    await transition(n, 'Preparing');
    await transition(n, 'Completed');
    const ok = await request(app).post('/api/tables/1/close').send({});
    expect(ok.status).toBe(200);
    expect(ok.body.closed).toBe(true);
    expect(typeof ok.body.archived_visit_id).toBe('string');
  });

  it('POST /close on a table with no orders is 422 TABLE_EMPTY; closing twice is 409 TABLE_ALREADY_CLOSED', async () => {
    const empty = await request(app).post('/api/tables/3/close').send({});
    expect(empty.status).toBe(422);
    expect(empty.body.error.code).toBe('TABLE_EMPTY');

    const n = await place(4, 'a');
    await transition(n, 'Cancelled');
    expect((await request(app).post('/api/tables/4/close').send({})).status).toBe(200);
    const again = await request(app).post('/api/tables/4/close').send({});
    expect(again.status).toBe(409);
    expect(again.body.error.code).toBe('TABLE_ALREADY_CLOSED');
  });

  it('POST /close on an unknown or non-numeric table is 404 UNKNOWN_TABLE', async () => {
    expect((await request(app).post('/api/tables/99/close').send({})).body.error.code).toBe('UNKNOWN_TABLE');
    expect((await request(app).post('/api/tables/x/close').send({})).status).toBe(404);
  });

  it('a successful close publishes TABLE_CLOSED to the staff channel and the table channel', async () => {
    const staff = stubResponse();
    const table = stubResponse();
    subscribe('staff', staff.res);
    subscribe('table:5', table.res);

    const n = await place(5, 'a');
    await transition(n, 'Preparing');
    await transition(n, 'Completed');
    const res = await request(app).post('/api/tables/5/close').send({});

    for (const w of [staff.written, table.written]) {
      const frame = w.find((c) => c.includes('event: TABLE_CLOSED'));
      expect(frame).toBeDefined();
      expect(frame).toContain(`"table_id":5`);
      expect(frame).toContain(`"archived_visit_id":"${res.body.archived_visit_id}"`);
    }
  });

  it('a failed close publishes nothing', async () => {
    const staff = stubResponse();
    subscribe('staff', staff.res);
    await request(app).post('/api/tables/6/close').send({});
    expect(staff.written.some((c) => c.includes('TABLE_CLOSED'))).toBe(false);
  });

  it('placing an order after a close opens a new visit and the new bill does not include the old orders', async () => {
    const old = await place(7, 'a');
    await transition(old, 'Cancelled');
    await request(app).post('/api/tables/7/close').send({});

    const fresh = await place(7, 'b', 'i-10', 1);
    const bill = await request(app).get('/api/tables/7/bill');
    expect(bill.body.orders.map((o: { order_number: number }) => o.order_number)).toEqual([fresh]);
    expect(bill.body.combined_total_cents).toBe(350);
  });
});
