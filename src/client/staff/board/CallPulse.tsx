/**
 * A table's open requests on the Kitchen Board (U7 Step 10). Rule BR3.2: a table with an open "waiter" request
 * shows "Calling the waiter", with an open "bill" request "Asking for the bill" (both when both are open);
 * "Respond" answers every open request of the table. The pulse itself is the card's .u7-pulse class, which
 * stops under reduced motion while the words stay. The requests leave the screen when the response event
 * arrives (the board's hook removes them), not when the button is pressed.
 */
import React, { useState } from 'react';
import { Badge, Button } from '../../components/ui/index';
import { staffFetch } from '../staffAuth';
import type { OpenCall } from '../../hooks/useBoardOrders';
import { CALL_LABELS } from './constants';
import '../staff-u7.css';

export interface CallPulseProps {
  tableId: number;
  calls: OpenCall[];
  /** For tests: replaces the real POST. Returns true when every request was accepted. */
  onRespond?: (calls: OpenCall[]) => Promise<boolean>;
}

/** POST /api/service-calls/{id}/respond for each call. True when all were accepted (a 404 counts as gone). */
export async function respondToCalls(calls: OpenCall[]): Promise<boolean> {
  let ok = true;
  for (const call of calls) {
    try {
      const res = await staffFetch(`/api/service-calls/${call.id}/respond`, { method: 'POST' });
      if (!res.ok && res.status !== 404) ok = false;
    } catch {
      ok = false;
    }
  }
  return ok;
}

/** The labels of a table's open requests, "waiter" first. */
export function callLabels(calls: OpenCall[]): string[] {
  const kinds = new Set(calls.map((c) => c.kind));
  return (['waiter', 'bill'] as const).filter((k) => kinds.has(k)).map((k) => CALL_LABELS[k]);
}

/** The words of a table's open requests (a badge for each kind), for the card's header row. */
export function CallLabels({ tableId, calls }: { tableId: number; calls: OpenCall[] }) {
  if (calls.length === 0) return null;
  const kinds = new Set(calls.map((c) => c.kind));
  return (
    <span className="row" style={{ flexWrap: 'wrap', justifyContent: 'flex-end' }} data-testid={`call-labels-${tableId}`}>
      {kinds.has('waiter') && (
        <Badge tone="accent" data-testid={`call-label-waiter-${tableId}`}>
          🔔 {CALL_LABELS.waiter}
        </Badge>
      )}
      {kinds.has('bill') && (
        <Badge tone="danger" data-testid={`call-label-bill-${tableId}`}>
          🔔 {CALL_LABELS.bill}
        </Badge>
      )}
    </span>
  );
}

/** The Respond button, for the foot of the card. It answers every open request of the table. */
export function CallRespond({ tableId, calls, onRespond }: CallPulseProps) {
  const [sending, setSending] = useState(false);
  const [failed, setFailed] = useState(false);
  if (calls.length === 0) return null;

  async function respond() {
    setSending(true);
    setFailed(false);
    const ok = await (onRespond ?? respondToCalls)(calls);
    setFailed(!ok);
    setSending(false);
  }

  return (
    <div className="stack" style={{ gap: 'var(--space-2)' }} data-testid={`call-respond-${tableId}`}>
      <Button small data-testid={`respond-${tableId}`} disabled={sending} onClick={respond}>
        {sending ? 'Sending…' : 'Respond'}
      </Button>
      {failed && (
        <p role="alert" className="error-text" style={{ margin: 0 }}>
          The response could not be sent. The request stays open; try again.
        </p>
      )}
    </div>
  );
}

/** Both parts together: the words, then Respond. */
export default function CallPulse({ tableId, calls, onRespond }: CallPulseProps) {
  if (calls.length === 0) return null;
  return (
    <div data-testid={`call-pulse-${tableId}`} className="stack" style={{ gap: 'var(--space-2)' }}>
      <CallLabels tableId={tableId} calls={calls} />
      <CallRespond tableId={tableId} calls={calls} onRespond={onRespond} />
    </div>
  );
}
