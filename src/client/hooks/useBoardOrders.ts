import { useState, useEffect, useCallback } from 'react';
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

export function useBoardOrders(): {
  ordersByTable: Map<number, Order[]>;
  loading: boolean;
  connected: boolean;
} {
  const [ordersByTable, setOrdersByTable] = useState<Map<number, Order[]>>(new Map());
  const [loading, setLoading] = useState(true);
  const { lastEvent, connected } = useStaffSSE();

  const updateOrders = useCallback((updater: (prev: Map<number, Order[]>) => Map<number, Order[]>) => {
    setOrdersByTable((prev) => updater(prev));
  }, []);

  useEffect(() => {
    // Fetch all tables in parallel
    const tableIds = Array.from({ length: TABLE_COUNT }, (_, i) => i + 1);
    const fetches = tableIds.map((tableId) =>
      fetch(`/api/tables/${tableId}/orders?visit=current`)
        .then((r) => r.json())
        .then((data: { orders: Order[] }) =>
          data.orders.map((o) => ({ ...o, table_id: tableId, isNew: false }))
        )
        .catch(() => [] as Order[])
    );

    Promise.all(fetches).then((results) => {
      setOrdersByTable((prev) => {
        const next = new Map<number, Order[]>();
        results.forEach((orders, idx) => {
          const tableId = tableIds[idx];
          const sseOrders = prev.get(tableId) ?? [];
          // Build a map keyed by order_number, fetched orders as the base
          const merged = new Map<number, Order>();
          orders.forEach((o) => merged.set(o.order_number, o));
          // SSE orders take precedence (may carry isNew:true or more recent status)
          sseOrders.forEach((o) => merged.set(o.order_number, o));
          if (merged.size > 0) {
            const sorted = [...merged.values()].sort(
              (a, b) => new Date(b.placed_at).getTime() - new Date(a.placed_at).getTime()
            );
            next.set(tableId, sorted);
          }
        });
        // Keep SSE-only table entries (tables not in the fetched set)
        for (const [tableId, sseOrders] of prev.entries()) {
          if (!next.has(tableId) && sseOrders.length > 0) {
            next.set(tableId, sseOrders);
          }
        }
        return next;
      });
      setLoading(false);
    });
  }, []);

  // React to SSE events from the shared connection
  useEffect(() => {
    if (!lastEvent) return;

    if (lastEvent.type === 'ORDER_PLACED') {
      const data = lastEvent.data as {
        order_number: number;
        table_id: number;
        status: OrderStatus;
        placed_at: string;
        lines: OrderLine[];
        visit_id?: string;
      };
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
        // If all orders for this table are now in a terminal state, remove the table
        const terminalStatuses: OrderStatus[] = ['Completed', 'Cancelled'];
        const allTerminal = updated.every((o) => terminalStatuses.includes(o.status));
        if (allTerminal) {
          next.delete(data.table_id);
        } else {
          next.set(data.table_id, updated);
        }
        return next;
      });
    } else if (lastEvent.type === 'TABLE_CLOSED') {
      const data = lastEvent.data as { table_id: number };
      updateOrders((prev) => {
        const next = new Map(prev);
        next.delete(data.table_id);
        return next;
      });
    }
  }, [lastEvent, updateOrders]);

  return { ordersByTable, loading, connected };
}
