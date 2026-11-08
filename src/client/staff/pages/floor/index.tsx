/**
 * The Floor map page (U7 Step 12). Rules: BR4.1 (tables come from the server), BR4.2 (each table shows its state
 * as a word AND a colour: Empty, Browsing, Waiting, Eating, Needs the bill), BR4.3 (live), BR4.4 (selecting a
 * table opens its bill at /staff/tables/<id>).
 */
import React from 'react';
import { Link } from 'react-router-dom';
import { Badge, Button, type BadgeTone } from '../../../components/ui/index';
import { useFloorTables, type FloorState } from './useFloorTables';
import '../../staff-u7.css';

/** The word, the badge tone and the table class of each state. */
export const FLOOR_STATES: Record<FloorState, { word: string; tone: BadgeTone; css: string; border: string }> = {
  empty: { word: 'Empty', tone: 'cancelled', css: 'empty', border: 'var(--border)' },
  browsing: { word: 'Browsing', tone: 'preparing', css: 'browsing', border: 'var(--preparing)' },
  waiting: { word: 'Waiting', tone: 'pending', css: 'waiting', border: 'var(--pending)' },
  eating: { word: 'Eating', tone: 'completed', css: 'eating', border: 'var(--completed)' },
  needs_bill: { word: '🔔 Needs the bill', tone: 'danger', css: 'bill', border: 'var(--danger)' },
};

const LEGEND_ORDER: FloorState[] = ['empty', 'browsing', 'waiting', 'eating', 'needs_bill'];

export default function FloorPage() {
  const { tables, loading, error, reload } = useFloorTables();

  return (
    <section data-testid="floor-map" className="stack" style={{ gap: 'var(--space-4)' }}>
      <div className="page-head">
        <div>
          <h1 style={{ margin: 0 }}>Floor map</h1>
          <div className="u7-live" style={{ marginTop: 4 }}>
            Updated live
          </div>
        </div>
      </div>

      {loading && tables === null && <p data-testid="floor-loading" className="secondary">Loading the floor map…</p>}

      {error && tables === null && (
        <div data-testid="floor-error" role="alert" className="stack">
          <p style={{ margin: 0 }}>The tables could not be loaded. Try again.</p>
          <Button small onClick={reload}>
            Retry
          </Button>
        </div>
      )}
      {/* A failed refresh keeps the last good map and says so */}
      {error && tables !== null && (
        <p role="status" className="error-text" data-testid="floor-stale" style={{ margin: 0 }}>
          The floor map could not be refreshed. It will update when the connection is back.
        </p>
      )}

      {tables !== null && (
        <>
          <div className="u7-legend" aria-label="Legend" data-testid="floor-legend">
            {LEGEND_ORDER.map((s) => (
              <span key={s}>
                <i style={{ borderColor: FLOOR_STATES[s].border, borderStyle: s === 'empty' ? 'dashed' : 'solid' }} />
                {FLOOR_STATES[s].word.replace('🔔 ', '')}
              </span>
            ))}
          </div>
          <div className="u7-floor" data-testid="floor-grid">
            {tables.map((t) => {
              const s = FLOOR_STATES[t.state];
              return (
                <Link key={t.id} to={`/staff/tables/${t.id}`} className={`t ${s.css}`} data-testid={`floor-table-${t.id}`} data-state={t.state} aria-label={`${t.label}, ${s.word.replace('🔔 ', '')}. Open its bill.`}>
                  <strong>{t.label}</strong>
                  <Badge tone={s.tone}>{s.word}</Badge>
                </Link>
              );
            })}
          </div>
          <p className="help">Each state also shows as a word, so colour is never the only signal.</p>
        </>
      )}
    </section>
  );
}
