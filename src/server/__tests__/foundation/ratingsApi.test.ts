// U5 Step 10: rating route (BR7.1, BR7.2, contract 1).
process.env.DB_FILE = ':memory:';

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { app } from '../../index.js';
import { getDb, resetDb, seedIfEmpty } from '../../db.js';
import { staffCookie } from '../helpers/staff.js';

/** Table 1 orders a burger and a coffee, finishes both, and is closed. Returns the closed visit's id. */
async function closedTable(): Promise<string> {
  const cookie = staffCookie();
  const placed = await request(app)
    .post('/api/tables/1/orders')
    .send({ placement_key: 'r-1', lines: [{ menu_item_id: 'i-04', quantity: 1 }, { menu_item_id: 'i-12', quantity: 1 }] });
  const n = placed.body.order_number;
  await request(app).post(`/api/orders/${n}/transition`).set('Cookie', cookie).send({ to: 'Preparing', by: 'staff' });
  await request(app).post(`/api/orders/${n}/transition`).set('Cookie', cookie).send({ to: 'Completed', by: 'staff' });
  const closed = await request(app).post('/api/tables/1/close').set('Cookie', cookie).send({});
  return closed.body.archived_visit_id as string;
}
const rate = (visit: unknown, ratings: unknown, extra: object = {}) =>
  request(app).post('/api/tables/1/ratings').send({ visit_id: visit, ratings, ...extra });

describe('rating API', () => {
  beforeEach(() => {
    resetDb();
    seedIfEmpty();
  });
  afterEach(() => {
    resetDb();
  });

  it('saves thumbs for the last closed visit: 200 { saved }', async () => {
    const visit = await closedTable();
    const res = await rate(visit, [{ item_id: 'i-04', thumb: 'up' }, { item_id: 'i-12', thumb: 'down' }]);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ saved: 2 });
    expect(getDb().prepare('SELECT item_id, thumb FROM dish_ratings ORDER BY item_id').all()).toEqual([
      { item_id: 'i-04', thumb: 'up' },
      { item_id: 'i-12', thumb: 'down' },
    ]);
  });

  it('a later post changes a thumb; done locks it; changing it then is 409 RATING_LOCKED', async () => {
    const visit = await closedTable();
    await rate(visit, [{ item_id: 'i-04', thumb: 'up' }]);
    await rate(visit, [{ item_id: 'i-04', thumb: 'down' }]);
    expect((await rate(visit, [], { done: true })).body).toEqual({ saved: 0 });

    const locked = await rate(visit, [{ item_id: 'i-04', thumb: 'up' }]);
    expect(locked.status).toBe(409);
    expect(locked.body.error.code).toBe('RATING_LOCKED');
    expect(getDb().prepare('SELECT thumb, locked FROM dish_ratings').get()).toEqual({ thumb: 'down', locked: 1 });
    // a dish that was never rated can still be rated
    expect((await rate(visit, [{ item_id: 'i-12', thumb: 'up' }])).status).toBe(200);
  });

  it('keeps a written comment with the ratings: changeable until Done, then locked (RATING_LOCKED)', async () => {
    const visit = await closedTable();
    expect((await rate(visit, [], { comment: '  Lovely evening  ' })).status).toBe(200);
    expect(getDb().prepare('SELECT comment, locked FROM visit_feedback').get()).toEqual({ comment: 'Lovely evening', locked: 0 });
    await rate(visit, [{ item_id: 'i-04', thumb: 'up' }], { comment: 'Lovely evening, great burger' });
    expect(getDb().prepare('SELECT comment FROM visit_feedback').get()).toEqual({ comment: 'Lovely evening, great burger' });
    expect((await rate(visit, [], { done: true })).status).toBe(200);
    expect(getDb().prepare('SELECT locked FROM visit_feedback').get()).toEqual({ locked: 1 });

    const locked = await rate(visit, [], { comment: 'Changed my mind' });
    expect(locked.status).toBe(409);
    expect(locked.body.error.code).toBe('RATING_LOCKED');
    expect(getDb().prepare('SELECT comment FROM visit_feedback').get()).toEqual({ comment: 'Lovely evening, great burger' });
    // the same comment sent again after Done is not a change
    expect((await rate(visit, [], { comment: 'Lovely evening, great burger' })).status).toBe(200);
  });

  it('an empty comment clears the kept one; a comment that is not text or is over 500 characters is 400 INVALID_COMMENT and saves nothing', async () => {
    const visit = await closedTable();
    await rate(visit, [], { comment: 'Nice' });
    await rate(visit, [], { comment: '   ' });
    expect(getDb().prepare('SELECT COUNT(*) AS n FROM visit_feedback').get()).toEqual({ n: 0 });
    for (const bad of [42, 'x'.repeat(501)]) {
      const res = await rate(visit, [{ item_id: 'i-04', thumb: 'up' }], { comment: bad });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVALID_COMMENT');
    }
    expect(getDb().prepare('SELECT COUNT(*) AS n FROM dish_ratings').get()).toEqual({ n: 0 });
  });

  it('answers each rule with its code: VISIT_NOT_CLOSED 409, INVALID_RATING 400, ITEM_NOT_IN_VISIT 400', async () => {
    const visit = await closedTable();
    const wrongVisit = await rate('not-a-visit', []);
    expect(wrongVisit.status).toBe(409);
    expect(wrongVisit.body.error.code).toBe('VISIT_NOT_CLOSED');

    const badThumb = await rate(visit, [{ item_id: 'i-04', thumb: 'maybe' }]);
    expect(badThumb.status).toBe(400);
    expect(badThumb.body.error.code).toBe('INVALID_RATING');

    const notOnVisit = await rate(visit, [{ item_id: 'i-10', thumb: 'up' }]);
    expect(notOnVisit.status).toBe(400);
    expect(notOnVisit.body.error).toMatchObject({ code: 'ITEM_NOT_IN_VISIT', details: { item_id: 'i-10' } });
    expect(getDb().prepare('SELECT COUNT(*) AS n FROM dish_ratings').get()).toEqual({ n: 0 });
  });

  it('a malformed request is 400 INVALID_REQUEST naming the field, never a 500', async () => {
    const visit = await closedTable();
    for (const [body, field] of [
      [{ ratings: [] }, 'visit_id'],
      [{ visit_id: 5, ratings: [] }, 'visit_id'],
      [{ visit_id: visit, ratings: [], done: 'yes' }, 'done'],
    ] as Array<[object, string]>) {
      const res = await request(app).post('/api/tables/1/ratings').send(body);
      expect(res.status).toBe(400);
      expect(res.body.error).toMatchObject({ code: 'INVALID_REQUEST', details: { field } });
    }
    const noList = await rate(visit, 'up');
    expect(noList.status).toBe(400);
    expect(noList.body.error.code).toBe('INVALID_RATING');
    expect((await request(app).post('/api/tables/1/ratings')).status).toBe(400);
  });

  it('an unknown or non-numeric table is 404 UNKNOWN_TABLE', async () => {
    expect((await request(app).post('/api/tables/99/ratings').send({ visit_id: 'v', ratings: [] })).status).toBe(404);
    expect((await request(app).post('/api/tables/1x/ratings').send({ visit_id: 'v', ratings: [] })).body.error.code).toBe('UNKNOWN_TABLE');
  });
});
