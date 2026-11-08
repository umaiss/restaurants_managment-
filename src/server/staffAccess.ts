/**
 * StaffAccess (U5 Step 7): the staff PIN, sessions and the guard on staff routes.
 * Implements BR1.1 (PIN from the environment, never written in code or logs), BR1.2 (session cookie),
 * BR1.3 (12-hour idle end), BR1.4 (lockout by client address), BR1.5 (guard), BR1.9 (streams end with
 * their session).
 *
 * The cookie is read and written by a few lines of our own, so no package is added.
 */
import crypto from 'crypto';
import type { NextFunction, Request, Response } from 'express';
import { AppError, sendApiError } from './errors.js';
import {
  LOCKOUT_MAX_TRIES,
  LOCKOUT_MS,
  LOGIN_ATTEMPT_EXPIRY_MS,
  LOGIN_ATTEMPT_MAX_ADDRESSES,
  STAFF_IDLE_MS,
  STAFF_SWEEP_MS,
  getStaffPinSetting,
} from './config.js';
import { closeStreamsForSession, setSessionValidator } from './sse.js';

export const SESSION_COOKIE = 'staff_session';

interface Session {
  createdAt: number;
  lastActionAt: number;
}
interface LoginAttempt {
  failures: number;
  lockedUntil: number;
  lastTryAt: number;
}

const sessions = new Map<string, Session>();
const attempts = new Map<string, LoginAttempt>();
let resolvedPin: string | null = null;
let sweepTimer: ReturnType<typeof setInterval> | null = null;

// ---------------------------------------------------------------- the PIN (BR1.1)

/**
 * The staff PIN: STAFF_PIN when it holds 4 digits, otherwise a random 4-digit PIN printed once on the
 * console. A malformed STAFF_PIN is reported by setting name only, never by value. The PIN is held in
 * memory, never logged again and never sent to the browser.
 */
function getPin(): string {
  if (resolvedPin !== null) return resolvedPin;
  const setting = getStaffPinSetting();
  if (setting !== undefined && /^\d{4}$/.test(setting)) {
    resolvedPin = setting;
    return resolvedPin;
  }
  if (setting !== undefined && setting !== '') {
    console.warn('STAFF_PIN is not a 4-digit value; a random staff PIN is used instead.');
  }
  resolvedPin = String(crypto.randomInt(0, 10000)).padStart(4, '0');
  // The one place the PIN is printed: the owner has to learn it somehow when STAFF_PIN is not set.
  console.log(`Staff PIN (STAFF_PIN is not set): ${resolvedPin}`);
  return resolvedPin;
}

/** Resolves the PIN now, so a random one is printed at start-up and not at the first sign-in. */
export function initStaffAccess(): void {
  getPin();
}

/** Compares in constant time: both sides are hashed to the same length first. */
function pinMatches(candidate: unknown): boolean {
  const expected = crypto.createHash('sha256').update(getPin()).digest();
  const given = crypto.createHash('sha256').update(typeof candidate === 'string' ? candidate : '').digest();
  const equal = crypto.timingSafeEqual(expected, given);
  // A value that is not 4 digits can never match, whatever the hash comparison says.
  return equal && typeof candidate === 'string' && /^\d{4}$/.test(candidate);
}

// ---------------------------------------------------------------- lockout (BR1.4)

function purgeAttempts(now: number): void {
  for (const [address, a] of attempts) {
    if (now - a.lastTryAt > LOGIN_ATTEMPT_EXPIRY_MS && a.lockedUntil <= now) attempts.delete(address);
  }
}

/** Makes room for a new address without ever lifting an active lock. Returns false when every entry is locked. */
function makeRoom(now: number): boolean {
  if (attempts.size < LOGIN_ATTEMPT_MAX_ADDRESSES) return true;
  purgeAttempts(now);
  if (attempts.size < LOGIN_ATTEMPT_MAX_ADDRESSES) return true;
  // Drop the unlocked address with the oldest try first.
  let oldest: string | null = null;
  let oldestAt = Infinity;
  for (const [address, a] of attempts) {
    if (a.lockedUntil <= now && a.lastTryAt < oldestAt) {
      oldest = address;
      oldestAt = a.lastTryAt;
    }
  }
  if (oldest === null) return false;
  attempts.delete(oldest);
  return true;
}

/**
 * Opens a staff session for a correct PIN. Wrong tries are counted per client address (never per
 * cookie); five in a row lock that address for 60 seconds, and even a correct PIN is then refused.
 * Throws AppError LOCKED (details.retry_after_seconds) or INVALID_PIN (details.tries_left).
 */
export function signIn(address: string, pin: unknown, now: number = Date.now()): string {
  let entry = attempts.get(address);

  if (entry && entry.lockedUntil > now) {
    throw new AppError('LOCKED', 'Too many wrong tries. Try again later.', {
      retry_after_seconds: Math.ceil((entry.lockedUntil - now) / 1000),
    });
  }
  if (entry && entry.lockedUntil !== 0 && entry.lockedUntil <= now) {
    // The lock has run out: start counting again.
    entry.failures = 0;
    entry.lockedUntil = 0;
  }
  if (entry && now - entry.lastTryAt > LOGIN_ATTEMPT_EXPIRY_MS) {
    entry.failures = 0;
  }

  if (!entry) {
    if (!makeRoom(now)) {
      // Every remembered address is locked: fail closed rather than give this one unlimited tries.
      throw new AppError('LOCKED', 'Too many wrong tries. Try again later.', {
        retry_after_seconds: Math.ceil(LOCKOUT_MS / 1000),
      });
    }
    entry = { failures: 0, lockedUntil: 0, lastTryAt: now };
    attempts.set(address, entry);
  }
  entry.lastTryAt = now;

  if (pinMatches(pin)) {
    attempts.delete(address); // a correct PIN resets the count
    return createSession(now);
  }

  entry.failures += 1;
  if (entry.failures >= LOCKOUT_MAX_TRIES) {
    entry.lockedUntil = now + LOCKOUT_MS;
  }
  throw new AppError('INVALID_PIN', 'That PIN is not right.', {
    tries_left: Math.max(0, LOCKOUT_MAX_TRIES - entry.failures),
  });
}

