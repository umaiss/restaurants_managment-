/**
 * The plain TV wall page at /staff/tv (U8 only; U9 replaces its look and keeps useTvWall() and the route).
 * It fills the screen: the staff shell shows no navigation for it (BR9.1). It renders from useTvWall() only.
 * Rules: BR2.3 to BR2.6 (waits on the server clock, Slow and Late as words, the oldest wait, "No open orders"),
 * BR3.3 and BR3.5 ("Takings hidden" in both places; zero shown as an amount), BR4.1 and BR4.2 ("No orders yet",
 * "No dishes yet"), BR7.6 ("Live", "Reconnecting… last update HH:MM", the error words).
 */
import React from 'react';
import { formatMoney } from '../../../components/staff/money';
import { useStaffSSE } from '../../../hooks/useStaffSSE';
import { waitLabel, waitLevel, waitMinutes } from '../../../../shared/tvWall';
import { useTvWall } from './useTvWall';
import '../../tv.css';

/** "HH:MM" in this browser's local time. */
export function clockText(date: Date): string {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export default function TvWallPage() {
  const { status, connection, lastUpdatedAt, summary, now } = useTvWall();
  // The same shared staff stream the hook uses; shown as data-sse so tests (and people) can see it is open.
  const { connected } = useStaffSSE();

  const connectionText =
    status === 'error'
      ? "Can't reach the restaurant server. Trying again…"
      : status === 'loading'
        ? 'Loading…'
        : connection === 'live'
          ? 'Live'
          : `Reconnecting… last update ${lastUpdatedAt ? clockText(lastUpdatedAt) : '--:--'}`;

  const orders = summary?.orders ?? [];
  const oldest = orders[0];
  const takings = summary?.takings;

  return (
    <section className="tv-wall" data-testid="tv-wall" data-status={status} data-connection={connection} data-sse={connected ? 'connected' : 'disconnected'} aria-live="polite">
      <header className="tv-wall-head">
        <h1 data-testid="tv-wall-title">TV wall</h1>
        <span className="tv-wall-connection" data-testid="tv-wall-connection" role={status === 'error' ? 'alert' : 'status'}>
          {connectionText}
        </span>
      </header>

      {summary && (
        <div className="tv-wall-grid">
          <section className="tv-wall-panel" data-testid="tv-wall-orders-panel" aria-labelledby="tv-orders-heading">
            <h2 id="tv-orders-heading">Open orders</h2>
            <p className="tv-wall-muted" data-testid="tv-wall-oldest" style={{ margin: 0 }}>
              {oldest ? `Oldest wait: ${waitMinutes(oldest.placed_at, now)} min` : 'No open orders'}
            </p>
            {orders.length === 0 ? (
              <p data-testid="tv-wall-no-orders" style={{ margin: 0 }}>
                No open orders
              </p>
            ) : (
              <ul className="tv-wall-list" data-testid="tv-wall-orders">
                {orders.map((o) => {
                  const minutes = waitMinutes(o.placed_at, now);
                  const level = waitLevel(minutes);
                  return (
                    <li key={o.order_number} data-testid={`tv-order-${o.order_number}`} data-wait={level}>
                      <span data-testid={`tv-order-${o.order_number}-table`}>Table {o.table_id}</span>
                      <span data-testid={`tv-order-${o.order_number}-number`}>Order #{o.order_number}</span>
                      <span data-testid={`tv-order-${o.order_number}-portions`}>{plural(o.portions, 'portion', 'portions')}</span>
                      <span data-testid={`tv-order-${o.order_number}-minutes`}>{minutes} min</span>
                      {level !== 'none' && (
                        <span className={`tv-wait-${level}`} data-testid={`tv-order-${o.order_number}-label`}>
                          {waitLabel(level)}
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <div className="stack" style={{ gap: 'var(--space-5)' }}>
            <section className="tv-wall-panel" data-testid="tv-wall-takings-panel" aria-label="Takings">
              <div>
                <h2>Today's takings</h2>
                <span className="tv-wall-figure" data-testid="tv-wall-closed">
                  {takings ? formatMoney(takings.closed_cents) : 'Takings hidden'}
                </span>
              </div>
              <div>
                <h2>On open tables</h2>
                <span className="tv-wall-figure" data-testid="tv-wall-open">
                  {takings ? formatMoney(takings.open_cents) : 'Takings hidden'}
                </span>
              </div>
            </section>

            <section className="tv-wall-panel" data-testid="tv-wall-today-panel" aria-label="Today">
              <div>
                <h2>Busiest table</h2>
                <span className="tv-wall-figure" data-testid="tv-wall-busiest">
                  {summary.busiest_table
                    ? `Table ${summary.busiest_table.table_id} · ${plural(summary.busiest_table.orders, 'order', 'orders')}`
                    : 'No orders yet'}
                </span>
              </div>
              <div>
                <h2>Top dish</h2>
                <span className="tv-wall-figure" data-testid="tv-wall-top-dish">
                  {summary.top_dish ? `${summary.top_dish.name} · ${plural(summary.top_dish.portions, 'portion', 'portions')}` : 'No dishes yet'}
                </span>
              </div>
            </section>

            <section className="tv-wall-panel" data-testid="tv-wall-requests-panel" aria-labelledby="tv-requests-heading">
              <h2 id="tv-requests-heading">Requests</h2>
              {summary.requests.length === 0 ? (
                <p className="tv-wall-muted" data-testid="tv-wall-no-requests" style={{ margin: 0 }}>
                  No open requests
                </p>
              ) : (
                <ul className="tv-wall-list" data-testid="tv-wall-requests">
                  {summary.requests.map((r) => (
                    <li key={r.call_id} data-testid={`tv-request-${r.call_id}`}>
                      <span>Table {r.table_id}</span>
                      <span>{r.kind === 'bill' ? 'Asking for the bill' : 'Calling the waiter'}</span>
                      <span className="tv-wall-muted">{waitMinutes(r.opened_at, now)} min</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </div>
      )}
    </section>
  );
}
