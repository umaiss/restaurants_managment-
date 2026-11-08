// @vitest-environment jsdom
/// <reference types="vitest/globals" />
// U7 Step 13: the Past visits and sales page (BR7.1 to BR7.6).
import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor, within, act } from '@testing-library/react';
import SalesPage, { todayText } from '../index';
import { averageText, dayHeading } from '../DayCard';
import { bestLine, worstLine } from '../RatedDishes';
import { calledWith, emitAll, failed, ok, stubStream } from '../../../__tests__/u7Mocks';

const today = todayText();
const day = (d: string, over: object = {}) => ({
  day: d, visits: 6, orders: 14, total_cents: 31250, average_minutes: 11, average_per_visit_cents: 5208,
  best_sellers: [{ item_id: 'i-04', name: 'Classic Burger', quantity: 9 }, { item_id: 'i-10', name: 'Sparkling Water', quantity: 8 }, { item_id: 'i-02', name: 'House Salad', quantity: 6 }],
  ...over,
});
const dish = (id: string, name: string, up: number, total: number) => ({ item_id: id, name, up, total, share: up / total });

let sales: { days: object[] };
let ratings: object;
let fetchMock: import('vitest').Mock<any[], any>;

beforeEach(() => {
  stubStream();
  sales = { days: [day(today), day('2026-11-06', { visits: 9, orders: 21, total_cents: 46800, average_minutes: null, average_per_visit_cents: 5200 })] };
  ratings = { day: today, best: [dish('i-08', 'Chocolate Fondant', 5, 5)], worst: [dish('i-02', 'House Salad', 1, 3)], tie_rule: 'Ranked by the share of thumbs up. Ties go to the dish with more ratings, then to the name in alphabetical order.' };
  fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.startsWith('/api/staff/sales')) return ok(sales);
    if (url.startsWith('/api/staff/ratings')) return ok(ratings);
    return failed(404);
  });
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('one card per day (BR7.1 to BR7.4)', () => {
  it('shows each day newest first with visits, orders, total sales, the average and the average per visit', async () => {
    render(<SalesPage />);
    const todayCard = await screen.findByTestId('sales-day-today');
    expect(todayCard).toHaveTextContent('6 visits · 14 orders');
    expect(within(todayCard).getByTestId('sales-total')).toHaveTextContent('$312.50');
    expect(within(todayCard).getByTestId('sales-average')).toHaveTextContent('11 min');
    expect(todayCard).toHaveTextContent('Average time to Completed');
    expect(todayCard).toHaveTextContent('$52.08');
    expect(todayCard).toHaveTextContent('Average per visit');
    const cards = screen.getAllByTestId(/^sales-day-/);
    expect(cards.map((c) => c.getAttribute('data-testid'))).toEqual(['sales-day-today', 'sales-day-2026-11-06']);
  });

  it('says "No completed orders" when a day has none, never 0 min', async () => {
    render(<SalesPage />);
    const card = await screen.findByTestId('sales-day-2026-11-06');
    expect(within(card).getByTestId('sales-average')).toHaveTextContent('No completed orders');
    expect(card).not.toHaveTextContent('0 min');
  });

  it('lists best sellers in rank order with their quantities', async () => {
    render(<SalesPage />);
    const table = within(await screen.findByTestId('sales-day-today')).getByTestId('best-sellers');
    const rows = within(table).getAllByRole('row').slice(1).map((r) => r.textContent);
    expect(rows).toEqual(['1. Classic Burger9', '2. Sparkling Water8', '3. House Salad6']);
  });

  it('uses singular words for one visit and one order', async () => {
    sales = { days: [day(today, { visits: 1, orders: 1 })] };
    render(<SalesPage />);
    expect(await screen.findByTestId('sales-day-today')).toHaveTextContent('1 visit · 1 order');
  });

  it('shows an average with one decimal when it is not whole', () => {
    expect(averageText(11)).toBe('11 min');
    expect(averageText(11.3)).toBe('11.3 min');
    expect(averageText(null)).toBe('No completed orders');
  });

  it('writes the day as a heading like "Saturday 7 November"', () => {
    expect(dayHeading('2026-11-07')).toBe('Saturday 7 November');
    expect(dayHeading('2026-01-01')).toBe('Thursday 1 January');
  });

  it('shows menu text as text', async () => {
    sales = { days: [day(today, { best_sellers: [{ item_id: 'x', name: '<b>Bold</b>', quantity: 1 }] })] };
    render(<SalesPage />);
    const table = await screen.findByTestId('best-sellers');
    expect(table).toHaveTextContent('<b>Bold</b>');
    expect(table.querySelector('b')).toBeNull();
  });
});

