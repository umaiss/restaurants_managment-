/**
 * One day of past visits (U7 Step 12). Rules: BR7.1 (visits, orders and total sales of the day), BR7.2 (best sellers
 * by quantity), BR7.3 (the average minutes to Completed, or "No completed orders", never 0), BR7.4 (money is whole
 * cents shown as dollars; Cancelled orders are not in any figure, which is the server's work).
 */
import React from 'react';
import { formatMoney } from '../../../components/staff/money';
import '../../staff-u7.css';

export interface SalesDay {
  day: string;
  visits: number;
  orders: number;
  total_cents: number;
  average_minutes: number | null;
  average_per_visit_cents: number;
  best_sellers: Array<{ item_id: string; name: string; quantity: number }>;
}

/** "Saturday 7 November" from "2026-11-07" (read as a local date, so the day never shifts). */
export function dayHeading(day: string): string {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
}

export function averageText(minutes: number | null): string {
  return minutes === null ? 'No completed orders' : `${Number.isInteger(minutes) ? minutes : minutes.toFixed(1)} min`;
}

const plural = (n: number, one: string) => `${n} ${n === 1 ? one : `${one}s`}`;

export default function DayCard({ day, isToday, children }: { day: SalesDay; isToday: boolean; children?: React.ReactNode }) {
  return (
    <section className="card stack" style={{ gap: 'var(--space-3)' }} aria-labelledby={`day-${day.day}`} data-testid={isToday ? 'sales-day-today' : `sales-day-${day.day}`}>
      <div className="u7-between">
        <h2 id={`day-${day.day}`} style={{ margin: 0 }}>
          {dayHeading(day.day)}
        </h2>
        <span className="secondary">
          {plural(day.visits, 'visit')} · {plural(day.orders, 'order')}
        </span>
      </div>
      <div className="u7-stats">
        <div className="u7-stat">
          <div className="v num" data-testid="sales-total">
            {formatMoney(day.total_cents)}
          </div>
          <div className="k">Total sales</div>
        </div>
        <div className="u7-stat">
          <div className="v num" data-testid="sales-average" style={day.average_minutes === null ? { fontSize: 'var(--text-md)' } : undefined}>
            {averageText(day.average_minutes)}
          </div>
          <div className="k">Average time to Completed</div>
        </div>
        <div className="u7-stat">
          <div className="v num">{formatMoney(day.average_per_visit_cents)}</div>
          <div className="k">Average per visit</div>
        </div>
      </div>
      {day.best_sellers.length > 0 && (
        <table className="u7-data" aria-label="Best sellers" data-testid="best-sellers">
          <thead>
            <tr>
              <th>Best sellers</th>
              <th className="r">Sold</th>
            </tr>
          </thead>
          <tbody>
            {day.best_sellers.map((b, i) => (
              <tr key={b.item_id}>
                <td>
                  {i + 1}. {b.name}
                </td>
                <td className="r">{b.quantity}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {children}
    </section>
  );
}
