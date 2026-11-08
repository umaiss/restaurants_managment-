// Code review, Minor: the last closed visit and the current visit are chosen by parsed time, so v1's
// date-time text and v2's ISO text can sit in one table (BR11.6).
process.env.DB_FILE = ':memory:';

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getDb, resetDb, seedIfEmpty, getCurrentVisit } from '../../db.js';
import { getLastClosedVisitId, getTableStatus } from '../../repositories/tableRepo.js';

function visit(id: string, openedAt: string, closedAt: string | null, table = 1) {
  getDb().prepare('INSERT INTO visits (id, table_id, opened_at, closed_at) VALUES (?, ?, ?, ?)').run(id, table, openedAt, closedAt);
}

describe('which visit is the last closed one', () => {
  beforeEach(() => {
    resetDb();
    seedIfEmpty();
  });
  afterEach(() => {
    resetDb();
  });

  it('regression: a v1 visit closed at 09:00 is later than a v2 visit closed at 08:00 the same day', () => {
    visit('v1-late', '2026-11-08 08:00:00', '2026-11-08 09:00:00'); // v1's text: space between date and time
    visit('v2-early', '2026-11-08T07:00:00.000Z', '2026-11-08T08:00:00.000Z'); // v2's ISO text
    // As text, "2026-11-08T08…" sorts after "2026-11-08 09…" (T is after the space), which was the old, wrong answer
    expect(getLastClosedVisitId(1)).toBe('v1-late');
    expect(getTableStatus(1).last_closed_visit_id).toBe('v1-late');
  });

  it('a v2 visit closed later than a v1 visit is the last one', () => {
    visit('v1-early', '2026-11-08 06:00:00', '2026-11-08 07:00:00');
    visit('v2-late', '2026-11-08T08:00:00.000Z', '2026-11-08T09:30:00.000Z');
    expect(getLastClosedVisitId(1)).toBe('v2-late');
  });

  it('the same instant in both formats is a tie, and the later row wins', () => {
    visit('first', '2026-11-08 08:00:00', '2026-11-08 09:00:00');
    visit('second', '2026-11-08T08:00:00.000Z', '2026-11-08T09:00:00.000Z');
    expect(getLastClosedVisitId(1)).toBe('second');
  });

  it('another table, an open visit and an unreadable time are handled', () => {
    visit('other-table', '2026-11-08 08:00:00', '2026-11-08 09:00:00', 2);
    visit('open', '2026-11-08T10:00:00.000Z', null);
    expect(getLastClosedVisitId(1)).toBeNull();
    visit('garbled', '2026-11-08 08:00:00', 'not a time');
    visit('real', '2026-11-08 08:00:00', '2026-11-08 08:30:00');
    expect(getLastClosedVisitId(1)).toBe('real');
    expect(getLastClosedVisitId(2)).toBe('other-table');
  });

  it('the current visit, when two are open, is the newer by parsed time', () => {
    visit('old-v1', '2026-11-08 09:00:00', null, 3);
    visit('new-v2-but-earlier-as-text', '2026-11-08T08:00:00.000Z', null, 3); // earlier in time, later as text
    expect(getCurrentVisit(3)?.id).toBe('old-v1');
  });
});
