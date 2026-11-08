// U6: "Need something?" with Call the waiter and Ask for the bill (US17.1; BR5.1 to BR5.3; W7).
import React from 'react';
import { Button } from '../../../components/ui/index.js';
import type { DinerFeatureProps } from '../types.js';
import type { CallKind } from '../api.js';
import { useCalls, type CallState } from './useCalls.js';

const KINDS: Array<{ kind: CallKind; label: string; testId: string }> = [
  { kind: 'waiter', label: 'Call the waiter', testId: 'call-waiter' },
  { kind: 'bill', label: 'Ask for the bill', testId: 'ask-bill' },
];

function buttonText(label: string, state: CallState): string {
  return state === 'sent' ? 'Request sent' : label;
}

export default function HelpCardFeature({ tableId, events }: DinerFeatureProps) {
  const { states, visible, error, press } = useCalls(tableId, events);
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
            disabled={states[k.kind] === 'sent'}
            onClick={() => void press(k.kind)}
          >
            {buttonText(k.label, states[k.kind])}
          </Button>
        ))}
      </div>
      {answered.length > 0 && (
        <p className="help" role="status" data-testid="help-status">
          Help is on the way.
        </p>
      )}
      {error && (
        <p className="error-text" role="alert" data-testid="help-error">
          {error}
        </p>
      )}
    </section>
  );
}
