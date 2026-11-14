// U8 Step 3 (BR10.1, US3.1): the Sales page's exact output for a fixed dataset, written and run BEFORE the day and
// line rules moved into src/server/salesRules.ts. It must pass unchanged after the move.
process.env.DB_FILE = ':memory:';

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getSales } from '../../routes/u7/sales.js';
import { addOrder, cleanup, freshApp, line, localIso, localSqlite, makeClosedVisit, openTable } from './fixtures.js';

/**
 * Two local days, D1 = 2026-11-07 and D2 = 2026-11-08, with visits closed just before and just after local
 * midnight in both stored time formats, cancelled orders, an order with no lines, a still-open visit and a
 * best-seller tie on D2.
 */
function buildDataset(): void {
  // D1, closed 23:55 in v1's text form: 2 Classic Burger + 1 Sparkling Water (completed after 15 min), and a cancelled order.
  makeClosedVisit(1, localSqlite(2026, 11, 7, 23, 55), [
    { placedAt: localSqlite(2026, 11, 7, 23, 30), completedAt: localSqlite(2026, 11, 7, 23, 45), lines: [line('i-04', 2, 1450), line('i-10', 1, 350)] },
    { status: 'Cancelled', placedAt: localSqlite(2026, 11, 7, 23, 31), lines: [line('i-05', 5, 1850)] },
  ]);
  // D1, closed 00:05 in ISO: 3 House Coffee, completed with no time recorded.
  makeClosedVisit(5, localIso(2026, 11, 7, 0, 5), [{ placedAt: localIso(2026, 11, 7, 0, 1), completedAt: null, lines: [line('i-12', 3, 400)] }]);
  // D2, closed 00:05 in ISO: 2 House Salad + 1 Classic Burger (placed on D1, completed after 12 min), and an order with no lines.
  makeClosedVisit(2, localIso(2026, 11, 8, 0, 5), [
    { placedAt: localIso(2026, 11, 7, 23, 50), completedAt: localIso(2026, 11, 8, 0, 2), lines: [line('i-02', 2, 850), line('i-04', 1, 1450)] },
    { placedAt: localIso(2026, 11, 7, 23, 52), completedAt: null, lines: [] },
  ]);
  // D2, closed at noon: 2 Chocolate Fondant, and a cancelled order of 4 more that must not break the tie.
  makeClosedVisit(3, localIso(2026, 11, 8, 12, 0), [
    { placedAt: localIso(2026, 11, 8, 11, 30), completedAt: null, lines: [line('i-08', 2, 950)] },
    { status: 'Cancelled', placedAt: localIso(2026, 11, 8, 11, 31), lines: [line('i-08', 4, 950)] },
  ]);
  // D2, closed 23:55 in v1's text form: 1 Fresh Orange Juice, completed after 10 min.
  makeClosedVisit(4, localSqlite(2026, 11, 8, 23, 55), [
    { placedAt: localSqlite(2026, 11, 8, 23, 40), completedAt: localSqlite(2026, 11, 8, 23, 50), lines: [line('i-11', 1, 450)] },
  ]);
  // D2: a visit whose only order was cancelled still counts as a visit.
  makeClosedVisit(7, localIso(2026, 11, 8, 18, 0), [{ status: 'Cancelled', placedAt: localIso(2026, 11, 8, 17, 30), lines: [line('i-01', 1, 650)] }]);
  // A visit that is still open counts nowhere.
  addOrder(openTable(6), 6, { placedAt: localIso(2026, 11, 8, 20, 0), lines: [line('i-04', 9, 1450)] });
}

const D2 = {
  day: '2026-11-08',
  visits: 4,
  orders: 4,
  total_cents: 5500,
  average_minutes: 11,
  average_per_visit_cents: 1375,
  best_sellers: [
    { item_id: 'i-08', name: 'Chocolate Fondant', quantity: 2 },
    { item_id: 'i-02', name: 'House Salad', quantity: 2 },
    { item_id: 'i-04', name: 'Classic Burger', quantity: 1 },
    { item_id: 'i-11', name: 'Fresh Orange Juice', quantity: 1 },
  ],
};
const D1 = {
  day: '2026-11-07',
  visits: 2,
  orders: 2,
  total_cents: 4450,
  average_minutes: 15,
  average_per_visit_cents: 2225,
  best_sellers: [
    { item_id: 'i-12', name: 'House Coffee', quantity: 3 },
    { item_id: 'i-04', name: 'Classic Burger', quantity: 2 },
    { item_id: 'i-10', name: 'Sparkling Water', quantity: 1 },
  ],
};

describe('Sales regression (BR10.1): getSales() output is fixed for a fixed dataset', () => {
  beforeEach(freshApp);
  afterEach(cleanup);

  it('returns exactly the same days, counts, totals, averages and best sellers, with and without a date filter', () => {
    buildDataset();
    expect(getSales()).toEqual([D2, D1]);
    expect(getSales({ from: '2026-11-08', to: '2026-11-08' })).toEqual([D2]);
    expect(getSales({ to: '2026-11-07' })).toEqual([D1]);
  });
});
