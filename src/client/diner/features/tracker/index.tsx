// U6: the order tracker and its wait text (US9.1, US14.1; BR3.3 to BR3.5). U5's Tracker and wait decision are used.
import React, { useEffect, useState } from 'react';
import { Badge, Tracker } from '../../../components/ui/index.js';
import { waitDisplay } from '../../../../shared/wait.js';
import type { DinerFeatureProps } from '../types.js';
import type { DinerOrder } from '../menuTypes.js';

export const TRACKER_STEPS = ['Pending', 'Preparing', 'Completed'];

/** Recalculated every 30 seconds (BR3.3). */
export function useNow(intervalMs = 30_000): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

export interface TrackerFeatureProps extends DinerFeatureProps {
  order?: Pick<DinerOrder, 'order_number' | 'status' | 'placed_at' | 'estimate_minutes'>;
}

export default function TrackerFeature({ order }: TrackerFeatureProps) {
  const now = useNow();
  if (!order) return null;
  // BR3.5: Cancelled shows the word and no bar, no time
  if (order.status === 'Cancelled') return <span className="secondary" data-testid={`order-cancelled-${order.order_number}`}>Cancelled</span>;

  const current = TRACKER_STEPS.indexOf(order.status);
  const wait = order.status === 'Completed' ? ({ kind: 'none' } as const) : waitDisplay(order.placed_at, order.estimate_minutes, now);
  return (
    <div className="stack" style={{ gap: 8 }}>
      <Tracker steps={TRACKER_STEPS} current={current} testId={`order-tracker-${order.order_number}`} />
      {wait.kind === 'remaining' && (
        <div className="secondary" data-testid={`order-estimate-${order.order_number}`}>
          About {wait.minutes} min left
        </div>
      )}
      {wait.kind === 'late' && (
        <div>
          <Badge tone="danger" data-testid={`running-late-${order.order_number}`}>
            Running late
          </Badge>
        </div>
      )}
    </div>
  );
}
