// U8 Step 5: the TV wall's read-only repository functions and the shared Sales rules
// (BR2.1, BR2.2, BR3.2, BR3.4, BR4.1, BR4.2, BR5.1).
process.env.DB_FILE = ':memory:';

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getOpenOrdersAllTables, getTodayOrderCountsByTable, getTodayPortionsByItem } from '../../repositories/orderRepo.js';
import { listOpenCallsAllTables } from '../../repositories/serviceCallRepo.js';
import { buildBill, openVisitsBillTotalCents } from '../../repositories/billingRepo.js';
import { closedDayTakingsCents, dayOfStoredTime, dayWindow, lineTotalCents } from '../../salesRules.js';
import { addCall, addOrder, cleanup, freshApp, line, localIso, localSqlite, makeClosedVisit, openTable } from './fixtures.js';

const TODAY = '2026-11-10';

describe('open orders across all tables (BR2.1, BR2.2)', () => {
  beforeEach(freshApp);
  afterEach(cleanup);

  it('lists every Pending or Preparing order whatever day it was placed, and leaves Completed and Cancelled out', () => {
    const v = openTable(1);
    const yesterday = addOrder(v, 1, { status: 'Preparing', placedAt: localSqlite(2026, 11, 9, 21, 0), lines: [line('i-04', 1, 1450)] });
    const today = addOrder(v, 1, { status: 'Pending', placedAt: localIso(2026, 11, 10, 12, 0), lines: [line('i-10', 2, 350)] });
    addOrder(v, 1, { status: 'Completed', placedAt: localIso(2026, 11, 10, 11, 0), lines: [line('i-10', 1, 350)] });
    addOrder(v, 1, { status: 'Cancelled', placedAt: localIso(2026, 11, 10, 11, 30), lines: [line('i-10', 1, 350)] });
    expect(getOpenOrdersAllTables().map((o) => [o.order_number, o.status])).toEqual([
      [yesterday, 'Preparing'],
      [today, 'Pending'],
    ]);
  });

  it('orders oldest first by instant across both stored formats, a tie going to the lower order number', () => {
    const a = openTable(2);
    const b = openTable(3);
    const late = addOrder(a, 2, { placedAt: localIso(2026, 11, 10, 12, 30), lines: [line('i-01', 1, 650)] });
    const tieSecond = addOrder(b, 3, { placedAt: localIso(2026, 11, 10, 12, 0), lines: [line('i-01', 1, 650)] });
    const tieFirstSqlite = addOrder(a, 2, { placedAt: localSqlite(2026, 11, 10, 12, 0), lines: [line('i-01', 1, 650)] });
    const early = addOrder(b, 3, { placedAt: localSqlite(2026, 11, 10, 11, 59), lines: [line('i-01', 1, 650)] });
    // tieSecond was numbered before tieFirstSqlite, so at the same instant it comes first
    expect(getOpenOrdersAllTables().map((o) => o.order_number)).toEqual([early, tieSecond, tieFirstSqlite, late]);
    expect(getOpenOrdersAllTables()[0]).toMatchObject({ table_id: 3, placed_at: localSqlite(2026, 11, 10, 11, 59) });
  });

  it('sizes each order in portions, 0 for an order with no lines', () => {
    const v = openTable(4);
    const big = addOrder(v, 4, { placedAt: localIso(2026, 11, 10, 10), lines: [line('i-04', 2, 1450), line('i-10', 3, 350)] });
    const bare = addOrder(v, 4, { placedAt: localIso(2026, 11, 10, 10, 5), lines: [] });
    expect(getOpenOrdersAllTables().map((o) => [o.order_number, o.portions])).toEqual([
      [big, 5],
      [bare, 0],
    ]);
  });
});

