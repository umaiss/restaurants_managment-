/**
 * The floor map's data (U7 Step 12). Rules: BR4.1 (the server lists the tables), BR4.3 (the page reads the list
 * again on ORDER_PLACED, ORDER_STATUS_CHANGED, TABLE_CLOSED, TABLE_PRESENCE_CHANGED, SERVICE_CALL_OPENED and
 * SERVICE_CALL_RESPONDED, and after a reconnect, so a change shows within 2 seconds).
 */
import { useLiveRead } from '../useLiveRead';

export type FloorState = 'needs_bill' | 'waiting' | 'eating' | 'browsing' | 'empty';

export interface FloorTable {
  id: number;
  label: string;
  state: FloorState;
  connected: number;
  last_activity_at: string | null;
  open_calls: Array<{ id: string; kind: 'waiter' | 'bill'; opened_at: string }>;
}

export const FLOOR_EVENTS = [
  'ORDER_PLACED',
  'ORDER_STATUS_CHANGED',
  'TABLE_CLOSED',
  'TABLE_PRESENCE_CHANGED',
  'SERVICE_CALL_OPENED',
  'SERVICE_CALL_RESPONDED',
] as const;

export function useFloorTables() {
  const read = useLiveRead<{ tables: FloorTable[] }>('/api/staff/tables', FLOOR_EVENTS);
  return { tables: read.data?.tables ?? null, loading: read.loading, error: read.error, reload: read.reload };
}
