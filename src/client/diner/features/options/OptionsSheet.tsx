/**
 * The "Make it yours" options sheet (U6 BR1.1 to BR1.3, W1; story US8.1). Choose-one groups are radios
 * ("Required" when they are), choose-any and leave-out groups are checkboxes; the live line price is the
 * item (or special) price plus the chosen changes, never below zero; "Add to cart" waits for every required
 * group and names the first missing one. The sheet traps focus and closes with Escape (the Sheet component).
 */
import React from 'react';
import { Badge, Button, Sheet } from '../../../components/ui/index.js';
import type { CartOptionChoice } from '../cartModel.js';
import { formatDelta, formatPrice, type ChefSpecial, type DinerMenuItem, type OptionGroupDef } from '../menuTypes.js';
import { useOptionChoice } from './useOptionChoice.js';
import { Portal } from '../Portal.js';
import '../features.css';

export interface OptionsAddPayload {
  optionChoices: CartOptionChoice[];
  basePriceCents: number;
  priceCents: number;
  specialId?: string;
  maxQuantity?: number;
}

export interface OptionsSheetProps {
  item: DinerMenuItem;
  special?: ChefSpecial | null;
  onAdd: (payload: OptionsAddPayload) => void;
  onClose: () => void;
}

function groupLabel(g: OptionGroupDef): string {
  if (g.kind === 'any') return `${g.name} (choose any)`;
  if (g.kind === 'one' && !g.required) return `${g.name} (choose one)`;
  return g.name;
}

export default function OptionsSheet({ item, special, onAdd, onClose }: OptionsSheetProps) {
  const groups = item.options ?? [];
  const base = special ? special.special_price_cents : item.price_cents;
  const { selected, toggle, choices, missing, priceCents, canAdd } = useOptionChoice(groups, base);

  function add() {
    if (!canAdd) return;
    onAdd({
      optionChoices: choices,
      basePriceCents: base,
      priceCents,
      ...(special ? { specialId: special.id, maxQuantity: special.stock_left } : {}),
    });
  }

  return (
    <Portal>
    <Sheet open title={item.name} onClose={onClose} testId="options-sheet">
      <button type="button" className="icon-btn sheet-corner-close" aria-label="Close" data-testid="options-close" onClick={onClose}>
        {'✕'}
      </button>
      {groups.map((g) => {
        const isOne = g.kind === 'one';
        const showMissing = missing?.id === g.id;
        return (
          <div className="field" key={g.id} data-testid={`options-group-${g.id}`}>
            <div className="row between">
              <label>{groupLabel(g)}</label>
              {g.required && isOne && <Badge tone="accent">Required</Badge>}
            </div>
            <div className="stack" role={isOne ? 'radiogroup' : 'group'} aria-label={g.name} style={{ gap: 8 }}>
              {g.choices.map((c) => {
                const checked = (selected[g.id] ?? []).includes(c.id);
                return (
                  <button
                    key={c.id}
                    type="button"
                    role={isOne ? 'radio' : 'checkbox'}
                    aria-checked={checked}
                    className="choice"
                    data-testid={`option-choice-${c.id}`}
                    onClick={() => toggle(g, c.id)}
                  >
                    <span>{c.label}</span>
                    <span className="row">
                      <span className="secondary num">{formatDelta(c.price_delta_cents)}</span>
                      <span className={isOne ? 'radio' : 'check'} aria-hidden="true">
                        {checked ? '✓' : ''}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
            {showMissing && (
              <span className="error-text" role="status" data-testid="options-missing">
                Choose a {g.name.toLowerCase()}
              </span>
            )}
          </div>
        );
      })}
      <div className="row between" style={{ marginTop: 4 }}>
        <div>
          <div className="secondary" style={{ fontSize: 13 }}>Line price</div>
          <div className="price num" style={{ fontSize: 20, fontWeight: 600 }} data-testid="options-price">
            {formatPrice(priceCents)}
          </div>
        </div>
        <Button variant="primary" data-testid="options-add" disabled={!canAdd} onClick={add}>
          Add to cart
        </Button>
      </div>
    </Sheet>
    </Portal>
  );
}
