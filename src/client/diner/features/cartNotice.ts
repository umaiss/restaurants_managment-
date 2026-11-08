/**
 * A cart refresh that happens while the Cart is not open (a live menu change on the Menu) has nothing to
 * show its notice in. The notice waits here, per table, until the Cart opens (BR1.4: one notice says what changed).
 */
const pending = new Map<string, string>();

export function setPendingCartNotice(tableId: string, text: string): void {
  const previous = pending.get(tableId);
  pending.set(tableId, previous && !previous.includes(text) ? `${previous} ${text}` : text);
}

/** Returns the waiting notice once and forgets it. */
export function takePendingCartNotice(tableId: string): string | null {
  const text = pending.get(tableId) ?? null;
  pending.delete(tableId);
  return text;
}
