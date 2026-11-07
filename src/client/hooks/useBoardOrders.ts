import { useState, useEffect, useCallback, useRef } from 'react';
import { useStaffSSE } from './useStaffSSE';

export type OrderStatus = 'Pending' | 'Preparing' | 'Completed' | 'Cancelled';

export interface OrderLine {
  menu_item_id: string;
  name: string;
  quantity: number;
  price_cents_each: number;
  subtotal_cents: number;
}

export interface Order {
  order_number: number;
  status: OrderStatus;
  placed_at: string;
  table_id: number;
  visit_id: string;
  lines: OrderLine[];
  subtotal_cents: number;
  isNew?: boolean; // true when just arrived via SSE ORDER_PLACED and still Pending
}

const TABLE_COUNT = 10;

/** What happened on the live stream while one fetch of the board was on its way. */
interface InFlightFetch {
  /** Order numbers an ORDER_PLACED or ORDER_STATUS_CHANGED event touched: the event is newer than the fetch. */
  touched: Set<number>;
  /** Tables a TABLE_CLOSED event closed: the fetched orders of these tables are from before the close. */
  closed: Set<number>;
}

export function useBoardOrders(): {
  ordersByTable: Map<number, Order[]>;
  loading: boolean;
  connected: boolean;
} {
  const [ordersByTable, setOrdersByTable] = useState<Map<number, Order[]>>(new Map());
  const [loading, setLoading] = useState(true);
  const { events, connected } = useStaffSSE();
  // The board is built from events, so it must see every one, in order, even when several arrive together.
  const processedSeqRef = useRef(0);
  // Fetches that have been sent and not yet applied, and the newest fetch already applied.
  const inFlightRef = useRef<Map<number, InFlightFetch>>(new Map());
  const fetchCounterRef = useRef(0);
  const appliedFetchRef = useRef(0);

  const updateOrders = useCallback((updater: (prev: Map<number, Order[]>) => Map<number, Order[]>) => {
    setOrdersByTable((prev) => updater(prev));
  }, []);

  /**
   * Reads every table's current orders and brings the board in line with them. Used on mount and each time
   * the live stream (re)connects, so a table closed while the stream was down does not stay as a stale card.
   */
  const loadBoard = useCallback(async () => {
    const id = ++fetchCounterRef.current;
    const record: InFlightFetch = { touched: new Set(), closed: new Set() };
    inFlightRef.current.set(id, record);

    const tableIds = Array.from({ length: TABLE_COUNT }, (_, i) => i + 1);
    // null = this table could not be read: its card is left as it is.
    const results: Array<Order[] | null> = await Promise.all(
      tableIds.map((tableId) =>
        fetch(`/api/tables/${tableId}/orders?visit=current`)
          .then((r) => r.json())
          .then((data: { orders: Order[] }) =>
            data.orders.map((o) => ({ ...o, table_id: tableId, isNew: false }))
          )
          .catch(() => null)
      )
    );

    inFlightRef.current.delete(id);
    // A newer fetch has already been applied: this answer is older than what is on the board.
    if (id < appliedFetchRef.current) {
      setLoading(false);
      return;
    }
    appliedFetchRef.current = id;

    setOrdersByTable((prev) => {
      const next = new Map<number, Order[]>();
      tableIds.forEach((tableId, idx) => {
        const known = prev.get(tableId) ?? [];
        const fetched = results[idx];
        if (fetched === null) {
          if (known.length > 0) next.set(tableId, known);
          return;
        }
        // A table closed while this fetch was on its way: what was fetched is from before the close and
        // must not bring the table back. Orders placed since the close arrived as events and are kept.
        const fromServer = record.closed.has(tableId) ? [] : fetched;
        const knownByNumber = new Map(known.map((o) => [o.order_number, o]));
        const merged = new Map<number, Order>();
        for (const o of fromServer) {
          const mine = knownByNumber.get(o.order_number);
          if (mine && record.touched.has(o.order_number)) {
            merged.set(o.order_number, mine); // an event newer than this fetch: it wins
          } else {
            // The fetch is the fresher word; keep the "new" highlight of an order still Pending.
            merged.set(o.order_number, mine?.isNew && o.status === 'Pending' ? { ...o, isNew: true } : o);
          }
        }
        // Orders that arrived by event while the fetch was on its way are not in its answer yet.
        for (const o of known) {
          if (record.touched.has(o.order_number) && !merged.has(o.order_number)) merged.set(o.order_number, o);
        }
        if (merged.size > 0) {
          next.set(
            tableId,
            [...merged.values()].sort((a, b) => new Date(b.placed_at).getTime() - new Date(a.placed_at).getTime())
          );
        }
      });
      // Tables beyond the ones fetched stay as the events built them.
      for (const [tableId, known] of prev.entries()) {
        if (!tableIds.includes(tableId) && known.length > 0) next.set(tableId, known);
      }
      return next;
    });
    setLoading(false);
  }, []);

  // First load.
  useEffect(() => {
    void loadBoard();
  }, [loadBoard]);

  // Read the board again each time the live stream (re)connects: events missed while it was down (a gap
  // longer than the server's buffer, or a server restart) are made up for. This runs on the change from
  // not connected to connected only, so it cannot loop.
  const wasConnectedRef = useRef(false);
  useEffect(() => {
    if (connected && !wasConnectedRef.current) void loadBoard();
    wasConnectedRef.current = connected;
  }, [connected, loadBoard]);

  // React to SSE events from the shared connection
  useEffect(() => {
   for (const lastEvent of events) {
    const seq = lastEvent.seq ?? 0;
    if (seq <= processedSeqRef.current) continue;
    processedSeqRef.current = seq;

    if (lastEvent.type === 'ORDER_PLACED') {
      const data = lastEvent.data as {
        order_number: number;
        table_id: number;
        status: OrderStatus;
        placed_at: string;
        lines: OrderLine[];
        visit_id?: string;
      };
      for (const f of inFlightRef.current.values()) f.touched.add(data.order_number);
      const newOrder: Order = {
        order_number: data.order_number,
        status: 'Pending',
        placed_at: data.placed_at,
        table_id: data.table_id,
        visit_id: data.visit_id ?? '',
        lines: data.lines,
        subtotal_cents: data.lines.reduce((s, l) => s + (l.subtotal_cents ?? l.price_cents_each * l.quantity), 0),
        isNew: true,
      };
      updateOrders((prev) => {
        const next = new Map(prev);
        const existing = next.get(data.table_id) ?? [];
        // If the initial fetch already added this order, mark it isNew; otherwise prepend as new
        const without = existing.filter(o => o.order_number !== newOrder.order_number);
        next.set(data.table_id, [{ ...newOrder, isNew: true }, ...without]);
        return next;
      });
    } else if (lastEvent.type === 'ORDER_STATUS_CHANGED') {
      const data = lastEvent.data as {
        order_number: number;
        table_id: number;
        status: OrderStatus;
      };
      for (const f of inFlightRef.current.values()) f.touched.add(data.order_number);
      updateOrders((prev) => {
        const next = new Map(prev);
        const tableOrders = next.get(data.table_id);
        if (!tableOrders) return next;
        const updated = tableOrders.map((o) => {
          if (o.order_number !== data.order_number) return o;
          // Clear isNew when transitioning from Pending → Preparing
          const wasNew = o.isNew && o.status === 'Pending' && data.status === 'Preparing';
          return { ...o, status: data.status, isNew: wasNew ? false : o.isNew };
        });
        // The table stays, even when every order is now Completed or Cancelled: it leaves the board only
        // when it is closed (TABLE_CLOSED), so staff can still open its bill and close it.
        next.set(data.table_id, updated);
        return next;
      });
    } else if (lastEvent.type === 'TABLE_CLOSED') {
      const data = lastEvent.data as { table_id: number };
      // Remember it for every fetch still on its way, so the answer cannot bring the table back.
      for (const f of inFlightRef.current.values()) f.closed.add(data.table_id);
      updateOrders((prev) => {
        const next = new Map(prev);
        next.delete(data.table_id);
        return next;
      });
    }
   }
  }, [events, updateOrders]);

  return { ordersByTable, loading, connected };
}
