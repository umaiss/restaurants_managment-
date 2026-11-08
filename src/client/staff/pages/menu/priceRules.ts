/**
 * Money and price helpers of the staff pages (U7 Steps 12 and 13). The server decides every rule (BR5.2, BR5.4);
 * these only read what a person typed and tell the Chef's special page about the cheapest-line rule (BR6.1).
 */

/** Dollars typed by a person ("14.50", "$14.5", "14") to whole cents; null when it is not dollars and cents. */
export function parseDollars(text: string, options: { signed?: boolean } = {}): number | null {
  const pattern = options.signed ? /^([+-])?\$?(\d+)(?:\.(\d{1,2}))?$/ : /^()\$?(\d+)(?:\.(\d{1,2}))?$/;
  const m = pattern.exec(text.trim());
  if (!m) return null;
  const cents = parseInt(m[2], 10) * 100 + parseInt((m[3] ?? '').padEnd(2, '0') || '0', 10);
  return m[1] === '-' ? -cents : cents;
}

/** Whole cents to the text of an input: 1450 -> "14.50". */
export function centsToInput(cents: number): string {
  const sign = cents < 0 ? '-' : '';
  const abs = Math.abs(cents);
  return `${sign}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, '0')}`;
}

/** A price change for display: +$3.00, -$1.00, +$0.00 (BR5.4). */
export function formatDelta(cents: number): string {
  const sign = cents < 0 ? '-' : '+';
  const abs = Math.abs(cents);
  return `${sign}$${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, '0')}`;
}

export interface PriceGroup {
  kind: 'one' | 'any' | 'leave_out';
  required: boolean;
  choices: Array<{ price_delta_cents: number }>;
}

/**
 * The most an item's options can take off a line (BR5.4): choose-one takes its cheapest choice when required,
 * otherwise the cheapest choice or 0 if that is negative; choose-any and leave-out take the sum of their negative
 * changes. Zero or less.
 */
export function lowestOptionsTotal(groups: readonly PriceGroup[]): number {
  let total = 0;
  for (const g of groups) {
    const deltas = g.choices.map((c) => c.price_delta_cents);
    if (deltas.length === 0) continue;
    if (g.kind === 'one') {
      const cheapest = Math.min(...deltas);
      total += g.required ? cheapest : Math.min(0, cheapest);
    } else {
      total += deltas.filter((d) => d < 0).reduce((s, d) => s + d, 0);
    }
  }
  return total;
}

/** Makes a server message a sentence: first letter up, a full stop at the end. */
export function sentence(message: string): string {
  const text = message.trim();
  if (text === '') return text;
  const up = text.charAt(0).toUpperCase() + text.slice(1);
  return /[.!?]$/.test(up) ? up : `${up}.`;
}
