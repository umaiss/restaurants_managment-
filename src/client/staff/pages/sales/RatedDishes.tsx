/**
 * The best and worst rated dishes of a day (U7 Step 12). Rule BR7.6: ranked by the share of thumbs up (ties by more
 * ratings, then by name; the server states the rule in words, shown here), top 3 of each, each with its share and its
 * number of ratings. BR7.5: with no ratings it says "No ratings yet today."
 */
import React from 'react';

export interface RatedDish {
  item_id: string;
  name: string;
  up: number;
  total: number;
  share: number;
}
export interface RatingsReport {
  day: string;
  best: RatedDish[];
  worst: RatedDish[];
  tie_rule: string;
}

const ratingsWord = (n: number) => `${n} ${n === 1 ? 'rating' : 'ratings'}`;

export function bestLine(d: RatedDish): string {
  return `👍 ${Math.round(d.share * 100)}% · ${ratingsWord(d.total)}`;
}
export function worstLine(d: RatedDish): string {
  return `👎 ${Math.round((1 - d.share) * 100)}% thumbs down · ${ratingsWord(d.total)}`;
}

export default function RatedDishes({ report, error }: { report: RatingsReport | null; error?: boolean }) {
  if (error && report === null) {
    return (
      <p data-testid="ratings-error" role="alert" className="error-text" style={{ margin: 0 }}>
        Ratings could not be loaded.
      </p>
    );
  }
  if (report === null) return null;
  if (report.best.length === 0) {
    return (
      <p data-testid="ratings-none" className="help" style={{ margin: 0 }}>
        No ratings yet today.
      </p>
    );
  }
  return (
    <div className="stack" data-testid="ratings-card" style={{ gap: 'var(--space-2)' }}>
      <div className="u7-two">
        <div className="u7-stat" data-testid="ratings-best">
          <div className="k">Best rated today</div>
          <ol style={{ margin: 0, paddingLeft: 'var(--space-4)' }}>
            {report.best.map((d) => (
              <li key={d.item_id}>
                <strong>{d.name}</strong>
                <div className="k">{bestLine(d)}</div>
              </li>
            ))}
          </ol>
        </div>
        <div className="u7-stat" data-testid="ratings-worst">
          <div className="k">Worst rated today</div>
          <ol style={{ margin: 0, paddingLeft: 'var(--space-4)' }}>
            {report.worst.map((d) => (
              <li key={d.item_id}>
                <strong>{d.name}</strong>
                <div className="k">{worstLine(d)}</div>
              </li>
            ))}
          </ol>
        </div>
      </div>
      <p className="help" style={{ margin: 0 }}>
        {report.tie_rule}
      </p>
    </div>
  );
}
