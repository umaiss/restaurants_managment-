import { useState, useEffect, useCallback, useRef } from 'react';
import { useStaffSSE } from './useStaffSSE';
import { staffFetch } from '../staff/staffAuth';
import type { OrderStatus } from './useBoardOrders';

export interface BillLine {
  menu_item_id: string;
  name: string;
  quantity: number;
  price_cents_each: number;
  subtotal_cents: number;
  image?: string;
  /** Frozen chosen options (v2); the line price already includes them (U7 BR9.1, BR9.2). */
  options?: Array<{ label: string; price_delta_cents: number }>;
}

export interface BillOrder {
  order_number: number;
  status: OrderStatus;
  placed_at: string;
  lines: BillLine[];
  subtotal_cents: number;
}

export interface Bill {
  table_id: number;
  orders: BillOrder[];
  combined_total_cents: number;
  close_available: boolean;
  blocking_orders: number[];
  /** How the table said it will pay when it asked for the bill. */
  payment_method?: 'cash' | 'card' | null;
  /** True when the table asked for a receipt along with the bill. */
  receipt_requested?: boolean;
}

export interface UseBill {
  bill: Bill | null;
  loading: boolean;
  error: boolean;
  /** True once a TABLE_CLOSED event for this table has arrived. */
  closed: boolean;
  reload: () => void;
}

/**
 * Loads GET /api/tables/:id/bill and keeps it fresh: an order placed or changed at this table
 * (read from the shared /sse/staff stream) fetches the bill again. A failed fetch keeps the last good bill.
 */
export function useBill(tableId: number): UseBill {
  const [bill, setBill] = useState<Bill | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [closed, setClosed] = useState(false);
  const { events, connected } = useStaffSSE();
  const wasConnectedRef = useRef(false);
  const processedSeqRef = useRef(0);
  const requestRef = useRef(0);

  const load = useCallback(async () => {
    const request = ++requestRef.current;
    try {
      const res = await staffFetch(`/api/tables/${tableId}/bill`); // staff only: a 401 returns to the PIN screen
      if (!res.ok) throw new Error(`bill request failed with ${res.status}`);
      const data = (await res.json()) as Bill;
      if (request !== requestRef.current) return; // a newer request owns the state
      setBill(data);
      setError(false);
    } catch {
      if (request !== requestRef.current) return;
      setError(true);
    } finally {
      if (request === requestRef.current) setLoading(false);
    }
  }, [tableId]);

  useEffect(() => {
    setLoading(true);
    setClosed(false);
    void load();
  }, [load]);

  // An order change can land before the event stream opens, or while it is down. Each time the
  // stream turns connected, fetch the bill again so nothing in that gap is missed. This runs on the
  // false-to-true change only, so it cannot loop.
  useEffect(() => {
    if (connected && !wasConnectedRef.current) void load();
    wasConnectedRef.current = connected;
  }, [connected, load]);

  useEffect(() => {
    for (const ev of events) {
      const seq = ev.seq ?? 0;
      if (seq <= processedSeqRef.current) continue;
      processedSeqRef.current = seq;
      const data = (ev.data ?? {}) as { table_id?: number };
      if (data.table_id !== tableId) continue;
      if (ev.type === 'ORDER_STATUS_CHANGED' || ev.type === 'ORDER_PLACED') {
        void load();
      } else if (ev.type === 'TABLE_CLOSED') {
        setClosed(true);
      }
    }
  }, [events, tableId, load]);

  const reload = useCallback(() => {
    setLoading(true);
    void load();
  }, [load]);

  return { bill, loading, error, closed, reload };
}