describe('empty and failed states (BR7.5)', () => {
  it('"No closed visits yet." for an empty list', async () => {
    sales = { days: [] };
    render(<SalesPage />);
    expect(await screen.findByTestId('sales-empty')).toHaveTextContent('No closed visits yet.');
  });

  it('"Sales could not be loaded. Try again." with Retry, and Retry works', async () => {
    let fail = true;
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.startsWith('/api/staff/sales')) return fail ? failed(500) : ok(sales);
      return ok(ratings);
    });
    render(<SalesPage />);
    expect(await screen.findByTestId('sales-error')).toHaveTextContent('Sales could not be loaded. Try again.');
    fail = false;
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByTestId('sales-day-today')).toBeInTheDocument();
  });

  it('a failed refresh keeps the cards on screen and says so', async () => {
    render(<SalesPage />);
    await screen.findByTestId('sales-day-today');
    fetchMock.mockImplementation(async () => failed(500));
    act(() => emitAll('TABLE_CLOSED', { table_id: 1, archived_visit_id: 'v' }));
    expect(await screen.findByText(/could not be refreshed/)).toBeInTheDocument();
    expect(screen.getByTestId('sales-day-today')).toBeInTheDocument();
  });

  it('reads again when a table closes', async () => {
    render(<SalesPage />);
    await screen.findByTestId('sales-day-today');
    const before = calledWith(fetchMock, '/api/staff/sales').length;
    sales = { days: [day(today, { visits: 7 })] };
    act(() => emitAll('TABLE_CLOSED', { table_id: 1, archived_visit_id: 'v' }));
    await waitFor(() => expect(screen.getByTestId('sales-day-today')).toHaveTextContent('7 visits'));
    expect(calledWith(fetchMock, '/api/staff/sales').length).toBeGreaterThan(before);
  });
});

describe('best and worst rated (BR7.6)', () => {
  it('asks for today\'s ratings and shows best and worst with the share and the number of ratings', async () => {
    render(<SalesPage />);
    const best = await screen.findByTestId('ratings-best');
    expect(best).toHaveTextContent('Best rated today');
    expect(best).toHaveTextContent('Chocolate Fondant');
    expect(best).toHaveTextContent('👍 100% · 5 ratings');
    const worst = screen.getByTestId('ratings-worst');
    expect(worst).toHaveTextContent('Worst rated today');
    expect(worst).toHaveTextContent('House Salad');
    expect(worst).toHaveTextContent('👎 67% thumbs down · 3 ratings');
    expect(calledWith(fetchMock, `/api/staff/ratings?day=${today}`)).toHaveLength(1);
  });

  it('states the tie rule in words', async () => {
    render(<SalesPage />);
    expect(await screen.findByText(/Ties go to the dish with more ratings/)).toBeInTheDocument();
  });

  it('with no ratings it says "No ratings yet today."', async () => {
    ratings = { day: today, best: [], worst: [], tie_rule: 'x' };
    render(<SalesPage />);
    expect(await screen.findByTestId('ratings-none')).toHaveTextContent('No ratings yet today.');
    expect(screen.queryByTestId('ratings-best')).toBeNull();
  });

  it('with no closed visit today the ratings still show, in a card of their own', async () => {
    sales = { days: [day('2026-11-06')] };
    render(<SalesPage />);
    const card = await screen.findByTestId('ratings-today');
    expect(within(card).getByTestId('ratings-best')).toBeInTheDocument();
  });

  it('a failed ratings read says so beside the card and does not hide the sales', async () => {
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => (String(input).startsWith('/api/staff/ratings') ? failed(500) : ok(sales)));
    render(<SalesPage />);
    expect(await screen.findByTestId('ratings-error')).toHaveTextContent('Ratings could not be loaded.');
    expect(screen.getByTestId('sales-day-today')).toBeInTheDocument();
  });

  it('the lines read well for one rating and for a tie', () => {
    expect(bestLine(dish('a', 'A', 1, 1))).toBe('👍 100% · 1 rating');
    expect(worstLine(dish('a', 'A', 1, 2))).toBe('👎 50% thumbs down · 2 ratings');
  });
});
