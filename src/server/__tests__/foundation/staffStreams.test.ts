// U5 Step 8: a staff stream ends with its session (BR1.9).
process.env.DB_FILE = ':memory:';

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { Response } from 'express';
import { subscribe, publish, closeStreamsForSession, _resetForTest, KEEP_ALIVE_INTERVAL_MS } from '../../sse.js';
import { signIn, signOut, resetStaffAccessForTest, touchSession } from '../../staffAccess.js';
import { STAFF_IDLE_MS } from '../../config.js';

function mockRes() {
  const closeCallbacks: Array<() => void> = [];
  const res = {
    req: { headers: {} },
    write: vi.fn(),
    end: vi.fn(() => closeCallbacks.forEach((cb) => cb())),
    setHeader: vi.fn(),
    flushHeaders: vi.fn(),
    on: vi.fn((event: string, cb: () => void) => {
      if (event === 'close') closeCallbacks.push(cb);
    }),
  };
  return res as unknown as Response & typeof res;
}
const keepAlives = (res: { write: ReturnType<typeof vi.fn> }) => res.write.mock.calls.filter((c) => c[0] === ': keep-alive\n\n').length;
const T0 = Date.parse('2026-11-08T08:00:00.000Z');

describe('staff streams and sessions', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(T0);
    process.env.STAFF_PIN = '4242';
    resetStaffAccessForTest();
    _resetForTest();
  });
  afterEach(() => {
    resetStaffAccessForTest();
    _resetForTest();
    vi.useRealTimers();
  });

  it('sign-out closes that session\'s streams at once and leaves other sessions\' and tables\' streams open', () => {
    const mine = signIn('1.1.1.1', '4242');
    const theirs = signIn('2.2.2.2', '4242');
    const a = mockRes();
    const b = mockRes();
    const other = mockRes();
    const table = mockRes();
    subscribe('staff', a, { sessionToken: mine });
    subscribe('staff', b, { sessionToken: mine }); // a second tab of the same session
    subscribe('staff', other, { sessionToken: theirs });
    subscribe('table:1', table);

    signOut(mine);

    expect(a.end).toHaveBeenCalledTimes(1);
    expect(b.end).toHaveBeenCalledTimes(1);
    expect(other.end).not.toHaveBeenCalled();
    expect(table.end).not.toHaveBeenCalled();

    // A closed stream gets no more events; the others still do
    a.write.mockClear();
    other.write.mockClear();
    publish('staff', 'ORDER_PLACED', { n: 1 });
    expect(a.write).not.toHaveBeenCalled();
    expect(other.write).toHaveBeenCalled();
  });

  it('closeStreamsForSession reports how many it closed', () => {
    const token = signIn('1.1.1.1', '4242');
    subscribe('staff', mockRes(), { sessionToken: token });
    subscribe('staff', mockRes(), { sessionToken: token });
    expect(closeStreamsForSession(token)).toBe(2);
    expect(closeStreamsForSession(token)).toBe(0);
  });

  it('the keep-alive closes a stream whose session is gone, and keeps one whose session is alive', () => {
    const alive = signIn('1.1.1.1', '4242');
    const gone = signIn('2.2.2.2', '4242');
    const aliveRes = mockRes();
    const goneRes = mockRes();
    subscribe('staff', aliveRes, { sessionToken: alive });
    subscribe('staff', goneRes, { sessionToken: gone });

    resetStaffAccessForTest(); // a restart forgets every session... then only `alive` signs in again
    // Re-create a session with the same token is impossible, so model "alive" with a fresh stream:
    const fresh = signIn('3.3.3.3', '4242');
    const freshRes = mockRes();
    subscribe('staff', freshRes, { sessionToken: fresh });

    vi.advanceTimersByTime(KEEP_ALIVE_INTERVAL_MS);

    expect(aliveRes.end).toHaveBeenCalledTimes(1); // its session went with the "restart"
    expect(goneRes.end).toHaveBeenCalledTimes(1);
    expect(keepAlives(goneRes)).toBe(0);
    expect(freshRes.end).not.toHaveBeenCalled();
    expect(keepAlives(freshRes)).toBe(1);
  });

  it('a stream never outlives its session by more than one keep-alive: the 12-hour idle end closes it', () => {
    const token = signIn('1.1.1.1', '4242');
    const res = mockRes();
    subscribe('staff', res, { sessionToken: token });

    // The stream is quiet but alive for almost 12 hours: keep-alives do not count as staff action
    vi.setSystemTime(T0 + STAFF_IDLE_MS);
    vi.advanceTimersByTime(KEEP_ALIVE_INTERVAL_MS); // now 12 h + 20 s after the last action
    expect(res.end).toHaveBeenCalledTimes(1);
  });

  it('regression: a stream closed because its session ended is ended exactly once and then forgotten', () => {
    const token = signIn('1.1.1.1', '4242');
    const res = mockRes();
    subscribe('staff', res, { sessionToken: token });
    vi.setSystemTime(T0 + STAFF_IDLE_MS + 1);
    vi.advanceTimersByTime(KEEP_ALIVE_INTERVAL_MS);
    vi.advanceTimersByTime(KEEP_ALIVE_INTERVAL_MS);
    expect(res.end).toHaveBeenCalledTimes(1);
    res.write.mockClear();
    publish('staff', 'ORDER_PLACED', { n: 1 });
    expect(res.write).not.toHaveBeenCalled();
  });

  it('keep-alives do not refresh the idle time, but a real staff action does', () => {
    const token = signIn('1.1.1.1', '4242');
    const res = mockRes();
    subscribe('staff', res, { sessionToken: token });

    vi.setSystemTime(T0 + 11 * 3_600_000);
    vi.advanceTimersByTime(KEEP_ALIVE_INTERVAL_MS);
    expect(res.end).not.toHaveBeenCalled();
    expect(touchSession(token)).toBe(true); // a staff request at 11 h

    vi.setSystemTime(T0 + 20 * 3_600_000); // 9 h after that action
    vi.advanceTimersByTime(KEEP_ALIVE_INTERVAL_MS);
    expect(res.end).not.toHaveBeenCalled();
  });

  it('a stream with no session token (a table stream, or v1\'s own tests) is never checked', () => {
    const res = mockRes();
    subscribe('staff', res);
    vi.advanceTimersByTime(KEEP_ALIVE_INTERVAL_MS * 3);
    expect(res.end).not.toHaveBeenCalled();
    expect(keepAlives(res)).toBe(3);
  });
});