describe("today's counts and portions (BR3.4, BR4.1, BR4.2)", () => {
  beforeEach(freshApp);
  afterEach(cleanup);

  it('counts non-cancelled orders placed today per table, open and closed visits alike, most first and a tie to the lower table', () => {
    const t5 = openTable(5);
    addOrder(t5, 5, { placedAt: localIso(2026, 11, 10, 9), lines: [line('i-01', 1, 650)] });
    addOrder(t5, 5, { status: 'Cancelled', placedAt: localIso(2026, 11, 10, 9, 5), lines: [line('i-01', 1, 650)] });
    makeClosedVisit(2, localIso(2026, 11, 10, 11), [{ placedAt: localIso(2026, 11, 10, 10), lines: [line('i-02', 1, 850)] }]);
    makeClosedVisit(9, localIso(2026, 11, 10, 13), [
      { placedAt: localIso(2026, 11, 10, 12), lines: [line('i-02', 1, 850)] },
      { placedAt: localIso(2026, 11, 10, 12, 10), lines: [] }, // an order with no lines still counts
    ]);
    makeClosedVisit(1, localIso(2026, 11, 9, 20), [{ placedAt: localIso(2026, 11, 9, 19), lines: [line('i-02', 1, 850)] }]); // yesterday
    expect(getTodayOrderCountsByTable(TODAY)).toEqual([
      { table_id: 9, orders: 2 },
      { table_id: 2, orders: 1 },
      { table_id: 5, orders: 1 },
    ]);
    expect(getTodayOrderCountsByTable('2026-11-01')).toEqual([]);
  });

  it("adds up today's portions per item with the live name, cancelled orders left out, a tie to the name first in the alphabet", () => {
    const v = openTable(3);
    addOrder(v, 3, { placedAt: localIso(2026, 11, 10, 9), lines: [line('i-12', 2, 400), line('i-08', 1, 950)] });
    addOrder(v, 3, { placedAt: localIso(2026, 11, 10, 9, 30), lines: [line('i-08', 1, 950)] });
    addOrder(v, 3, { placedAt: localIso(2026, 11, 10, 9, 40), lines: [] });
    addOrder(v, 3, { status: 'Cancelled', placedAt: localIso(2026, 11, 10, 9, 45), lines: [line('i-12', 5, 400)] });
    addOrder(v, 3, { placedAt: localIso(2026, 11, 9, 9, 45), lines: [line('i-12', 9, 400)] }); // yesterday
    // Chocolate Fondant 2 and House Coffee 2 tie: "Chocolate Fondant" comes first in the alphabet
    expect(getTodayPortionsByItem(TODAY)).toEqual([
      { item_id: 'i-08', name: 'Chocolate Fondant', portions: 2 },
      { item_id: 'i-12', name: 'House Coffee', portions: 2 },
    ]);
  });

  it('decides "today" by the server-local day for both stored formats, right around midnight', () => {
    const v = openTable(6);
    addOrder(v, 6, { placedAt: localSqlite(2026, 11, 9, 23, 55), lines: [line('i-10', 1, 350)] }); // yesterday, v1 text
    addOrder(v, 6, { placedAt: localIso(2026, 11, 9, 23, 59), lines: [line('i-10', 1, 350)] }); // yesterday, ISO
    addOrder(v, 6, { placedAt: localSqlite(2026, 11, 10, 0, 5), lines: [line('i-11', 1, 450)] }); // today, v1 text
    addOrder(v, 6, { placedAt: localIso(2026, 11, 10, 23, 55), lines: [line('i-11', 2, 450)] }); // today, ISO
    addOrder(v, 6, { placedAt: localIso(2026, 11, 11, 0, 5), lines: [line('i-10', 4, 350)] }); // tomorrow
    expect(getTodayOrderCountsByTable(TODAY)).toEqual([{ table_id: 6, orders: 2 }]);
    expect(getTodayPortionsByItem(TODAY)).toEqual([{ item_id: 'i-11', name: 'Fresh Orange Juice', portions: 3 }]);
    expect(dayOfStoredTime(localSqlite(2026, 11, 10, 0, 5))).toBe(TODAY);
    expect(dayOfStoredTime('not a time')).toBeNull();
  });
});

