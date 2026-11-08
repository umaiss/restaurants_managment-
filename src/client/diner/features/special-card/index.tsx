// U6: the Chef's special card above the category pills (US11.1; BR9.1, BR9.2; W3 step 4).
import React from 'react';
import { AddPill, Badge, Timer } from '../../../components/ui/index.js';
import type { DinerFeatureProps } from '../types.js';
import { formatPrice, type ChefSpecial } from '../menuTypes.js';
import { formatCountdown, useCurrentSpecial } from './useCurrentSpecial.js';
import '../features.css';

export interface SpecialCardProps extends DinerFeatureProps {
  /** "+ Add" on the card (through the options sheet when the item has options). */
  onAdd?: (special: ChefSpecial) => void;
  /** The item's picture (an emoji or an address) and description, from the menu the screen already has. */
  itemInfo?: (itemId: string) => { image?: string; description?: string; available?: boolean } | undefined;
}

export default function SpecialCardFeature({ events, onAdd, itemInfo }: SpecialCardProps) {
  const { special, remainingMs } = useCurrentSpecial(events);
  if (!special) return null;
  const info = itemInfo?.(special.item_id);
  // Integration fix: a special for an item that is not on the diner's menu (hidden, in a hidden category) or is
  // sold out is not offered: no card, so there is no "+ Add" that cannot work.
  if (itemInfo && (!info || info.available === false)) return null;
  // amber while there is time, red in the last two minutes (the words carry the meaning: "Ends in mm:ss")
  const tone = remainingMs < 2 * 60_000 ? 'red' : 'amber';
  const image = info?.image ?? '';
  return (
    <section className="special-card" aria-label="Chef's special" data-testid="chef-special">
      <div style={{ fontSize: 34, width: 56, height: 56, display: 'grid', placeItems: 'center', borderRadius: 'var(--radius-md)', background: 'var(--bg-card)' }} aria-hidden="true">
        {/^(https?:)?\/\/|^\/|^data:image\//i.test(image) ? <img src={image} alt="" style={{ width: 56, height: 56, objectFit: 'cover', borderRadius: 'var(--radius-md)' }} /> : image || '⭐'}
      </div>
      <div>
        <div className="row between">
          <Badge tone="accent">Chef's special</Badge>
          <Timer tone={tone} data-testid="special-countdown">Ends in {formatCountdown(remainingMs)}</Timer>
        </div>
        <div style={{ fontWeight: 600, marginTop: 4 }}>{special.name}</div>
        {info?.description && <div className="secondary" style={{ fontSize: 'var(--text-sm)' }}>{info.description}</div>}
        <div className="row between" style={{ marginTop: 4 }}>
          <span className="num" style={{ fontWeight: 600 }}>
            {formatPrice(special.special_price_cents)} <span className="muted" style={{ fontWeight: 400 }}>· {special.stock_left} left</span>
          </span>
          <AddPill data-testid="special-add" aria-label={`Add ${special.name} (Chef's special)`} onClick={() => onAdd?.(special)}>
            + Add
          </AddPill>
        </div>
      </div>
    </section>
  );
}
