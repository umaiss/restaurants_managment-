// U6: the "Your order is ready" banner (US4.1; BR4.1, BR4.2; D9, W5). U5's alert logic decides once per event.
// Events are handed to it with no time of its own, so no device clock is compared with the server's: an event
// id seen before (a replay after a reconnect, a duplicate) shows nothing, and a reload opens a fresh stream.
import React, { useState } from 'react';
import { useAlerts } from '../../../alerts/useAlerts.js';
import { readMuted, useSoundPreference } from '../../../hooks/useSoundPreference.js';
import type { DinerFeatureProps } from '../types.js';
import { announcePrefsChange, useAllEvents } from '../liveHelpers.js';

/** The id an alert fires once for: an order completes once, so order number plus status is the event's identity. */
export function readyEventId(data: { order_number?: unknown }): string {
  return `ORDER_STATUS_CHANGED:${String(data.order_number)}:Completed`;
}

export default function ReadyBannerFeature({ tableId, events }: DinerFeatureProps) {
  const { setMuted } = useSoundPreference();
  // Read the saved value now, so a change made in the Settings sheet is honoured by the next alert.
  const muted = readMuted();
  const { alerts, raise, dismiss } = useAlerts({ muted });
  const [, force] = useState(0);

  useAllEvents(events, (ev) => {
    if (ev.type !== 'ORDER_STATUS_CHANGED') return;
    const data = (ev.data ?? {}) as { order_number?: unknown; status?: unknown; table_id?: unknown };
    if (data.status !== 'Completed' || data.order_number === undefined) return;
    if (data.table_id !== undefined && String(data.table_id) !== String(tableId)) return;
    raise({ id: readyEventId(data), occurredAt: null, title: `Your order #${String(data.order_number)} is ready`, message: 'Your food is on its way to the table.' });
  });

  if (alerts.length === 0) return null;
  return (
    <div className="stack" style={{ padding: 'var(--space-3) var(--space-4) 0', gap: 'var(--space-2)' }}>
      {alerts.map((a) => (
        <div key={a.id} className="banner banner-success slide-up" role="status" data-testid="ready-banner">
          <span aria-hidden="true">{'✅'}</span>
          <div style={{ flex: 1 }}>
            <strong>{a.title}</strong>
            {a.message}
          </div>
          <div className="row">
            {!muted && (
              <button
                type="button"
                className="btn btn-ghost btn-sm u6-touch"
                data-testid="ready-banner-mute"
                onClick={() => {
                  setMuted(true);
                  announcePrefsChange();
                  force((n) => n + 1);
                }}
              >
                Mute
              </button>
            )}
            <button type="button" className="btn btn-ghost btn-sm u6-touch" data-testid="ready-banner-dismiss" onClick={() => dismiss(a.id)}>
              Dismiss
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
