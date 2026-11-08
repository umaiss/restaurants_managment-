// U7 Step 5: sales by day and the ratings ranking (BR7.1 to BR7.4, BR7.6).
process.env.DB_FILE = ':memory:';

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getRatings, getSales, localDay, readDay } from '../../routes/u7/sales.js';
import { addRating, cleanup, freshApp, localIso, localSqlite, makeClosedVisit } from './setup.js';

const line = (item_id: string, quantity: number, unit_price_cents: number) => ({ item_id, quantity, unit_price_cents });

describe('sales by day (BR7.1 to BR7.4)', () => {
  beforeEach(freshApp);
  afterEach(cleanup);

  it('is empty when no visit has closed', () => {
    expect(getSales()).toEqual([]);
  });

  it('groups closed visits by the local day they closed, newest day first, with totals that add up', () => {
    makeClosedVisit(1, localIso(2026, 11, 6, 12), [{ placedAt: localIso(2026, 11, 6, 11), completedAt: localIso(2026, 11, 6, 11, 10), lines: [line('i-04', 2, 1450), line('i-10', 1, 350)] }]);
    makeClosedVisit(2, localIso(2026, 11, 7, 13), [
      { placedAt: localIso(2026, 11, 7, 12), completedAt: localIso(2026, 11, 7, 12, 20), lines: [line('i-02', 1, 850)] },
      { placedAt: localIso(2026, 11, 7, 12, 30), completedAt: localIso(2026, 11, 7, 12, 40), lines: [line('i-02', 2, 850)] },
    ]);
    const days = getSales();
    expect(days.map((d) => d.day)).toEqual(['2026-11-07', '2026-11-06']);
    expect(days[0]).toMatchObject({ visits: 1, orders: 2, total_cents: 2550, average_minutes: 15, average_per_visit_cents: 2550 });
    expect(days[1]).toMatchObject({ visits: 1, orders: 1, total_cents: 3250, average_minutes: 10 });
  });

  it('puts a visit closed at 23:59 and one closed at 00:01 on different days', () => {
    makeClosedVisit(1, localIso(2026, 11, 7, 23, 59), [{ placedAt: localIso(2026, 11, 7, 23), completedAt: localIso(2026, 11, 7, 23, 5), lines: [line('i-04', 1, 1450)] }]);
    makeClosedVisit(2, localIso(2026, 11, 8, 0, 1), [{ placedAt: localIso(2026, 11, 7, 23, 55), completedAt: localIso(2026, 11, 8, 0, 0), lines: [line('i-04', 1, 1450)] }]);
    expect(getSales().map((d) => [d.day, d.visits])).toEqual([['2026-11-08', 1], ['2026-11-07', 1]]);
  });

  it('reads both stored time formats: v1 "YYYY-MM-DD HH:MM:SS" and v2 ISO', () => {
    makeClosedVisit(1, localSqlite(2026, 11, 5, 12), [{ placedAt: localSqlite(2026, 11, 5, 11), completedAt: localSqlite(2026, 11, 5, 11, 30), lines: [line('i-04', 1, 1000)] }]);
    makeClosedVisit(2, localIso(2026, 11, 5, 15), [{ placedAt: localIso(2026, 11, 5, 14), completedAt: localIso(2026, 11, 5, 14, 10), lines: [line('i-04', 1, 500)] }]);
    const days = getSales();
    expect(days).toHaveLength(1);
    expect(days[0]).toMatchObject({ day: '2026-11-05', visits: 2, orders: 2, total_cents: 1500, average_minutes: 20 });
  });

  it('leaves Cancelled orders out of every figure', () => {
    makeClosedVisit(1, localIso(2026, 11, 7, 12), [
      { placedAt: localIso(2026, 11, 7, 11), completedAt: localIso(2026, 11, 7, 11, 10), lines: [line('i-04', 1, 1000)] },
      { status: 'Cancelled', placedAt: localIso(2026, 11, 7, 11, 5), lines: [line('i-05', 5, 9999)] },
    ]);
    const [day] = getSales();
    expect(day).toMatchObject({ orders: 1, total_cents: 1000 });
    expect(day.best_sellers.map((b) => b.item_id)).toEqual(['i-04']);
  });

  it('the average is null, never 0, when the day has no Completed order with a time', () => {
    makeClosedVisit(1, localIso(2026, 11, 7, 12), [{ status: 'Completed', placedAt: localIso(2026, 11, 7, 11), completedAt: null, lines: [line('i-04', 1, 1000)] }]);
    expect(getSales()[0].average_minutes).toBeNull();
  });

  it('the average is the mean in minutes rounded to one decimal', () => {
    makeClosedVisit(1, localIso(2026, 11, 7, 12), [
      { placedAt: localIso(2026, 11, 7, 11), completedAt: localIso(2026, 11, 7, 11, 10), lines: [line('i-04', 1, 100)] },
      { placedAt: localIso(2026, 11, 7, 11), completedAt: localIso(2026, 11, 7, 11, 11), lines: [line('i-04', 1, 100)] },
      { placedAt: localIso(2026, 11, 7, 11), completedAt: localIso(2026, 11, 7, 11, 12), lines: [line('i-04', 1, 100)] },
      { placedAt: localIso(2026, 11, 7, 11), completedAt: localIso(2026, 11, 7, 11, 12), lines: [line('i-04', 1, 100)] },
    ]);
    expect(getSales()[0].average_minutes).toBe(11.3);
  });

  it('ranks best sellers by quantity, ties by item name, top 5', () => {
    makeClosedVisit(1, localIso(2026, 11, 7, 12), [{ placedAt: localIso(2026, 11, 7, 11), completedAt: localIso(2026, 11, 7, 11, 5), lines: [
      line('i-10', 3, 350), line('i-04', 3, 1450), line('i-02', 5, 850), line('i-01', 1, 650), line('i-03', 2, 950), line('i-05', 2, 1850), line('i-06', 1, 1350),
    ] }]);
    const names = getSales()[0].best_sellers.map((b) => [b.name, b.quantity]);
    expect(names).toEqual([['House Salad', 5], ['Classic Burger', 3], ['Sparkling Water', 3], ['Caesar Salad', 2], ['Grilled Salmon', 2]]);
  });

  it('adds the same dish across orders of the day', () => {
    makeClosedVisit(1, localIso(2026, 11, 7, 12), [
      { placedAt: localIso(2026, 11, 7, 11), completedAt: localIso(2026, 11, 7, 11, 5), lines: [line('i-04', 1, 1450)] },
      { placedAt: localIso(2026, 11, 7, 11, 10), completedAt: localIso(2026, 11, 7, 11, 15), lines: [line('i-04', 2, 1450)] },
    ]);
    expect(getSales()[0].best_sellers[0]).toMatchObject({ item_id: 'i-04', quantity: 3 });
  });

  it('uses the frozen line price, not the menu price', () => {
    makeClosedVisit(1, localIso(2026, 11, 7, 12), [{ placedAt: localIso(2026, 11, 7, 11), completedAt: localIso(2026, 11, 7, 11, 5), lines: [line('i-04', 1, 1750)] }]);
    expect(getSales()[0].total_cents).toBe(1750); // the menu says 1450
  });

  it('counts a closed visit with no non-cancelled orders as a visit, and averages the total over visits', () => {
    makeClosedVisit(1, localIso(2026, 11, 7, 12), [{ placedAt: localIso(2026, 11, 7, 11), completedAt: localIso(2026, 11, 7, 11, 5), lines: [line('i-04', 1, 1001)] }]);
    makeClosedVisit(2, localIso(2026, 11, 7, 13), [{ status: 'Cancelled', placedAt: localIso(2026, 11, 7, 12), lines: [line('i-04', 1, 1450)] }]);
    expect(getSales()[0]).toMatchObject({ visits: 2, orders: 1, total_cents: 1001, average_per_visit_cents: 501 });
  });

  it('from and to are inclusive local dates', () => {
    for (const day of [5, 6, 7]) {
      makeClosedVisit(day - 4, localIso(2026, 11, day, 12), [{ placedAt: localIso(2026, 11, day, 11), completedAt: localIso(2026, 11, day, 11, 5), lines: [line('i-04', 1, 100)] }]);
    }
    expect(getSales({ from: '2026-11-06' }).map((d) => d.day)).toEqual(['2026-11-07', '2026-11-06']);
    expect(getSales({ to: '2026-11-06' }).map((d) => d.day)).toEqual(['2026-11-06', '2026-11-05']);
    expect(getSales({ from: '2026-11-06', to: '2026-11-06' }).map((d) => d.day)).toEqual(['2026-11-06']);
    expect(getSales({ from: '2026-12-01' })).toEqual([]);
  });

  it('an unreadable from or to is refused, naming the field', () => {
    for (const [query, field] of [[{ from: 'yesterday' }, 'from'], [{ to: '2026-13-40' }, 'to'], [{ from: '2026-02-30' }, 'from'], [{ from: ['2026-11-01', '2026-11-02'] }, 'from']] as const) {
      expect(() => getSales(query)).toThrowError(expect.objectContaining({ code: 'INVALID_REQUEST', details: { field } }));
    }
  });

  it('readDay and localDay read and write local dates', () => {
    expect(readDay('2026-11-07')).toBe('2026-11-07');
    expect(readDay('2026-2-7')).toBeNull();
    expect(readDay(undefined)).toBeNull();
    expect(localDay(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05');
  });
});

/** A closed visit holding one rated dish, so each rating is its own (visit, dish) pair. */
function rate(itemId: string, thumb: 'up' | 'down', ratedAt: string): void {
  const visitId = makeClosedVisit(1, ratedAt, [{ placedAt: ratedAt, completedAt: ratedAt, lines: [line(itemId, 1, 100)] }]);
  addRating(visitId, itemId, thumb, ratedAt);
}

describe('best and worst rated dishes (BR7.6)', () => {
  beforeEach(freshApp);
  afterEach(cleanup);
  const day = (h: number) => localIso(2026, 11, 7, h);
  const NOW = new Date(2026, 10, 7, 20, 0, 0);

  it('says nothing is ranked when there are no ratings', () => {
    const r = getRatings(undefined, NOW);
    expect(r).toMatchObject({ day: '2026-11-07', best: [], worst: [] });
    expect(r.tie_rule).toMatch(/thumbs up/);
  });

  it('ranks by share of thumbs up, with the counts', () => {
    rate('i-08', 'up', day(10)); rate('i-08', 'up', day(11));
    rate('i-02', 'up', day(12)); rate('i-02', 'down', day(13)); rate('i-02', 'down', day(14));
    const r = getRatings('2026-11-07');
    expect(r.best[0]).toMatchObject({ item_id: 'i-08', up: 2, total: 2, share: 1 });
    expect(r.worst[0]).toMatchObject({ item_id: 'i-02', up: 1, total: 3 });
    expect(r.worst[0].share).toBeCloseTo(1 / 3);
  });

  it('breaks ties by more ratings, then by name', () => {
    rate('i-08', 'up', day(10)); // Chocolate Fondant 1/1
    rate('i-09', 'up', day(10)); rate('i-09', 'up', day(11)); // Crème Brûlée 2/2
    rate('i-01', 'up', day(10)); // Garlic Bread 1/1
    expect(getRatings('2026-11-07').best.map((d) => d.name)).toEqual(['Crème Brûlée', 'Chocolate Fondant', 'Garlic Bread']);
    // worst: same share (all 1) so also more ratings first, then name
    expect(getRatings('2026-11-07').worst.map((d) => d.name)).toEqual(['Crème Brûlée', 'Chocolate Fondant', 'Garlic Bread']);
  });

  it('lists at most 3 of each', () => {
    for (const id of ['i-01', 'i-02', 'i-03', 'i-04', 'i-05']) rate(id, 'up', day(10));
    const r = getRatings('2026-11-07');
    expect(r.best).toHaveLength(3);
    expect(r.worst).toHaveLength(3);
  });

  it('counts a rating on the local day it was made, not the day its visit closed', () => {
    const visit = makeClosedVisit(1, localIso(2026, 11, 7, 23, 58), [{ placedAt: localIso(2026, 11, 7, 23), completedAt: localIso(2026, 11, 7, 23, 5), lines: [line('i-08', 1, 100)] }]);
    addRating(visit, 'i-08', 'up', localIso(2026, 11, 8, 0, 3));
    expect(getRatings('2026-11-07').best).toEqual([]);
    expect(getRatings('2026-11-08').best).toHaveLength(1);
  });

  it('reads both stored time formats', () => {
    rate('i-08', 'up', localSqlite(2026, 11, 7, 10));
    rate('i-09', 'down', localIso(2026, 11, 7, 11));
    expect(getRatings('2026-11-07').best.map((d) => d.item_id).sort()).toEqual(['i-08', 'i-09']);
  });

  it('an unreadable day is refused, naming the field', () => {
    expect(() => getRatings('today')).toThrowError(expect.objectContaining({ code: 'INVALID_REQUEST', details: { field: 'day' } }));
  });
});