describe('the shared Sales rules (BR3.1, BR3.4)', () => {
  beforeEach(freshApp);
  afterEach(cleanup);

  it('the day window runs from the day before to two days after, across month and year ends', () => {
    expect(dayWindow(TODAY)).toEqual({ from: '2026-11-09', to: '2026-11-12' });
    expect(dayWindow('2026-12-31')).toEqual({ from: '2026-12-30', to: '2027-01-02' });
    expect(dayWindow('2026-03-01')).toEqual({ from: '2026-02-28', to: '2026-03-03' });
    expect(lineTotalCents({ quantity: 3, unit_price_cents: 450 })).toBe(1350);
  });

  it("closedDayTakingsCents sums only the day's closed visits, frozen prices, cancelled orders left out", () => {
    makeClosedVisit(1, localSqlite(2026, 11, 10, 0, 5), [{ placedAt: localSqlite(2026, 11, 9, 23, 50), lines: [line('i-04', 2, 1000)] }]);
    makeClosedVisit(2, localIso(2026, 11, 10, 23, 55), [
      { placedAt: localIso(2026, 11, 10, 23), lines: [line('i-10', 1, 350)] },
      { status: 'Cancelled', placedAt: localIso(2026, 11, 10, 23, 1), lines: [line('i-05', 5, 1850)] },
    ]);
    makeClosedVisit(3, localIso(2026, 11, 9, 23, 55), [{ placedAt: localIso(2026, 11, 9, 23), lines: [line('i-04', 1, 1450)] }]); // yesterday
    addOrder(openTable(4), 4, { placedAt: localIso(2026, 11, 10, 12), lines: [line('i-04', 3, 1450)] }); // still open
    expect(closedDayTakingsCents(TODAY)).toBe(2350);
    expect(closedDayTakingsCents('2026-11-09')).toBe(1450);
    expect(closedDayTakingsCents('2026-11-08')).toBe(0);
  });
});

describe('money on open tables and open requests (BR3.2, BR5.1)', () => {
  beforeEach(freshApp);
  afterEach(cleanup);

  it('the open-table total equals the sum of every table\'s live bill: cancelled orders and closed visits left out', () => {
    const t1 = openTable(1);
    addOrder(t1, 1, { status: 'Completed', placedAt: localIso(2026, 11, 10, 9), lines: [line('i-04', 2, 1450)] });
    addOrder(t1, 1, { status: 'Cancelled', placedAt: localIso(2026, 11, 10, 9, 5), lines: [line('i-05', 1, 1850)] });
    const t2 = openTable(2);
    addOrder(t2, 2, { placedAt: localSqlite(2026, 11, 9, 22), lines: [line('i-10', 3, 350), line('i-08', 1, 1000)] }); // opened yesterday, still open
    addOrder(t2, 2, { placedAt: localIso(2026, 11, 10, 9), lines: [] });
    makeClosedVisit(3, localIso(2026, 11, 10, 8), [{ placedAt: localIso(2026, 11, 10, 7), lines: [line('i-04', 5, 1450)] }]);

    const billSum = Array.from({ length: 10 }, (_, i) => buildBill(i + 1).combined_total_cents).reduce((s, n) => s + n, 0);
    expect(openVisitsBillTotalCents()).toBe(billSum);
    expect(openVisitsBillTotalCents()).toBe(2900 + 1050 + 1000);
  });

  it('lists only open requests, across all tables, oldest first', () => {
    const t4 = openTable(4);
    const t7 = openTable(7);
    const later = addCall(t4, 4, 'bill', '2026-11-10T12:05:00.000Z');
    addCall(t4, 4, 'waiter', '2026-11-10T11:00:00.000Z', '2026-11-10T11:02:00.000Z'); // answered
    const oldest = addCall(t7, 7, 'waiter', '2026-11-10T12:00:00.000Z');
    expect(listOpenCallsAllTables()).toEqual([
      { call_id: oldest, table_id: 7, kind: 'waiter', opened_at: '2026-11-10T12:00:00.000Z' },
      { call_id: later, table_id: 4, kind: 'bill', opened_at: '2026-11-10T12:05:00.000Z' },
    ]);
  });

  it('with nothing open, every read answers empty or zero', () => {
    expect(getOpenOrdersAllTables()).toEqual([]);
    expect(listOpenCallsAllTables()).toEqual([]);
    expect(openVisitsBillTotalCents()).toBe(0);
    expect(closedDayTakingsCents(TODAY)).toBe(0);
  });
});
