/**
 * The cart's line model and the cart refresh (U6: BR1.1, BR1.2, BR1.4; rules D1 to D3). Pure functions, no
 * React and no storage, so every rule is tested on its own. `useCart` keeps the saved cart and calls these.
 */

/** The server accepts 1 to 20 of one item per order line. */
export const MAX_LINE_QUANTITY = 20;

export interface CartOptionChoice {
  choiceId: string;
  group: string;
  label: string;
  priceDeltaCents: number;
}

export interface CartItem {
  /** BR1.1: item id, then "#" and sorted choice ids joined by "+", then "@" and the special id. */
  lineId: string;
  menuItemId: string;
  name: string;
  /** The item's price (or the special price on a special line), before options. */
  basePriceCents: number;
  /** Price each, including the chosen options, at least 0 (BR1.2). The server's price is the one charged. */
  priceCents: number;
  quantity: number;
  optionChoices: CartOptionChoice[];
  specialId?: string;
  /** A special line is also limited to the stock left. */
  maxQuantity?: number;
}

/** What the cart refresh needs to know about a menu item (a v1 menu has no options: they are not checked). */
export interface RefreshMenuItem {
  id: string;
  name?: string;
  price_cents: number;
  available?: boolean;
  options?: Array<{
    id: string;
    name: string;
    kind: 'one' | 'any' | 'leave_out';
    required: boolean;
    choices: Array<{ id: string; label: string; price_delta_cents: number }>;
  }>;
}

export interface RefreshSpecial {
  id: string;
  item_id: string;
  special_price_cents: number;
  stock_left: number;
}

export interface CartRefreshResult {
  /** Names of cart lines that were removed (item gone, sold out, option gone, required group empty). */
  removed: string[];
  /** True when at least one line's price changed. */
  repriced: boolean;
  /** Special lines whose special ended or ran out: now at the regular price. */
  reset: string[];
  /** Special lines cut down to the stock left: "Name (n)". */
  capped: string[];
}

/** BR1.1 */
export function makeLineId(menuItemId: string, choiceIds: string[], specialId?: string): string {
  let id = menuItemId;
  if (choiceIds.length > 0) id += `#${[...choiceIds].sort().join('+')}`;
  if (specialId) id += `@${specialId}`;
  return id;
}

/** BR1.2: base price plus the chosen changes, never below zero. */
export function linePrice(basePriceCents: number, choices: Array<{ priceDeltaCents: number }>): number {
  return Math.max(0, basePriceCents + choices.reduce((sum, c) => sum + c.priceDeltaCents, 0));
}

/** BR1.1: a cart saved by v1 (name, price, quantity only) loads as plain lines; unusable entries are dropped. */
export function normalizeCart(raw: unknown): CartItem[] {
  if (!Array.isArray(raw)) return [];
  const out: CartItem[] = [];
  for (const entry of raw) {
    const e = (entry ?? {}) as Partial<CartItem>;
    if (typeof e.menuItemId !== 'string' || typeof e.name !== 'string' || typeof e.priceCents !== 'number' || typeof e.quantity !== 'number') continue;
    const choices = Array.isArray(e.optionChoices) ? e.optionChoices : [];
    const line: CartItem = {
      lineId: typeof e.lineId === 'string' ? e.lineId : makeLineId(e.menuItemId, choices.map((c) => c.choiceId), e.specialId),
      menuItemId: e.menuItemId,
      name: e.name,
      basePriceCents: typeof e.basePriceCents === 'number' ? e.basePriceCents : e.priceCents,
      priceCents: e.priceCents,
      quantity: e.quantity,
      optionChoices: choices,
    };
    if (typeof e.specialId === 'string') line.specialId = e.specialId;
    if (typeof e.maxQuantity === 'number') line.maxQuantity = e.maxQuantity;
    out.push(line);
  }
  return out;
}

/** The most one line may hold: 20, and a special line also its stock left. */
export function lineLimit(line: Pick<CartItem, 'maxQuantity'>): number {
  return Math.min(MAX_LINE_QUANTITY, line.maxQuantity ?? MAX_LINE_QUANTITY);
}

