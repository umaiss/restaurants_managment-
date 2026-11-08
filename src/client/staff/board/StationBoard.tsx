/**
 * One station's board (U7 Step 10). Rules: BR1.1 (the tickets of open orders with lines for this station and
 * no done mark, showing only this station's lines with their options), BR1.2 (the "<Station> done" button
 * sends the mark), BR2.1 and BR2.3 (timer and options on each ticket). The board reads again on the events
 * that can change it and after a reconnect, so two cooks stay in line.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '../../components/ui/index';
import { staffFetch } from '../staffAuth';
import type { StaffSSEEvent } from '../../hooks/useStaffSSE';
import TicketTimer from './TicketTimer';
import { optionsText } from './optionsText';
import type { StationName } from './constants';
import '../staff-u7.css';

export interface StationTicket {
  order_number: number;
  table_id: number;
  status: 'Pending' | 'Preparing' | 'Completed' | 'Cancelled';
  placed_at: string;
  lines: Array<{ menu_item_id: string; name: string; quantity: number; options: Array<{ label: string; price_delta_cents: number }> }>;
  other_stations: Array<{ station: string; state: 'done' | 'waiting' }>;
}

/** The events that can change a station's board. */
const BOARD_EVENTS = new Set(['ORDER_PLACED', 'ORDER_STATUS_CHANGED', 'STATION_DONE', 'TABLE_CLOSED']);

export interface StationBoardProps {
  station: StationName;
  events: StaffSSEEvent[];
  connected: boolean;
}

export default function StationBoard({ station, events, connected }: StationBoardProps) {
  const [orders, setOrders] = useState<StationTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const requestRef = useRef(0);
  const processedSeqRef = useRef(0);

  const load = useCallback(async () => {
    const request = ++requestRef.current;
    try {
      const res = await staffFetch(`/api/staff/stations/${station}/board`);
      if (!res.ok) throw new Error(`station board answered ${res.status}`);
      const data = (await res.json()) as { orders: StationTicket[] };
      if (request !== requestRef.current) return; // a newer read owns the screen
      setOrders(data.orders);
      setError(false);
    } catch {
      if (request !== requestRef.current) return;
      setError(true);
    } finally {
      if (request === requestRef.current) setLoading(false);
    }
  }, [station]);

  // A new station, or the first load.
  useEffect(() => {
    setLoading(true);
    setOrders([]);
    processedSeqRef.current = events.length > 0 ? (events[events.length - 1].seq ?? 0) : 0;
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load]);

  // Read again after a reconnect: events missed while the stream was down are made up for. The board opened while
  // the stream is already connected has just been read, so it starts from the current state, not from "down".
  const wasConnected = useRef(connected);
  useEffect(() => {
    if (connected && !wasConnected.current) void load();
    wasConnected.current = connected;
  }, [connected, load]);

  useEffect(() => {
    let relevant = false;
    for (const ev of events) {
      const seq = ev.seq ?? 0;
      if (seq <= processedSeqRef.current) continue;
      processedSeqRef.current = seq;
      if (BOARD_EVENTS.has(ev.type)) relevant = true;
    }
    if (relevant) void load();
  }, [events, load]);

  if (loading) return <p data-testid="station-loading" className="secondary">Loading the {station} board…</p>;
  if (error) {
    return (
      <div data-testid="station-error" role="alert" className="stack">
        <p style={{ margin: 0 }}>The {station} board could not be loaded.</p>
        <Button small onClick={() => void load()}>
          Try again
        </Button>
      </div>
    );
  }
  if (orders.length === 0) {
    return (
      <p data-testid="station-empty" className="secondary">
        Nothing waiting for {station}. New orders appear here within 2 seconds.
      </p>
    );
  }
  return (
    <div className="u7-grid" data-testid="station-grid">
      {orders.map((o) => (
        <StationTicketCard key={o.order_number} ticket={o} station={station} onMarked={() => void load()} />
      ))}
    </div>
  );
}

function StationTicketCard({ ticket, station, onMarked }: { ticket: StationTicket; station: StationName; onMarked: () => void }) {
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function markDone() {
    setSending(true);
    setMessage(null);
    try {
      const res = await staffFetch(`/api/staff/orders/${ticket.order_number}/stations/${station}/done`, { method: 'POST' });
      if (res.ok) onMarked();
      else if (res.status === 422) setMessage('This order can no longer be marked done. Reload to see the latest.');
      else setMessage(`${station} could not be marked done. Try again.`);
    } catch {
      setMessage('Network error. Please try again.');
    } finally {
      setSending(false);
    }
  }

  return (
    <article className="u7-ticket" data-testid={`station-ticket-${ticket.order_number}`}>
      <div className="u7-between">
        <strong>
          Order #{ticket.order_number} · Table {ticket.table_id}
        </strong>
        <TicketTimer placedAt={ticket.placed_at} status={ticket.status} orderNumber={ticket.order_number} />
      </div>
      <ul className="u7-lines">
        {ticket.lines.map((l, i) => (
          <React.Fragment key={`${l.menu_item_id}-${i}`}>
            <li>
              {l.quantity} × {l.name}
            </li>
            {l.options.length > 0 && <li className="opt">{optionsText(l.options)}</li>}
          </React.Fragment>
        ))}
      </ul>
      {ticket.other_stations.length > 0 && (
        <p className="help" style={{ margin: 0 }}>
          Other stations on this order: {ticket.other_stations.map((s) => `${s.station} (${s.state})`).join(', ')}
        </p>
      )}
      {message && (
        <p role="alert" className="error-text" style={{ margin: 0 }}>
          {message}
        </p>
      )}
      <Button small variant="primary" disabled={sending} data-testid={`${station.toLowerCase()}-done-${ticket.order_number}`} onClick={markDone}>
        {sending ? 'Updating…' : `${station} done`}
      </Button>
    </article>
  );
}
