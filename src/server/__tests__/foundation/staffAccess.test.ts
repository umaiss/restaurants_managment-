// U5 Step 8: StaffAccess (BR1.1 to BR1.5).
process.env.DB_FILE = ':memory:';

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { Request, Response } from 'express';
import {
  signIn,
  signOut,
  isSessionValid,
  touchSession,
  sweepSessions,
  readCookie,
  sessionCookie,
  clearedSessionCookie,
  requireStaff,
  resetStaffAccessForTest,
  _staffAccessSizes,
} from '../../staffAccess.js';
import { STAFF_IDLE_MS, LOCKOUT_MS, LOGIN_ATTEMPT_MAX_ADDRESSES } from '../../config.js';

const PIN = '4242';
const WRONG = '0000';
const T0 = 1_800_000_000_000;

function attempt(address: string, pin: unknown, now = T0) {
  try {
    return { token: signIn(address, pin, now) };
  } catch (e) {
    return { error: e as { code: string; details?: Record<string, unknown> } };
  }
}

describe('StaffAccess', () => {
  beforeEach(() => {
    process.env.STAFF_PIN = PIN;
    resetStaffAccessForTest();
  });
  afterEach(() => {
    process.env.STAFF_PIN = PIN;
    resetStaffAccessForTest();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  describe('signing in (BR1.2)', () => {
    it('a correct PIN opens a session with a random 128-bit value', () => {
      const a = attempt('1.1.1.1', PIN).token!;
      const b = attempt('2.2.2.2', PIN).token!;
      expect(a).toMatch(/^[0-9a-f]{32}$/);
      expect(b).not.toBe(a);
      expect(isSessionValid(a, T0)).toBe(true);
    });

    it('a wrong PIN is INVALID_PIN with the tries left', () => {
      const first = attempt('1.1.1.1', WRONG).error!;
      expect(first.code).toBe('INVALID_PIN');
      expect(first.details).toEqual({ tries_left: 4 });
      expect(attempt('1.1.1.1', WRONG).error!.details).toEqual({ tries_left: 3 });
    });

    it.each([[undefined], [null], [4242], ['42'], ['42424'], ['abcd'], ['']])('a PIN that is %j never opens a session', (pin) => {
      expect(attempt('1.1.1.1', pin).error!.code).toBe('INVALID_PIN');
    });

    it('the cookie is HttpOnly, SameSite=Strict, Path=/ and has no expiry; clearing sets Max-Age=0', () => {
      const cookie = sessionCookie('abc');
      expect(cookie).toContain('staff_session=abc');
      expect(cookie).toContain('HttpOnly');
      expect(cookie).toContain('SameSite=Strict');
      expect(cookie).toContain('Path=/');
      expect(cookie).not.toMatch(/Max-Age|Expires/i);
      expect(cookie).not.toMatch(/Secure/i); // plain HTTP on the restaurant's network
      expect(clearedSessionCookie()).toContain('Max-Age=0');
    });

    it('reads one cookie out of a header and ignores a malformed one', () => {
      expect(readCookie('a=1; staff_session=xyz; b=2', 'staff_session')).toBe('xyz');
      expect(readCookie(undefined, 'staff_session')).toBeUndefined();
      expect(readCookie('staff_session=%E0%A4%A', 'staff_session')).toBeUndefined();
      expect(readCookie('other=1', 'staff_session')).toBeUndefined();
    });
  });

  describe('lockout by client address (BR1.4)', () => {
    it('five wrong tries lock the address, and then even the right PIN is refused with the time left', () => {
      for (let i = 0; i < 4; i++) expect(attempt('9.9.9.9', WRONG, T0 + i).error!.code).toBe('INVALID_PIN');
      const fifth = attempt('9.9.9.9', WRONG, T0 + 4).error!;
      expect(fifth).toMatchObject({ code: 'INVALID_PIN', details: { tries_left: 0 } });

      const locked = attempt('9.9.9.9', PIN, T0 + 10_000).error!;
      expect(locked.code).toBe('LOCKED');
      // The lock runs 60 s from the 5th try (T0+4 ms); 10 s later 50.004 s are left, rounded up to 51
      expect(locked.details).toEqual({ retry_after_seconds: 51 });
    });

    it('the lock ends after 60 seconds and the count starts again', () => {
      for (let i = 0; i < 5; i++) attempt('9.9.9.9', WRONG, T0);
      expect(attempt('9.9.9.9', PIN, T0 + LOCKOUT_MS - 1).error!.code).toBe('LOCKED');
      const after = attempt('9.9.9.9', PIN, T0 + LOCKOUT_MS);
      expect(after.token).toBeDefined();
      // After a lock, a wrong try is the first of a new count
      for (let i = 0; i < 5; i++) attempt('8.8.8.8', WRONG, T0);
      expect(attempt('8.8.8.8', WRONG, T0 + LOCKOUT_MS).error!.details).toEqual({ tries_left: 4 });
    });

    it('the lock is per address, not per cookie or session: another address is not locked, and a new "browser" on the same address still is', () => {
      for (let i = 0; i < 5; i++) attempt('9.9.9.9', WRONG, T0);
      expect(attempt('7.7.7.7', PIN, T0).token).toBeDefined(); // a different address signs in
      // Dropping the cookie changes nothing, because the server only ever looks at the address
      expect(attempt('9.9.9.9', PIN, T0 + 1).error!.code).toBe('LOCKED');
    });

    it('a correct PIN resets the count', () => {
      for (let i = 0; i < 3; i++) attempt('9.9.9.9', WRONG, T0);
      expect(attempt('9.9.9.9', PIN, T0).token).toBeDefined();
      for (let i = 0; i < 3; i++) attempt('9.9.9.9', WRONG, T0);
      // Without the reset, this would be the 7th wrong try and the address would be locked
      expect(attempt('9.9.9.9', WRONG, T0).error!.details).toEqual({ tries_left: 1 });
    });

    it('an address with no try for 10 minutes starts again from zero', () => {
      for (let i = 0; i < 4; i++) attempt('9.9.9.9', WRONG, T0);
      expect(attempt('9.9.9.9', WRONG, T0 + 11 * 60_000).error!.details).toEqual({ tries_left: 4 });
    });

    it('the memory of addresses is capped at 1,000 and the cap never lifts an active lock', () => {
      for (let i = 0; i < 5; i++) attempt('locked-one', WRONG, T0);
      for (let i = 0; i < LOGIN_ATTEMPT_MAX_ADDRESSES + 200; i++) attempt(`addr-${i}`, WRONG, T0 + 1);
      expect(_staffAccessSizes().addresses).toBeLessThanOrEqual(LOGIN_ATTEMPT_MAX_ADDRESSES);
      expect(attempt('locked-one', PIN, T0 + 2).error!.code).toBe('LOCKED');
    });

    it('when every remembered address is locked, a new address is refused (fails closed), not given free tries', () => {
      for (let i = 0; i < LOGIN_ATTEMPT_MAX_ADDRESSES; i++) {
        for (let k = 0; k < 5; k++) attempt(`a-${i}`, WRONG, T0);
      }
      expect(_staffAccessSizes().addresses).toBe(LOGIN_ATTEMPT_MAX_ADDRESSES);
      const newcomer = attempt('brand-new', PIN, T0 + 1).error!;
      expect(newcomer.code).toBe('LOCKED');
      expect(_staffAccessSizes().addresses).toBe(LOGIN_ATTEMPT_MAX_ADDRESSES);
    });
  });

  describe('sessions end (BR1.3)', () => {
    it('a session ends after 12 hours without staff action', () => {
      const token = attempt('1.1.1.1', PIN).token!;
      expect(isSessionValid(token, T0 + STAFF_IDLE_MS)).toBe(true); // exactly 12 hours: not more than 12
      expect(isSessionValid(token, T0 + STAFF_IDLE_MS + 1)).toBe(false);
      // and it is gone for good
      expect(isSessionValid(token, T0 + 1)).toBe(false);
    });

    it('a staff action refreshes the idle time, but only touching does; checking does not', () => {
      const token = attempt('1.1.1.1', PIN).token!;
      expect(touchSession(token, T0 + 11 * 3_600_000)).toBe(true);
      expect(isSessionValid(token, T0 + 20 * 3_600_000)).toBe(true); // 9 hours after the touch
      // Checking validity (what a stream does) never extends it
      const other = attempt('2.2.2.2', PIN).token!;
      isSessionValid(other, T0 + 11 * 3_600_000);
      expect(isSessionValid(other, T0 + STAFF_IDLE_MS + 1)).toBe(false);
    });

    it('sign-out ends the session', () => {
      const token = attempt('1.1.1.1', PIN).token!;
      signOut(token);
      expect(isSessionValid(token, T0)).toBe(false);
      expect(() => signOut(undefined)).not.toThrow();
    });

    it('the sweep removes idle sessions so memory stays small, and forgets old addresses', () => {
      const keep = attempt('1.1.1.1', PIN, T0 + 10 * 3_600_000).token!;
      attempt('2.2.2.2', PIN, T0);
      attempt('3.3.3.3', PIN, T0);
      attempt('4.4.4.4', WRONG, T0);
      expect(_staffAccessSizes()).toEqual({ sessions: 3, addresses: 1 });
      const removed = sweepSessions(T0 + STAFF_IDLE_MS + 1_000);
      expect(removed).toBe(2);
      expect(isSessionValid(keep, T0 + STAFF_IDLE_MS + 1_000)).toBe(true);
      expect(_staffAccessSizes()).toEqual({ sessions: 1, addresses: 0 });
    });

    it('a restart forgets every session (reset stands for a restart)', () => {
      const token = attempt('1.1.1.1', PIN).token!;
      resetStaffAccessForTest();
      expect(isSessionValid(token, T0)).toBe(false);
    });
  });

  describe('the PIN source (BR1.1)', () => {
    it('without STAFF_PIN a random 4-digit PIN is printed once and never logged again', () => {
      delete process.env.STAFF_PIN;
      resetStaffAccessForTest();
      const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
      const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);

      // Fail a few times, which must not print the PIN
      attempt('1.1.1.1', WRONG);
      attempt('1.1.1.1', '9999');
      expect(log).toHaveBeenCalledTimes(1);
      const printed = String(log.mock.calls[0][0]).match(/\b(\d{4})\b/)?.[1];
      expect(printed).toMatch(/^\d{4}$/);

      // The printed PIN really opens a session, and signing in prints nothing more
      expect(attempt('2.2.2.2', printed).token).toBeDefined();
      expect(log).toHaveBeenCalledTimes(1);
      // No other console output carries it
      for (const spy of [warn, error]) {
        for (const call of spy.mock.calls) expect(JSON.stringify(call)).not.toContain(printed!);
      }
    });

    it('a malformed STAFF_PIN is reported by name, not by value, and a random PIN is used', () => {
      process.env.STAFF_PIN = '12ab';
      resetStaffAccessForTest();
      const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
      attempt('1.1.1.1', WRONG);
      expect(warn).toHaveBeenCalledTimes(1);
      expect(String(warn.mock.calls[0][0])).toContain('STAFF_PIN');
      expect(JSON.stringify(warn.mock.calls)).not.toContain('12ab');
      expect(log).toHaveBeenCalledTimes(1); // the random PIN, once
      expect(attempt('1.1.1.1', '12ab').error!.code).toBe('INVALID_PIN');
    });

    it('STAFF_PIN from the environment is used and nothing is printed', () => {
      const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
      attempt('1.1.1.1', PIN);
      attempt('1.1.1.1', WRONG);
      expect(log).not.toHaveBeenCalled();
    });
  });

  describe('the guard (BR1.5)', () => {
    function run(cookie: string | undefined, options?: { refresh?: boolean }) {
      const req = { headers: { cookie } } as unknown as Request;
      const json = vi.fn();
      const res = { locals: {} as Record<string, unknown>, status: vi.fn().mockReturnThis(), json } as unknown as Response;
      const next = vi.fn();
      requireStaff(options)(req, res, next);
      return { res, next, json };
    }

    it('answers 401 UNAUTHORIZED in v1\'s error shape with no cookie, or a made-up one', () => {
      for (const cookie of [undefined, 'staff_session=made-up', 'other=1']) {
        const { res, next, json } = run(cookie);
        expect(next).not.toHaveBeenCalled();
        expect((res.status as ReturnType<typeof vi.fn>).mock.calls[0][0]).toBe(401);
        expect(json.mock.calls[0][0].error.code).toBe('UNAUTHORIZED');
        expect(typeof json.mock.calls[0][0].error.message).toBe('string');
      }
    });

    it('lets a valid session through and refreshes its idle time (unless it is a stream)', () => {
      vi.useFakeTimers();
      vi.setSystemTime(T0);
      const token = attempt('1.1.1.1', PIN, T0).token!;

      vi.setSystemTime(T0 + 11 * 3_600_000);
      const ok = run(`staff_session=${token}`);
      expect(ok.next).toHaveBeenCalledTimes(1);
      expect(ok.res.locals.staffToken).toBe(token);
      // Refreshed at +11h, so it lives past the original 12 hours
      vi.setSystemTime(T0 + 20 * 3_600_000);
      expect(isSessionValid(token)).toBe(true);

      // A stream check does not refresh
      const other = attempt('2.2.2.2', PIN, Date.now()).token!;
      const streamStart = Date.now();
      vi.setSystemTime(streamStart + 11 * 3_600_000);
      expect(run(`staff_session=${other}`, { refresh: false }).next).toHaveBeenCalledTimes(1);
      vi.setSystemTime(streamStart + STAFF_IDLE_MS + 1);
      expect(isSessionValid(other)).toBe(false);
    });
  });
});
