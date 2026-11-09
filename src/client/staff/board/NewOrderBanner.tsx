/**
 * The ring for the kitchen: a new order, or a table calling the waiter or asking for the bill, shows a banner and
 * rings a bell (the bell is silent when muted). The new-order alert (U7 Step 10). Rule BR3.1: an ORDER_PLACED event raises "New order #<n> from Table <n>"
 * once, through U5's alert logic (never twice for the same event, never for an event from before the page
 * loaded), with a short sound only after the first tap and only when not muted. The Sound on / Muted switch
 * is in the page header and uses U5's sound preference (see SoundSwitch).
 */
import React, { useEffect, useRef } from 'react';
import { Banner, SegmentedControl } from '../../components/ui/index';
import { useAlerts } from '../../alerts/useAlerts';
import { playRingSound } from '../../alerts/alertLogic';
import type { StaffSSEEvent } from '../../hooks/useStaffSSE';
import '../staff-u7.css';

/** How many banners stay on screen at once; older ones are dropped from the top. */
const MAX_BANNERS = 3;

interface OrderPlacedData {
  order_number: number;
  table_id: number;
  placed_at?: string;
  lines?: Array<{ quantity: number }>;
}

interface CallOpenedData {
  call_id: string;
  table_id: number;
  kind: 'waiter' | 'bill';
  opened_at?: string;
  payment_method?: 'cash' | 'card';
  wants_receipt?: boolean;
}

export interface NewOrderBannerProps {
  events: StaffSSEEvent[];
  muted: boolean;
}

export default function NewOrderBanner({ events, muted }: NewOrderBannerProps) {
  const { alerts, raise, dismiss } = useAlerts({ muted, playSound: playRingSound });
  const processedSeqRef = useRef(0);

  useEffect(() => {
    for (const ev of events) {
      const seq = ev.seq ?? 0;
      if (seq <= processedSeqRef.current) continue;
      processedSeqRef.current = seq;
      if (ev.type === 'SERVICE_CALL_OPENED') {
        const call = ev.data as CallOpenedData;
        const opened = call.opened_at ? Date.parse(call.opened_at) : NaN;
        const how = [call.payment_method === 'cash' ? 'Pays with cash' : call.payment_method === 'card' ? 'Pays with card' : null, call.wants_receipt ? 'wants a receipt' : null]
          .filter(Boolean)
          .join(', ');
        raise({
          id: `SERVICE_CALL_OPENED:${call.call_id}`,
          occurredAt: Number.isNaN(opened) ? null : opened,
          title: call.kind === 'bill' ? `Table ${call.table_id} is asking for the bill` : `Table ${call.table_id} is calling the waiter`,
          message: call.kind === 'bill' && how ? `${how[0].toUpperCase()}${how.slice(1)}.` : undefined,
        });
        continue;
      }
      if (ev.type !== 'ORDER_PLACED') continue;
      const data = ev.data as OrderPlacedData;
      const placed = data.placed_at ? Date.parse(data.placed_at) : NaN;
      const items = (data.lines ?? []).reduce((sum, l) => sum + l.quantity, 0);
      raise({
        id: `ORDER_PLACED:${data.order_number}`,
        occurredAt: Number.isNaN(placed) ? null : placed,
        title: `New order #${data.order_number} from Table ${data.table_id}`,
        message: items > 0 ? `${items} ${items === 1 ? 'item' : 'items'} just came in.` : undefined,
      });
    }
  }, [events, raise]);

  const shown = alerts.slice(-MAX_BANNERS);
  if (shown.length === 0) return null;
  return (
    <div data-testid="new-order-alerts" className="stack" style={{ gap: 'var(--space-2)' }}>
      {shown.map((a) => (
        <Banner
          key={a.id}
          tone={a.id.startsWith('SERVICE_CALL_OPENED') ? 'warn' : 'info'}
          icon="🔔"
          title={a.title}
          onDismiss={() => dismiss(a.id)}
          testId={a.id.startsWith('SERVICE_CALL_OPENED') ? `call-alert-${a.id.split(':')[1]}` : `new-order-alert-${a.id.split(':')[1]}`}
        >
          {a.message}
        </Banner>
      ))}
    </div>
  );
}

/** The Sound on / Muted switch of the page header (BR3.1), saved in the browser by U5's useSoundPreference. */
export function SoundSwitch({ muted, setMuted }: { muted: boolean; setMuted: (muted: boolean) => void }) {
  return (
    <SegmentedControl
      ariaLabel="Sound"
      testId="staff-sound"
      options={[
        { value: 'on', label: 'Sound on' },
        { value: 'muted', label: 'Muted' },
      ]}
      value={muted ? 'muted' : 'on'}
      onChange={(v) => setMuted(v === 'muted')}
    />
  );
}
