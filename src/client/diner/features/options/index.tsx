// U6: the "Make it yours" options sheet (US8.1, W1). The Menu mounts this point (BR14.2) and hands it the item
// whose sheet is open; with no item it renders nothing.
import React from 'react';
import type { DinerFeatureProps } from '../types.js';
import type { ChefSpecial, DinerMenuItem } from '../menuTypes.js';
import OptionsSheet, { type OptionsAddPayload } from './OptionsSheet.js';

export interface OptionsFeatureProps extends DinerFeatureProps {
  item?: DinerMenuItem | null;
  special?: ChefSpecial | null;
  onAdd?: (payload: OptionsAddPayload) => void;
  onClose?: () => void;
}

export default function OptionsFeature({ item, special, onAdd, onClose }: OptionsFeatureProps) {
  if (!item || !onAdd || !onClose) return null;
  // key: a fresh sheet (no earlier choices) for every item it opens for
  return <OptionsSheet key={`${item.id}:${special?.id ?? ''}`} item={item} special={special} onAdd={onAdd} onClose={onClose} />;
}

export { OptionsSheet };
