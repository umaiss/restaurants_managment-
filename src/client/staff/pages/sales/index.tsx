/**
 * The Past visits and sales page (U7 Step 12). Rules: BR7.1 to BR7.4 (one card per day, newest first), BR7.5 (the
 * empty and failed states with their words), BR7.6 (today's best and worst rated dishes). A day is the day a visit
 * was closed, in the server's local time; the ratings are for the day they were made, so the two can differ near
 * midnight, which is intended.
 */
import React, { useMemo, useState } from 'react';
import { Button } from '../../../components/ui/index';
import { formatMoney } from '../../../components/staff/money';
import { useLiveRead } from '../useLiveRead';
import DayCard, { type SalesDay } from './DayCard';
import RatedDishes, { type RatingsReport } from './RatedDishes';
import '../../staff-u7.css';

const SALES_EVENTS = ['TABLE_CLOSED', 'ORDER_STATUS_CHANGED'] as const;

/** Today as YYYY-MM-DD in this browser's local time (the server and the browser run on the same restaurant clock). */
export function todayText(now: Date = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

/** "2026-11" from "2026-11-07". */
export const monthOf = (day: string): string => day.slice(0, 7);

/** "November 2026" from "2026-11" (read as a local date, so the month never shifts). */
export function monthLabel(month: string): string {
  const [y, m] = month.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
}

const ALL_MONTHS = 'all';

export default function SalesPage() {
  const today = todayText();
  const [month, setMonth] = useState<string>(ALL_MONTHS);
  const sales = useLiveRead<{ days: SalesDay[] }>('/api/staff/sales', SALES_EVENTS);
  const ratings = useLiveRead<RatingsReport>(`/api/staff/ratings?day=${today}`, SALES_EVENTS);

  const allDays = sales.data?.days ?? null;

  // The months to pick from: every month with a closed visit, and this month, newest first.
  const months = useMemo(() => {
    const set = new Set<string>([monthOf(today)]);
    for (const d of allDays ?? []) set.add(monthOf(d.day));
    return [...set].sort().reverse();
  }, [allDays, today]);

  const filtering = month !== ALL_MONTHS;
  const days = allDays === null ? null : filtering ? allDays.filter((d) => monthOf(d.day) === month) : allDays;
  const todayInList = days?.some((d) => d.day === today) ?? false;
  const showTodayRatings = !filtering || month === monthOf(today);
  const monthTotals = useMemo(
    () => (days ?? []).reduce((t, d) => ({ visits: t.visits + d.visits, orders: t.orders + d.orders, cents: t.cents + d.total_cents }), { visits: 0, orders: 0, cents: 0 }),
    [days]
  );

  return (
    <section data-testid="sales-page" className="stack" style={{ gap: 'var(--space-4)' }}>
      <div className="page-head">
        <h1 style={{ margin: 0 }}>Past visits and sales</h1>
      </div>

      {allDays !== null && allDays.length > 0 && (
        <div className="row" style={{ alignItems: 'center', gap: 'var(--space-3)' }}>
          <label htmlFor="sales-month" style={{ fontWeight: 600 }}>
            Month
          </label>
          <select
            id="sales-month"
            className="input"
            data-testid="sales-month"
            style={{ width: 'auto', minWidth: 200 }}
            value={month}
            onChange={(e) => setMonth(e.target.value)}
          >
            <option value={ALL_MONTHS}>All months</option>
            {months.map((m) => (
              <option key={m} value={m}>
                {monthLabel(m)}
              </option>
            ))}
          </select>
        </div>
      )}

      {sales.loading && days === null && <p data-testid="sales-loading" className="secondary">Loading sales…</p>}
      {sales.error && days === null && (
        <div data-testid="sales-error" role="alert" className="stack">
          <p style={{ margin: 0 }}>Sales could not be loaded. Try again.</p>
          <Button small onClick={sales.reload}>
            Retry
          </Button>
        </div>
      )}
      {sales.error && days !== null && (
        <p role="status" className="error-text" style={{ margin: 0 }}>
          Sales could not be refreshed. What is shown may be out of date.
        </p>
      )}

      {allDays !== null && allDays.length === 0 && (
        <p data-testid="sales-empty" className="secondary" style={{ margin: 0 }}>
          No closed visits yet.
        </p>
      )}
      {allDays !== null && allDays.length > 0 && days !== null && days.length === 0 && (
        <p data-testid="sales-month-empty" className="secondary" style={{ margin: 0 }}>
          No closed visits in {monthLabel(month)}.
        </p>
      )}
      {filtering && days !== null && days.length > 0 && (
        <p data-testid="sales-month-total" className="secondary" style={{ margin: 0 }}>
          {monthLabel(month)}: {monthTotals.visits} {monthTotals.visits === 1 ? 'visit' : 'visits'} · {monthTotals.orders}{' '}
          {monthTotals.orders === 1 ? 'order' : 'orders'} · {formatMoney(monthTotals.cents)} in sales
        </p>
      )}

      {/* Today's ratings sit in today's card; with no closed visit today they have a card of their own */}
      {days !== null && !todayInList && showTodayRatings && (
        <section className="card stack" data-testid="ratings-today" aria-label="Rated dishes today">
          <h2 style={{ margin: 0 }}>Today's ratings</h2>
          <RatedDishes report={ratings.data} error={ratings.error} />
        </section>
      )}

      {days?.map((d) => (
        <DayCard key={d.day} day={d} isToday={d.day === today}>
          {d.day === today ? <RatedDishes report={ratings.data} error={ratings.error} /> : <p className="help" style={{ margin: 0 }}>No ratings shown for this day.</p>}
        </DayCard>
      ))}
    </section>
  );
}
