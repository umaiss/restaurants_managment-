/**
 * "Same again" (U6 BR8.1, BR8.2; W8). An order's lines keep only each option's label and price change, so
 * every option is matched by its label among the item's current choices. A line is skipped (and named)
 * when it cannot be matched with certainty.
 */
import { MAX_LINE_QUANTITY, linePrice, makeLineId, type CartItem, type CartOptionChoice } from '../cartModel.js';
import type { DinerMenuItem, DinerOrder } from '../menuTypes.js';

export interface SameAgainAdd {
  menuItemId: string;
  name: string;
  /** Price each at today's menu price, including today's option changes. */
  priceCents: number;
  basePriceCents: number;
  quantity: number;
  optionChoices: CartOptionChoice[];
}

export interface SameAgainResult {
  adds: SameAgainAdd[];
  /** "Name: reason", one per skipped line. */
  skipped: string[];
  /** Lines cut down to the 20-per-line limit. */
  capped: string[];
  /** True when a Chef's special line was added at the ordinary price. */
  specialPriceNotApplied: boolean;
}

export function buildSameAgain(order: Pick<DinerOrder, 'lines'>, menu: DinerMenuItem[], cart: Pick<CartItem, 'lineId' | 'quantity'>[] = []): SameAgainResult {
  const byId = new Map(menu.map((m) => [m.id, m]));
  const result: SameAgainResult = { adds: [], skipped: [], capped: [], specialPriceNotApplied: false };
  const inCart = new Map(cart.map((c) => [c.lineId, c.quantity]));

  for (const line of order.lines) {
    const item = byId.get(line.menu_item_id);
    if (!item || item.available === false) {
      result.skipped.push(`${line.name}: no longer available`);
      continue;
    }

    const wanted = line.options ?? [];
    const groups = item.options;
    if (wanted.length > 0 && !groups) {
      result.skipped.push(`${line.name}: its options are no longer offered`);
      continue;
    }

    const chosen: CartOptionChoice[] = [];
    let problem: string | null = null;
    for (const opt of wanted) {
      const matches: Array<{ group: NonNullable<typeof groups>[number]; id: string; delta: number }> = [];
      for (const g of groups ?? []) for (const c of g.choices) if (c.label === opt.label) matches.push({ group: g, id: c.id, delta: c.price_delta_cents });
      if (matches.length === 0) {
        problem = `the option "${opt.label}" is no longer offered`;
        break;
      }
      if (matches.length > 1) {
        problem = `"${opt.label}" could mean more than one choice`;
        break;
      }
      const m = matches[0];
      if (!chosen.some((c) => c.choiceId === m.id)) chosen.push({ choiceId: m.id, group: m.group.name, label: opt.label, priceDeltaCents: m.delta });
    }
    if (!problem && groups) {
      // two matched choices in one choose-one group, or a now-required group left empty
      for (const g of groups) {
        if (g.kind !== 'one') continue;
        const n = chosen.filter((c) => g.choices.some((gc) => gc.id === c.choiceId)).length;
        if (n > 1) problem = `two choices in "${g.name}"`;
        else if (n === 0 && g.required) problem = `"${g.name}" now needs a choice`;
        if (problem) break;
      }
    }
    if (problem) {
      result.skipped.push(`${line.name}: ${problem}`);
      continue;
    }

    if (line.special_id) result.specialPriceNotApplied = true;
    const lineId = makeLineId(item.id, chosen.map((c) => c.choiceId));
    const already = (inCart.get(lineId) ?? 0) + result.adds.filter((a) => makeLineId(a.menuItemId, a.optionChoices.map((c) => c.choiceId)) === lineId).reduce((s, a) => s + a.quantity, 0);
    const room = Math.max(0, MAX_LINE_QUANTITY - already);
    const quantity = Math.min(line.quantity, room);
    if (quantity < line.quantity) result.capped.push(`${item.name} (${MAX_LINE_QUANTITY})`);
    if (quantity <= 0) continue;
    result.adds.push({
      menuItemId: item.id,
      name: item.name,
      basePriceCents: item.price_cents,
      priceCents: linePrice(item.price_cents, chosen),
      quantity,
      optionChoices: chosen,
    });
  }
  return result;
}

/** BR8.2: the one notice that opens with the Cart. */
export function sameAgainNotice(r: SameAgainResult): string {
  const added = r.adds.reduce((s, a) => s + a.quantity, 0);
  const parts: string[] = [];
  if (added > 0) parts.push(`Added ${added} item${added === 1 ? '' : 's'} from your earlier order at today's prices.`);
  else parts.push('Nothing was added from that order.');
  if (r.skipped.length > 0) parts.push(`Skipped: ${r.skipped.join('; ')}.`);
  if (r.capped.length > 0) parts.push(`Limited to 20 per line: ${r.capped.join(', ')}.`);
  if (r.specialPriceNotApplied) parts.push("The Chef's special price does not apply; those items were added at the menu price.");
  return parts.join(' ');
}
