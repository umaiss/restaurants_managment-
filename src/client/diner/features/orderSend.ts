/**
 * Sending the order (U6 BR1.5, BR1.6; W2 steps 5 to 8). Every line carries its item, quantity, chosen option
 * ids and special id. The server's answer is turned into one result the Cart acts on.
 */
import type { CartItem } from './cartModel.js';

export interface OrderBodyLine {
  menu_item_id: string;
  quantity: number;
  option_ids?: string[];
  special_id?: string;
}

export function buildOrderLines(items: CartItem[]): OrderBodyLine[] {
  return items.map((i) => {
    const line: OrderBodyLine = { menu_item_id: i.menuItemId, quantity: i.quantity };
    if (i.optionChoices.length > 0) line.option_ids = i.optionChoices.map((c) => c.choiceId);
    if (i.specialId) line.special_id = i.specialId;
    return line;
  });
}

export const DROP_REASON_TEXT: Record<string, string> = {
  SOLD_OUT_AT_SUBMIT: 'sold out',
  SPECIAL_SOLD_OUT: "the Chef's special ran out",
  OPTION_UNAVAILABLE: 'an option is no longer offered',
};

export function dropReasonText(reason: string | undefined): string {
  return (reason && DROP_REASON_TEXT[reason]) || 'sold out';
}

export interface DroppedInfo {
  menu_item_id: string;
  name: string;
  quantity: number;
  reason?: string;
}

export type SendResult =
  | { kind: 'placed'; orderNumber: number; dropped: DroppedInfo[] }
  | { kind: 'empty' }
  | { kind: 'invalid_options' }
  | { kind: 'error'; message: string };

/** Names each dropped line from the cart lines that were sent (a line is used once). */
export function nameDroppedLines(items: CartItem[], dropped: Array<{ menu_item_id: string; reason?: string }>): DroppedInfo[] {
  const used = new Set<string>();
  return dropped.map((d) => {
    const candidates = items.filter((i) => i.menuItemId === d.menu_item_id && !used.has(i.lineId));
    const line = (d.reason === 'SPECIAL_SOLD_OUT' ? candidates.find((i) => i.specialId) : undefined) ?? candidates[0];
    if (line) used.add(line.lineId);
    const info: DroppedInfo = { menu_item_id: d.menu_item_id, name: line?.name ?? d.menu_item_id, quantity: line?.quantity ?? 1 };
    // "sold out" is the default the screen says when there is no reason (v1's wording and shape); only a
    // different reason is carried.
    const text = dropReasonText(d.reason);
    if (text !== 'sold out') info.reason = text;
    return info;
  });
}

/** One POST; a network failure keeps the placement key (the caller reuses it on retry). */
export async function sendOrder(tableId: string, placementKey: string, items: CartItem[]): Promise<SendResult> {
  let res: Response;
  try {
    res = await fetch(`/api/tables/${tableId}/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ placement_key: placementKey, lines: buildOrderLines(items) }),
    });
  } catch {
    return { kind: 'error', message: 'Network error. Please try again.' };
  }

  if (res.ok) {
    const data = (await res.json().catch(() => null)) as { order_number?: number; dropped_lines?: Array<{ menu_item_id: string; reason?: string }> } | null;
    if (!data || typeof data.order_number !== 'number') return { kind: 'error', message: 'We could not place your order. Please try again.' };
    return { kind: 'placed', orderNumber: data.order_number, dropped: nameDroppedLines(items, data.dropped_lines ?? []) };
  }

  const body = (await res.json().catch(() => ({}))) as { error?: { code?: string; message?: string }; message?: string };
  if (res.status === 400 && body.error?.code === 'EMPTY_ORDER') return { kind: 'empty' };
  if (res.status === 400 && body.error?.code === 'INVALID_OPTIONS') return { kind: 'invalid_options' };
  return { kind: 'error', message: body.error?.message ?? body.message ?? 'We could not place your order. Please try again.' };
}
