// U6: "Same again" on a past order (US16.1; BR8.1, BR8.2; W8). Each option is matched by its label among the
// item's current choices; what cannot be matched is skipped and named in the one notice that opens the Cart.
import React, { useRef, useState } from 'react';
import { Button } from '../../../components/ui/index.js';
import { useCart } from '../../../hooks/useCart.js';
import { fetchMenu } from '../api.js';
import type { DinerFeatureProps } from '../types.js';
import type { DinerMenuItem, DinerOrder } from '../menuTypes.js';
import { buildSameAgain, sameAgainNotice } from './buildSameAgain.js';

export interface SameAgainFeatureProps extends DinerFeatureProps {
  order?: Pick<DinerOrder, 'order_number' | 'status' | 'lines'>;
  /** Called when the work has finished, with the one notice for the Cart. */
  onDone?: (notice: string) => void;
}

export default function SameAgainFeature({ tableId, order, onDone }: SameAgainFeatureProps) {
  const cart = useCart(tableId);
  const [busy, setBusy] = useState(false);
  const guard = useRef(false);
  if (!order || order.status !== 'Completed') return null;

  async function run() {
    if (guard.current || !order) return; // a double tap adds the items once
    guard.current = true;
    setBusy(true);
    try {
      let menu: DinerMenuItem[];
      try {
        menu = (await fetchMenu<{ items: DinerMenuItem[] }>()).items ?? [];
      } catch {
        onDone?.('We could not read the menu, so nothing was added. Please try again.');
        return;
      }
      const result = buildSameAgain(order, menu, cart.items);
      for (const a of result.adds) {
        cart.addItem(a.menuItemId, a.name, a.priceCents, a.quantity, { optionChoices: a.optionChoices, basePriceCents: a.basePriceCents });
      }
      onDone?.(sameAgainNotice(result));
    } finally {
      guard.current = false;
      setBusy(false);
    }
  }

  return (
    <Button small className="u6-touch" data-testid={`same-again-${order.order_number}`} disabled={busy} onClick={() => void run()}>
      Same again
    </Button>
  );
}
