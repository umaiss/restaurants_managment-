/**
 * The Past visits and sales page (U7 Step 12). Rules: BR7.1 to BR7.4 (one card per day, newest first), BR7.5 (the
 * empty and failed states with their words), BR7.6 (today's best and worst rated dishes). A day is the day a visit
 * was closed, in the server's local time; the ratings are for the day they were made, so the two can differ near
 * midnight, which is intended.
 */
import React from 'react';
import { Button } from '../../../components/ui/index';
import { useLiveRead } from '../useLiveRead';
import DayCard, { type SalesDay } from './DayCard';
import RatedDishes, { type RatingsReport } from './RatedDishes';
import '../../staff-u7.css';

const SALES_EVENTS = ['TABLE_CLOSED', 'ORDER_STATUS_CHANGED'] as const;

/** Today as YYYY-MM-DD in this browser's local time (the server and the browser run on the same restaurant clock). */
export function todayText(now: Date = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

export default function SalesPage() {
  const today = todayText();
  const sales = useLiveRead<{ days: SalesDay[] }>('/api/staff/sales', SALES_EVENTS);
  const ratings = useLiveRead<RatingsReport>(`/api/staff/ratings?day=${today}`, SALES_EVENTS);

  const days = sales.data?.days ?? null;
  const todayInList = days?.some((d) => d.day === today) ?? false;

  return (
    <section data-testid="sales-page" className="stack" style={{ gap: 'var(--space-4)' }}>
      <div className="page-head">
        <h1 style={{ margin: 0 }}>Past visits and sales</h1>
      </div>

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

      {days !== null && days.length === 0 && (
        <p data-testid="sales-empty" className="secondary" style={{ margin: 0 }}>
          No closed visits yet.
        </p>
      )}

      {/* Today's ratings sit in today's card; with no closed visit today they have a card of their own */}
      {days !== null && !todayInList && (
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