function dedupe(lines: CartItem[]): CartItem[] {
  const out: CartItem[] = [];
  for (const line of lines) {
    const same = out.find((l) => l.lineId === line.lineId);
    if (same) same.quantity = Math.min(lineLimit(same), same.quantity + line.quantity);
    else out.push({ ...line });
  }
  return out;
}

/**
 * BR1.4 / D3: brings the lines in line with the current menu and the current special.
 * `special` is the live special, null when none is live, or undefined when it is not known (a special
 * line is then left as it is).
 */
export function computeRefresh(
  lines: CartItem[],
  menu: RefreshMenuItem[],
  special: RefreshSpecial | null | undefined
): { lines: CartItem[]; result: CartRefreshResult; changed: boolean } {
  const byId = new Map(menu.map((m) => [m.id, m]));
  const result: CartRefreshResult = { removed: [], repriced: false, reset: [], capped: [] };
  const next: CartItem[] = [];
  let changed = false;

  for (const line of lines) {
    const item = byId.get(line.menuItemId);
    if (!item || item.available === false) {
      result.removed.push(line.name);
      changed = true;
      continue;
    }

    // Options: a chosen choice that is gone, or a required group left empty, removes the line.
    let choices = line.optionChoices;
    if (item.options) {
      const all = new Map<string, { group: string; label: string; delta: number }>();
      for (const g of item.options) for (const c of g.choices) all.set(c.id, { group: g.name, label: c.label, delta: c.price_delta_cents });
      if (choices.some((c) => !all.has(c.choiceId))) {
        result.removed.push(line.name);
        changed = true;
        continue;
      }
      const chosen = new Set(choices.map((c) => c.choiceId));
      const missingRequired = item.options.some((g) => g.kind === 'one' && g.required && !g.choices.some((c) => chosen.has(c.id)));
      if (missingRequired) {
        result.removed.push(line.name);
        changed = true;
        continue;
      }
      choices = choices.map((c) => {
        const now = all.get(c.choiceId)!;
        return { choiceId: c.choiceId, group: now.group, label: now.label, priceDeltaCents: now.delta };
      });
    }

    let specialId = line.specialId;
    let base = item.price_cents;
    let quantity = line.quantity;
    let maxQuantity = line.maxQuantity;

    if (specialId && special === undefined) {
      base = line.basePriceCents; // unknown: keep the special price as it is
    } else if (specialId) {
      if (special && special.id === specialId && special.item_id === line.menuItemId && special.stock_left > 0) {
        base = special.special_price_cents;
        maxQuantity = special.stock_left;
        if (quantity > special.stock_left) {
          quantity = special.stock_left;
          result.capped.push(`${item.name ?? line.name} (${quantity})`);
        }
      } else {
        // The special ended or ran out: the line falls back to the regular price (BR1.4).
        specialId = undefined;
        maxQuantity = undefined;
        result.reset.push(item.name ?? line.name);
      }
    }

    const priceCents = linePrice(base, choices);
    if (priceCents !== line.priceCents) result.repriced = true;

    const updated: CartItem = {
      lineId: makeLineId(line.menuItemId, choices.map((c) => c.choiceId), specialId),
      menuItemId: line.menuItemId,
      name: item.name ?? line.name,
      basePriceCents: base,
      priceCents,
      quantity,
      optionChoices: choices,
    };
    if (specialId) updated.specialId = specialId;
    if (maxQuantity !== undefined) updated.maxQuantity = maxQuantity;
    if (JSON.stringify(updated) !== JSON.stringify(line)) changed = true;
    next.push(updated);
  }

  const merged = dedupe(next);
  if (merged.length !== next.length) changed = true;
  return { lines: merged, result, changed };
}

/** One sentence naming what the refresh did, or null when nothing needs saying (BR1.4). */
export function refreshNotice(r: CartRefreshResult): string | null {
  const parts: string[] = [];
  if (r.removed.length > 0) parts.push(`No longer available and removed from your cart: ${r.removed.join(', ')}.`);
  if (r.reset.length > 0) parts.push(`The Chef's special ended, so these are now at the regular price: ${r.reset.join(', ')}.`);
  if (r.capped.length > 0) parts.push(`Only a few of the Chef's special are left, so the quantity was reduced: ${r.capped.join(', ')}.`);
  if (r.repriced) parts.push('Some prices changed. Your cart total has been updated.');
  return parts.length > 0 ? parts.join(' ') : null;
}