// ---------------------------------------------------------------- sessions (BR1.2, BR1.3)

function createSession(now: number): string {
  const token = crypto.randomBytes(16).toString('hex'); // 128 bits
  sessions.set(token, { createdAt: now, lastActionAt: now });
  return token;
}

/** True while the session exists and has not been idle for 12 hours. Never refreshes it (BR1.9). */
export function isSessionValid(token: string | undefined, now: number = Date.now()): boolean {
  if (!token) return false;
  const session = sessions.get(token);
  if (!session) return false;
  if (now - session.lastActionAt > STAFF_IDLE_MS) {
    endSession(token);
    return false;
  }
  return true;
}

/** A staff request with a valid session refreshes its last-action time (BR1.3). */
export function touchSession(token: string | undefined, now: number = Date.now()): boolean {
  if (!isSessionValid(token, now)) return false;
  sessions.get(token as string)!.lastActionAt = now;
  return true;
}

function endSession(token: string): void {
  sessions.delete(token);
  closeStreamsForSession(token);
}

/** Sign-out: removes the session and closes its open staff streams at once (BR1.9). */
export function signOut(token: string | undefined): void {
  if (token) endSession(token);
}

/** Removes sessions that have been idle too long, and closes their streams. Returns how many. */
export function sweepSessions(now: number = Date.now()): number {
  let removed = 0;
  for (const [token, s] of [...sessions]) {
    if (now - s.lastActionAt > STAFF_IDLE_MS) {
      endSession(token);
      removed++;
    }
  }
  purgeAttempts(now);
  return removed;
}

/** Starts the 10-minute sweep; the timer never keeps the process alive. */
export function startStaffSweep(): void {
  if (sweepTimer !== null) return;
  sweepTimer = setInterval(() => sweepSessions(), STAFF_SWEEP_MS);
  sweepTimer.unref?.();
}

export function stopStaffSweep(): void {
  if (sweepTimer !== null) {
    clearInterval(sweepTimer);
    sweepTimer = null;
  }
}

// ---------------------------------------------------------------- cookie and guard (BR1.2, BR1.5)

/** Reads one cookie from a Cookie header. */
export function readCookie(header: string | undefined, name: string): string | undefined {
  if (!header) return undefined;
  for (const part of header.split(';')) {
    const index = part.indexOf('=');
    if (index === -1) continue;
    if (part.slice(0, index).trim() === name) {
      const value = part.slice(index + 1).trim();
      try {
        return decodeURIComponent(value);
      } catch {
        return undefined;
      }
    }
  }
  return undefined;
}

export function getStaffToken(req: Request): string | undefined {
  return readCookie(req.headers.cookie, SESSION_COOKIE);
}

/**
 * HttpOnly (page scripts cannot read it), SameSite=Strict, Path=/ and no expiry date, so it ends when
 * the browser closes. Not marked Secure: the app runs on plain HTTP on the restaurant's network.
 */
export function sessionCookie(token: string): string {
  return `${SESSION_COOKIE}=${token}; HttpOnly; SameSite=Strict; Path=/`;
}

export function clearedSessionCookie(): string {
  return `${SESSION_COOKIE}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT`;
}

/** The client address as the server sees it: the connection's address, never a header the client sets. */
export function clientAddress(req: Request): string {
  return req.socket?.remoteAddress ?? 'unknown';
}

/**
 * The guard on every staff route and the staff stream (BR1.5): 401 UNAUTHORIZED in v1's error shape
 * and nothing changes. `refresh: false` (used by the stream) leaves the idle time alone (BR1.9).
 */
export function requireStaff(options: { refresh?: boolean } = {}) {
  const refresh = options.refresh !== false;
  return (req: Request, res: Response, next: NextFunction): void => {
    const token = getStaffToken(req);
    const ok = refresh ? touchSession(token) : isSessionValid(token);
    if (!ok) {
      sendApiError(res, 401, 'UNAUTHORIZED', 'Staff sign-in is required.');
      return;
    }
    res.locals.staffToken = token;
    next();
  };
}

// A staff stream asks StaffAccess whether its session is still valid at every keep-alive (BR1.9).
setSessionValidator((token) => isSessionValid(token));

/** TEST ONLY (BR1.4): forgets every session, every lockout count and the resolved PIN. No route reaches it. */
export function resetStaffAccessForTest(): void {
  sessions.clear();
  attempts.clear();
  resolvedPin = null;
  stopStaffSweep();
}

/**
 * TEST ONLY (BR1.4): forgets every lockout count but keeps sessions, so parallel test files that share
 * one client address (the test machine's own) never lock each other out. No route reaches it.
 */
export function resetLoginAttemptsForTest(): void {
  attempts.clear();
}

/** TEST ONLY: sizes for assertions about the caps and the purge. */
export function _staffAccessSizes(): { sessions: number; addresses: number } {
  return { sessions: sessions.size, addresses: attempts.size };
}
