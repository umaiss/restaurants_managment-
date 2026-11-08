/**
 * Choosing options in the sheet (U6 BR1.2, BR1.3; D2, D4). The choices per group, the live line price (never
 * below zero) and the first required group that still has no choice.
 */
import { useCallback, useMemo, useState } from 'react';
import type { CartOptionChoice } from '../cartModel.js';
import { linePrice } from '../cartModel.js';
import type { OptionGroupDef } from '../menuTypes.js';

export function chosenChoices(groups: OptionGroupDef[], selected: Record<string, string[]>): CartOptionChoice[] {
  const out: CartOptionChoice[] = [];
  for (const g of groups) {
    for (const c of g.choices) {
      if ((selected[g.id] ?? []).includes(c.id)) out.push({ choiceId: c.id, group: g.name, label: c.label, priceDeltaCents: c.price_delta_cents });
    }
  }
  return out;
}

/** BR1.3: the first required choose-one group with no choice, or null. */
export function firstMissingGroup(groups: OptionGroupDef[], selected: Record<string, string[]>): OptionGroupDef | null {
  return groups.find((g) => g.kind === 'one' && g.required && (selected[g.id] ?? []).length === 0) ?? null;
}

export function useOptionChoice(groups: OptionGroupDef[], basePriceCents: number) {
  const [selected, setSelected] = useState<Record<string, string[]>>({});

  const toggle = useCallback(
    (group: OptionGroupDef, choiceId: string) => {
      setSelected((prev) => {
        const current = prev[group.id] ?? [];
        // A choose-one group holds at most one choice: a second choice replaces the first (BR1.3).
        if (group.kind === 'one') return { ...prev, [group.id]: [choiceId] };
        return { ...prev, [group.id]: current.includes(choiceId) ? current.filter((id) => id !== choiceId) : [...current, choiceId] };
      });
    },
    []
  );

  const choices = useMemo(() => chosenChoices(groups, selected), [groups, selected]);
  const missing = useMemo(() => firstMissingGroup(groups, selected), [groups, selected]);
  const priceCents = linePrice(basePriceCents, choices);

  return { selected, toggle, choices, missing, priceCents, canAdd: missing === null };
}
