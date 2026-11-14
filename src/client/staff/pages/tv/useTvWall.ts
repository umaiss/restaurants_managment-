/**
 * The TV wall's data hook (U8, contract C4). U9's screen renders from this hook only and makes no other request.
 * Rules: BR7.1 (re-read on the listed staff events, MENU_CHANGED and every reconnect; plan R-03 and R-05: the full
 * event list is read, so a burst cannot hide one), BR7.2 (one read in flight and at most one waiting), BR7.3 (a
 * re-read 5 minutes after the last read started, plan R-04), BR7.4 (a re-read when the server clock estimate passes
 * day_ends_at, plan R-02), BR7.5 (a newer answer always wins), BR7.6 (keep the last summary; Reconnecting or Error;
 * retry every 10 s; a read with no answer in 10 s has failed), BR7.7 (waits recount every 15 s), BR6.3 (a 401 goes to
 * the PIN screen through staffFetch).
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { staffFetch } from '../../staffAuth';
import { useStaffSSE } from '../../../hooks/useStaffSSE';
import type { TvSummary } from '../../../../shared/tvWall';

export const TV_SUMMARY_URL = '/api/staff/tv/summary';

/** The staff events that may change what the wall shows (BR7.1), plus MENU_CHANGED for a renamed dish (R-05). */
export const TV_REFRESH_EVENTS: readonly string[] = [
  'ORDER_PLACED',
  'ORDER_STATUS_CHANGED',
  'STATION_DONE',
  'TABLE_CLOSED',
  'SERVICE_CALL_OPENED',
  'SERVICE_CALL_RESPONDED',
  'TV_SETTINGS_CHANGED',
  'MENU_CHANGED',
];

/** Waits recount this often (BR7.7); the 5-minute and midnight checks run on the same tick. */
export const TV_TICK_MS = 15_000;
/** A read with no answer within this time has failed (BR7.6). */
export const TV_READ_TIMEOUT_MS = 10_000;
/** After a failure, the next try comes this much later (BR7.6). */
export const TV_RETRY_MS = 10_000;
/** A re-read at least this often, counted from when the last read started (BR7.3, R-04). */
export const TV_REFRESH_MS = 5 * 60_000;

export interface TvWallState {
  /** 'error' only while no read has ever succeeded. */
  status: 'loading' | 'ready' | 'error';
  connection: 'live' | 'reconnecting';
  /** When the last successful read arrived (this browser's clock). */
  lastUpdatedAt: Date | null;
  /** Exactly C1's body. */
  summary: TvSummary | null;
  /** The server-time estimate: server_time plus the time since that summary arrived, ticking every 15 s. */
  now: Date;
}

interface ReadBook {
  mounted: boolean;
  inFlight: boolean;
  waiting: boolean;
  /** The number of the newest read started (BR7.5). */
  newest: number;
  lastStartAt: number;
  /** Browser time when the shown summary arrived, and that summary's server time and day end. */
  receivedAt: number;
  serverTime: number;
  dayEndsAt: number;
  /** The day whose midnight re-read was already asked for, so it is asked once. */
  midnightAskedFor: string;
  connected: boolean;
  retry: ReturnType<typeof setTimeout> | null;
  timers: Set<ReturnType<typeof setTimeout>>;
  controllers: Set<AbortController>;
}

