/**
 * The small calls the diner features make to U5's routes (contract 1), with v1's error handling (U6 Step 7).
 * Every call throws an ApiError with the status and the error code of the server's envelope, or a plain
 * ApiError with status 0 when the request never got an answer, so a screen can tell the two apart.
 */
import type { ChefSpecial, DinerOrder } from './menuTypes.js';

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function call<T>(url: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, init);
  } catch {
    throw new ApiError(0, 'NETWORK', 'Network error');
  }
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: { code?: string; message?: string } };
    throw new ApiError(res.status, body.error?.code ?? 'ERROR', body.error?.message ?? `HTTP ${res.status}`);
  }
  try {
    return (await res.json()) as T;
  } catch {
    throw new ApiError(res.status, 'BAD_BODY', 'Unreadable answer');
  }
}

export interface Estimate {
  estimate_minutes: number;
  basis: 'today' | 'default';
  open_orders?: number;
}

export const fetchEstimate = (tableId: string) => call<Estimate>(`/api/estimate?table=${encodeURIComponent(tableId)}`);

export async function fetchCurrentSpecial(): Promise<ChefSpecial | null> {
  const body = await call<{ special: ChefSpecial | null }>('/api/specials/current');
  return body.special ?? null;
}

export type CallKind = 'waiter' | 'bill';
export interface ServiceCallRow {
  id: string;
  kind: CallKind;
  status: 'open' | 'responded';
  opened_at?: string;
  responded_at?: string | null;
}

export async function fetchCalls(tableId: string): Promise<ServiceCallRow[]> {
  const body = await call<{ calls: ServiceCallRow[] }>(`/api/tables/${tableId}/calls`);
  return body.calls ?? [];
}

export const postCall = (tableId: string, kind: CallKind) =>
  call<ServiceCallRow>(`/api/tables/${tableId}/calls`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ kind }),
  });

export async function fetchLastClosedOrders(tableId: string): Promise<DinerOrder[]> {
  const body = await call<{ orders: DinerOrder[] }>(`/api/tables/${tableId}/orders?visit=last_closed`);
  return body.orders ?? [];
}

export const postRatings = (tableId: string, body: { visit_id: string; ratings: Array<{ item_id: string; thumb: 'up' | 'down' }>; done: boolean }) =>
  call<{ saved: number }>(`/api/tables/${tableId}/ratings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

export async function fetchMenu<T>(): Promise<T> {
  return call<T>('/api/menu');
}
