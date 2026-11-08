// U6: Rate your meal on the table-closed screen (US18.1; BR6.1, BR6.2; D11, W9). One thumb per dish of the
// closed visit, saved at once, changeable until Done locks them.
import React from 'react';
import type { DinerFeatureProps } from '../types.js';
import { useRatings } from './useRatings.js';
import '../features.css';

export default function RatingFeature({ tableId }: DinerFeatureProps) {
  const { dishes, thumbs, done, message, rate, finish } = useRatings(tableId);
  if (dishes.length === 0) return null;
  return (
    <section className="card stack" style={{ gap: 12, width: '100%', maxWidth: 'var(--diner-max)', textAlign: 'left' }} aria-label="Rate your meal" data-testid="rate-meal">
      <h2 style={{ margin: 0 }}>Rate your meal</h2>
      {dishes.map((d) => (
        <div className="row between" key={d.itemId} data-testid={`rate-dish-${d.itemId}`}>
          <span>{d.name}</span>
          <span className="row">
            {(['up', 'down'] as const).map((thumb) => (
              <button
                key={thumb}
                type="button"
                className={`btn btn-sm u6-touch thumb-btn ${thumb}`}
                aria-pressed={thumbs[d.itemId] === thumb}
                aria-label={`Thumbs ${thumb} for ${d.name}`}
                data-testid={`rate-${thumb}-${d.itemId}`}
                disabled={done}
                onClick={() => void rate(d.itemId, thumb)}
              >
                {thumb === 'up' ? '👍' : '👎'}
              </button>
            ))}
          </span>
        </div>
      ))}
      {message && (
        <p className="help" role="status" data-testid="rate-message">
          {message}
        </p>
      )}
      {!done && (
        <button type="button" className="btn btn-primary" data-testid="rate-done" onClick={() => void finish()}>
          Done
        </button>
      )}
    </section>
  );
}
