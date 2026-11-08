// U5 Step 8: presence of diner pages (BR8.1 to BR8.3).
process.env.DB_FILE = ':memory:';

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const published = vi.hoisted(() => [] as Array<{ channel: string; type: string; data: { table_id: number; connected: number; last_activity_at: string | null } }>);
vi.mock('../../sse.js', () => ({
  publish: (channel: string, type: string, data: unknown) => {
    published.push({ channel, type, data: data as (typeof published)[number]['data'] });
  },
}));

import {
  PAGE_ID_PATTERN,
  getPresence,
  pageConnected,
  pageDisconnected,
  heartbeat,
  sweepPresence,
  startPresenceSweep,
  setPresenceForTest,
  resetPresenceForTest,
  _presenceSizes,
  _evictedCount,
} from '../../presence.js';
import { PRESENCE_MAX_PER_TABLE, PRESENCE_MAX_TOTAL, PRESENCE_WINDOW_MS, PRESENCE_SWEEP_MS } from '../../config.js';

const T0 = Date.parse('2026-11-08T12:00:00.000Z');
const MIN = 60_000;
const events = (table?: number) =>
  published.filter((e) => e.type === 'TABLE_PRESENCE_CHANGED' && (table === undefined || e.data.table_id === table));

describe('presence', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(T0);
    resetPresenceForTest();
    published.length = 0;
  });
  afterEach(() => {
    resetPresenceForTest();
    vi.useRealTimers();
  });

  it('a connected page counts, with the time of its last sign of life', () => {
    expect(getPresence(3)).toEqual({ connected: 0, last_activity_at: null });
    pageConnected(3, 'page-aaaaaaaa');
    expect(getPresence(3)).toEqual({ connected: 1, last_activity_at: '2026-11-08T12:00:00.000Z' });
    // Another table is unaffected
    expect(getPresence(4).connected).toBe(0);
  });

  it('a page is present for 5 minutes after its last sign of life, then no longer (BR8.2)', () => {
    pageConnected(3, 'page-aaaaaaaa');
    vi.setSystemTime(T0 + PRESENCE_WINDOW_MS - 1);
    expect(getPresence(3).connected).toBe(1);
    vi.setSystemTime(T0 + PRESENCE_WINDOW_MS);
    expect(getPresence(3).connected).toBe(0);
  });

  it('a heartbeat renews the 5 minutes and moves the latest sign of life', () => {
    pageConnected(3, 'page-aaaaaaaa');
    vi.setSystemTime(T0 + 4 * MIN);
    heartbeat(3, 'page-aaaaaaaa');
    vi.setSystemTime(T0 + 8 * MIN);
    expect(getPresence(3)).toEqual({ connected: 1, last_activity_at: new Date(T0 + 4 * MIN).toISOString() });
  });

  it('a heartbeat without an open connection does not make a page present; the connection that follows does', () => {
    heartbeat(3, 'page-aaaaaaaa');
    expect(getPresence(3).connected).toBe(0);
    expect(events()).toHaveLength(0);
    pageConnected(3, 'page-aaaaaaaa');
    expect(getPresence(3).connected).toBe(1);
  });

  it('closing the connection removes the page at once', () => {
    pageConnected(3, 'page-aaaaaaaa');
    pageDisconnected(3, 'page-aaaaaaaa');
    expect(getPresence(3)).toEqual({ connected: 0, last_activity_at: null });
    expect(_presenceSizes()).toEqual({ tables: 0, pages: 0 });
    // Closing something that is not there is harmless
    expect(() => pageDisconnected(3, 'page-zzzzzzzz')).not.toThrow();
  });

  it('a page that reconnects before its old connection is seen closing is still present', () => {
    pageConnected(3, 'page-aaaaaaaa'); // old connection
    pageConnected(3, 'page-aaaaaaaa'); // reconnect, same page id
    pageDisconnected(3, 'page-aaaaaaaa'); // old one closes
    expect(getPresence(3).connected).toBe(1);
    pageDisconnected(3, 'page-aaaaaaaa');
    expect(getPresence(3).connected).toBe(0);
  });

  it('counts distinct pages of one table', () => {
    pageConnected(3, 'page-aaaaaaaa');
    pageConnected(3, 'page-bbbbbbbb');
    pageConnected(3, 'page-cccccccc');
    expect(getPresence(3).connected).toBe(3);
  });

  it('page ids are 8 to 64 letters, digits or hyphens (BR8.1)', () => {
    for (const ok of ['abcdefgh', 'A1-b2-C3-d4', 'x'.repeat(64)]) expect(PAGE_ID_PATTERN.test(ok)).toBe(true);
    for (const bad of ['short', 'x'.repeat(65), 'has space1', 'under_score', 'emoji-😀-aaaa', '']) {
      expect(PAGE_ID_PATTERN.test(bad)).toBe(false);
    }
  });

  describe('the event (BR8.3)', () => {
    it('a change is published to staff with the table, the count and the latest sign of life', () => {
      pageConnected(3, 'page-aaaaaaaa');
      expect(events()).toEqual([
        {
          channel: 'staff',
          type: 'TABLE_PRESENCE_CHANGED',
          data: { table_id: 3, connected: 1, last_activity_at: '2026-11-08T12:00:00.000Z' },
        },
      ]);
    });

    it('changes inside one second are merged into one event that carries the latest count', () => {
      pageConnected(3, 'page-aaaaaaaa'); // goes out at once
      pageConnected(3, 'page-bbbbbbbb'); // inside the second: waits
      pageConnected(3, 'page-cccccccc'); // merged with the one above
      expect(events(3).map((e) => e.data.connected)).toEqual([1]);
      vi.advanceTimersByTime(999);
      expect(events(3)).toHaveLength(1);
      vi.advanceTimersByTime(1);
      expect(events(3).map((e) => e.data.connected)).toEqual([1, 3]);
    });

    it('a change that cancels itself inside the second publishes nothing more', () => {
      pageConnected(3, 'page-aaaaaaaa');
      pageConnected(3, 'page-bbbbbbbb');
      pageDisconnected(3, 'page-bbbbbbbb');
      vi.advanceTimersByTime(2000);
      expect(events(3).map((e) => e.data.connected)).toEqual([1]);
    });

    it('a different table has its own second', () => {
      pageConnected(3, 'page-aaaaaaaa');
      pageConnected(4, 'page-bbbbbbbb');
      expect(events().map((e) => e.data.table_id)).toEqual([3, 4]);
    });

    it('a heartbeat that changes no count publishes nothing', () => {
      pageConnected(3, 'page-aaaaaaaa');
      vi.advanceTimersByTime(5000);
      heartbeat(3, 'page-aaaaaaaa');
      vi.advanceTimersByTime(5000);
      expect(events(3)).toHaveLength(1);
    });

    it('closing is published after the second has passed', () => {
      pageConnected(3, 'page-aaaaaaaa');
      vi.advanceTimersByTime(1500);
      pageDisconnected(3, 'page-aaaaaaaa');
      expect(events(3).map((e) => e.data.connected)).toEqual([1, 0]);
      expect(events(3)[1].data.last_activity_at).toBeNull();
    });
  });

  describe('the sweep (BR8.2, BR8.3)', () => {
    it('reports a page that went quiet within the sweep, though nothing connected or disconnected', () => {
      pageConnected(3, 'page-aaaaaaaa');
      expect(events(3)).toHaveLength(1);
      vi.setSystemTime(T0 + 6 * MIN); // quiet for 6 minutes: not present, not yet dropped
      sweepPresence();
      expect(events(3).map((e) => e.data.connected)).toEqual([1, 0]);
      expect(_presenceSizes().pages).toBe(1);
    });

    it('drops pages quiet for more than 10 minutes from memory', () => {
      pageConnected(3, 'page-aaaaaaaa');
      pageConnected(4, 'page-bbbbbbbb');
      vi.setSystemTime(T0 + 9 * MIN);
      heartbeat(4, 'page-bbbbbbbb');
      vi.setSystemTime(T0 + 10 * MIN + 1);
      sweepPresence();
      expect(_presenceSizes()).toEqual({ tables: 1, pages: 1 });
    });

    it('runs by itself every 30 seconds once started', () => {
      startPresenceSweep();
      startPresenceSweep(); // starting twice does not double it
      pageConnected(3, 'page-aaaaaaaa');
      vi.setSystemTime(T0 + 6 * MIN);
      vi.advanceTimersByTime(PRESENCE_SWEEP_MS);
      expect(events(3).map((e) => e.data.connected)).toEqual([1, 0]);
    });
  });

  describe('memory caps (BR8.2)', () => {
    it('keeps at most 500 pages per table and drops the one with the oldest sign of life first', () => {
      for (let i = 0; i < PRESENCE_MAX_PER_TABLE; i++) {
        vi.setSystemTime(T0 + i);
        pageConnected(3, `page-${String(i).padStart(8, '0')}`);
      }
      expect(_presenceSizes().pages).toBe(PRESENCE_MAX_PER_TABLE);
      vi.setSystemTime(T0 + PRESENCE_MAX_PER_TABLE);
      pageConnected(3, 'page-newest01');
      expect(_presenceSizes().pages).toBe(PRESENCE_MAX_PER_TABLE);
      expect(getPresence(3).connected).toBe(PRESENCE_MAX_PER_TABLE);
      // The oldest (page 0) was dropped: closing it now changes nothing
      pageDisconnected(3, 'page-00000000');
      expect(getPresence(3).connected).toBe(PRESENCE_MAX_PER_TABLE);
      // and the newest is there
      pageDisconnected(3, 'page-newest01');
      expect(getPresence(3).connected).toBe(PRESENCE_MAX_PER_TABLE - 1);
    });

    const fillConnected = (n: number, startAt = 0) => {
      for (let i = 0; i < n; i++) {
        vi.setSystemTime(T0 + startAt + i);
        pageConnected(3, `page-${String(i).padStart(8, '0')}`);
      }
    };

    it('regression: a quiet page is pushed out before a connected one, even when the quiet page is newer', () => {
      fillConnected(PRESENCE_MAX_PER_TABLE - 1); // 499 connected pages, the oldest is page 0
      vi.setSystemTime(T0 + 10_000);
      heartbeat(3, 'quiet-page-1'); // a heartbeat with no stream yet: newer than every connected page
      expect(_presenceSizes().pages).toBe(PRESENCE_MAX_PER_TABLE);

      vi.setSystemTime(T0 + 20_000);
      pageConnected(3, 'page-newest01'); // the table is full: someone has to go
      expect(getPresence(3).connected).toBe(PRESENCE_MAX_PER_TABLE); // 499 + the new one, all counted
      expect(_evictedCount()).toBe(0); // no connected page was pushed out
      pageDisconnected(3, 'page-00000000'); // still tracked: its close is understood
      expect(getPresence(3).connected).toBe(PRESENCE_MAX_PER_TABLE - 1);
    });

    it('regression: a connected page pushed out by the cap comes back and is counted at its next heartbeat', () => {
      fillConnected(PRESENCE_MAX_PER_TABLE);
      vi.setSystemTime(T0 + 10_000);
      pageConnected(3, 'page-newest01'); // every page is connected: page 0 (the oldest) is pushed out
      expect(_evictedCount()).toBe(1);
      expect(getPresence(3).connected).toBe(PRESENCE_MAX_PER_TABLE);

      vi.setSystemTime(T0 + 20_000);
      heartbeat(3, 'page-00000000'); // its stream is still open: it is counted again, and another oldest goes
      expect(getPresence(3).connected).toBe(PRESENCE_MAX_PER_TABLE); // not 499: the returning page counts
      expect(_evictedCount()).toBe(1); // page 1 took its place on the list of pushed-out pages
      pageDisconnected(3, 'page-00000000'); // and its close is counted
      expect(getPresence(3).connected).toBe(PRESENCE_MAX_PER_TABLE - 1);
    });

    it('a pushed-out page whose stream then closes is forgotten, and nothing else is changed', () => {
      fillConnected(PRESENCE_MAX_PER_TABLE);
      vi.setSystemTime(T0 + 10_000);
      pageConnected(3, 'page-newest01');
      expect(_evictedCount()).toBe(1);
      pageDisconnected(3, 'page-00000000'); // closes while pushed out
      expect(_evictedCount()).toBe(0);
      expect(getPresence(3).connected).toBe(PRESENCE_MAX_PER_TABLE);
      heartbeat(3, 'page-00000000'); // a late heartbeat of a page that is gone: recorded, but not present
      expect(getPresence(3).connected).toBe(PRESENCE_MAX_PER_TABLE);
    });

    it('keeps at most 5,000 pages in all', () => {
      let id = 0;
      for (let table = 1; table <= 11; table++) {
        for (let i = 0; i < 500; i++) {
          vi.setSystemTime(T0 + id);
          pageConnected(table, `page-${String(id++).padStart(8, '0')}`);
        }
      }
      expect(id).toBe(5500);
      expect(_presenceSizes().pages).toBeLessThanOrEqual(PRESENCE_MAX_TOTAL);
      expect(_presenceSizes().pages).toBe(PRESENCE_MAX_TOTAL);
    });
  });

  describe('test helper (BR14.3)', () => {
    it('sets a table to a number of present pages and publishes at once', () => {
      setPresenceForTest(5, 3);
      expect(getPresence(5).connected).toBe(3);
      expect(events(5).map((e) => e.data.connected)).toEqual([3]);
      setPresenceForTest(5, 0);
      expect(getPresence(5)).toEqual({ connected: 0, last_activity_at: null });
      expect(events(5).map((e) => e.data.connected)).toEqual([3, 0]);
    });
  });
});