export function useTvWall(): TvWallState {
  const { events, connected } = useStaffSSE();
  const [summary, setSummary] = useState<TvSummary | null>(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);
  const [readFailing, setReadFailing] = useState(false);
  const [streamDown, setStreamDown] = useState(false);
  const [now, setNow] = useState(() => new Date());

  const bookRef = useRef<ReadBook>({
    mounted: true, inFlight: false, waiting: false, newest: 0, lastStartAt: 0, receivedAt: 0, serverTime: 0,
    dayEndsAt: Infinity, midnightAskedFor: '', connected: false, retry: null, timers: new Set(), controllers: new Set(),
  });

  // Stable read functions: they only touch the book (a ref) and state setters, which never change.
  const reader = useMemo(() => {
    const book = bookRef.current;

    const serverNow = (): number => book.serverTime + (Date.now() - book.receivedAt);

    const scheduleRetry = () => {
      if (book.retry !== null || !book.mounted) return;
      book.retry = setTimeout(() => {
        book.retry = null;
        request();
      }, TV_RETRY_MS);
    };

    const succeed = (body: TvSummary) => {
      book.receivedAt = Date.now();
      book.serverTime = Date.parse(body.server_time);
      book.dayEndsAt = Date.parse(body.day_ends_at);
      if (book.retry !== null) {
        clearTimeout(book.retry);
        book.retry = null;
      }
      setSummary(body);
      setLastUpdatedAt(new Date(book.receivedAt));
      setNow(new Date(book.serverTime));
      setReadFailing(false);
      // Reconnecting → Live only on a read that succeeds while the stream is back.
      if (book.connected) setStreamDown(false);
    };

    const start = () => {
      const number = ++book.newest;
      book.inFlight = true;
      book.lastStartAt = Date.now();
      const controller = typeof AbortController === 'function' ? new AbortController() : null;
      if (controller) book.controllers.add(controller);
      let settled = false;

      const finish = (body: TvSummary | null) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        book.timers.delete(timeout);
        if (controller) book.controllers.delete(controller);
        if (!book.mounted) return;
        book.inFlight = false;
        if (number === book.newest) {
          if (body) succeed(body);
          else {
            setReadFailing(true);
            scheduleRetry();
          }
        }
        if (book.waiting) {
          book.waiting = false;
          start();
        }
      };

      const timeout = setTimeout(() => {
        controller?.abort();
        finish(null);
      }, TV_READ_TIMEOUT_MS);
      book.timers.add(timeout);

      staffFetch(TV_SUMMARY_URL, controller ? { signal: controller.signal } : undefined)
        .then(async (res) => {
          if (!res.ok) throw new Error(`${TV_SUMMARY_URL} answered ${res.status}`);
          finish((await res.json()) as TvSummary);
        })
        .catch((err: unknown) => {
          // A failed read is shown on the wall (Reconnecting or Error) and retried; it is never silent.
          if (!settled) console.warn('TV wall read failed:', err instanceof Error ? err.message : err);
          finish(null);
        });
    };

    /** BR7.2: start a read, or mark one as waiting when a read is in flight; more requests are dropped. */
    function request(): void {
      if (!book.mounted) return;
      if (book.inFlight) {
        book.waiting = true;
        return;
      }
      start();
    }

    /** The 15-second tick (BR7.7) with the midnight (BR7.4) and 5-minute (BR7.3) checks. */
    const tick = (day: string | undefined) => {
      if (book.receivedAt > 0) {
        const estimate = serverNow();
        setNow(new Date(estimate));
        if (day && estimate >= book.dayEndsAt && book.midnightAskedFor !== day) {
          book.midnightAskedFor = day;
          request();
          return;
        }
      }
      if (book.lastStartAt > 0 && Date.now() - book.lastStartAt >= TV_REFRESH_MS) request();
    };

    return { request, tick };
  }, []);

  // Mount: the first read. Unmount: stop every timer and abandon reads in flight.
  useEffect(() => {
    const book = bookRef.current;
    book.mounted = true;
    reader.request();
    return () => {
      book.mounted = false;
      if (book.retry !== null) clearTimeout(book.retry);
      for (const t of book.timers) clearTimeout(t);
      for (const c of book.controllers) c.abort();
      book.timers.clear();
      book.controllers.clear();
    };
  }, [reader]);

  // BR7.1: every relevant event in the list since the last look (not only the newest), one request for them all.
  const processedSeqRef = useRef(0);
  useEffect(() => {
    let relevant = false;
    for (const ev of events) {
      const seq = ev.seq ?? 0;
      if (seq <= processedSeqRef.current) continue;
      processedSeqRef.current = seq;
      if (TV_REFRESH_EVENTS.includes(ev.type)) relevant = true;
    }
    if (relevant) reader.request();
  }, [events, reader]);

  // Every (re)connect asks for a read; a drop after being connected shows Reconnecting (BR7.1, BR7.6).
  const wasConnectedRef = useRef(false);
  useEffect(() => {
    bookRef.current.connected = connected;
    if (connected && !wasConnectedRef.current) reader.request();
    if (!connected && wasConnectedRef.current) setStreamDown(true);
    wasConnectedRef.current = connected;
  }, [connected, reader]);

  const day = summary?.day;
  useEffect(() => {
    const timer = setInterval(() => reader.tick(day), TV_TICK_MS);
    return () => clearInterval(timer);
  }, [reader, day]);

  return {
    status: summary ? 'ready' : readFailing ? 'error' : 'loading',
    connection: readFailing || streamDown ? 'reconnecting' : 'live',
    lastUpdatedAt,
    summary,
    now,
  };
}
