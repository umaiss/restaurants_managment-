// U6: "Need something?" with Call the waiter and Ask for the bill (US17.1; BR5.1 to BR5.3; W7).
import React, { useState } from 'react';
import { Button, Sheet } from '../../../components/ui/index.js';
import type { DinerFeatureProps } from '../types.js';
import type { CallKind, PaymentMethod } from '../api.js';
import { useCalls, type CallState } from './useCalls.js';

const KINDS: Array<{ kind: CallKind; label: string; testId: string }> = [
  { kind: 'waiter', label: 'Call the waiter', testId: 'call-waiter' },
  { kind: 'bill', label: 'Ask for the bill', testId: 'ask-bill' },
];

const PAYMENTS: Array<{ method: PaymentMethod; label: string }> = [
  { method: 'cash', label: 'Pay with cash' },
  { method: 'card', label: 'Pay with card' },
];

function buttonText(label: string, state: CallState): string {
  return state === 'sent' ? 'Request sent' : label;
}

interface HelpCardProps extends DinerFeatureProps {
  /** False while an order is still being made: "Ask for the bill" waits until every order is completed. */
  canAskBill?: boolean;
}

export default function HelpCardFeature({ tableId, events, canAskBill = true }: HelpCardProps) {
  const { states, visible, error, press } = useCalls(tableId, events);
  const [choosingPayment, setChoosingPayment] = useState(false);
  const [wantsReceipt, setWantsReceipt] = useState(false);
  if (!visible) return null; // no open visit, or the table was closed

  const answered = KINDS.filter((k) => states[k.kind] === 'answered');
  return (
    <section className="card stack" style={{ gap: 8, marginBottom: 'var(--space-3)' }} aria-label="Need something?" data-testid="help-card">
      <h3 style={{ margin: 0 }}>Need something?</h3>
      <div className="row">
        {KINDS.map((k) => (
          <Button
            key={k.kind}
            small
            className="u6-touch"
            style={{ flex: 1 }}
            data-testid={k.testId}
            disabled={states[k.kind] === 'sent' || (k.kind === 'bill' && !canAskBill)}
            onClick={() => (k.kind === 'bill' ? setChoosingPayment(true) : void press(k.kind))}
          >
            {buttonText(k.label, states[k.kind])}
          </Button>
        ))}
      </div>
      {!canAskBill && states.bill !== 'sent' && (
        <p className="help" data-testid="bill-wait">
          You can ask for the bill once your order is completed.
        </p>
      )}
      {answered.length > 0 && (
        <p className="help" role="status" data-testid="help-status">
          Help is on the way.
        </p>
      )}
      <Sheet open={choosingPayment} title="How would you like to pay?" onClose={() => setChoosingPayment(false)} testId="pay-sheet">
        <div className="stack">
          <label className="row" style={{ gap: 8, alignItems: 'center', minHeight: 'var(--touch)' }}>
            <input
              type="checkbox"
              data-testid="pay-receipt"
              checked={wantsReceipt}
              onChange={(e) => setWantsReceipt(e.target.checked)}
              style={{ width: 22, height: 22 }}
            />
            <span>I would like a receipt</span>
          </label>
          {PAYMENTS.map((p) => (
            <Button
              key={p.method}
              className="u6-touch"
              data-testid={`pay-${p.method}`}
              onClick={() => {
                setChoosingPayment(false);
                void press('bill', p.method, wantsReceipt);
              }}
            >
              {p.label}
            </Button>
          ))}
          <Button variant="ghost" className="u6-touch" data-testid="pay-cancel" onClick={() => setChoosingPayment(false)}>
            Cancel
          </Button>
        </div>
      </Sheet>
      {error && (
        <p className="error-text" role="alert" data-testid="help-error">
          {error}
        </p>
      )}
    </section>
  );
}
