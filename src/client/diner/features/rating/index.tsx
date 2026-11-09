// U6: Rate your meal on the table-closed screen (US18.1; BR6.1, BR6.2; D11, W9). One thumb per dish of the
// closed visit, saved at once, changeable until Done locks them.
import React, { useEffect } from 'react';
import type { DinerFeatureProps } from '../types.js';
import { MAX_COMMENT_LENGTH, useRatings } from './useRatings.js';
import '../features.css';

interface RatingProps extends DinerFeatureProps {
  /** Called a moment after the ratings are submitted, so the thank-you can be read first. */
  onDone?: () => void;
}

/** How long the thank-you stays before the screen moves on. */
const THANK_YOU_MS = 1500;

export default function RatingFeature({ tableId, onDone }: RatingProps) {
  const { dishes, thumbs, done, message, comment, setComment, saveComment, rate, finish } = useRatings(tableId);
  useEffect(() => {
    if (!done || !onDone) return;
    const timer = setTimeout(onDone, THANK_YOU_MS);
    return () => clearTimeout(timer);
  }, [done, onDone]);
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
      <label className="stack" style={{ gap: 6 }}>
        <span>Anything else you would like to tell us? (optional)</span>
        <textarea
          className="input"
          data-testid="rate-comment"
          rows={3}
          maxLength={MAX_COMMENT_LENGTH}
          value={comment}
          disabled={done}
          placeholder="Tell us what you liked or what we can do better"
          style={{ minHeight: 88, padding: 'var(--space-3)', resize: 'vertical' }}
          onChange={(e) => setComment(e.target.value)}
          onBlur={() => void saveComment()}
        />
        <span className="help" aria-live="polite">
          {`${comment.length}/${MAX_COMMENT_LENGTH}`}
        </span>
      </label>
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
