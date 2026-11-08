import { useCallback, useEffect, useRef, useState } from 'react';
import { onStaffUnauthorized } from './staffAuth.js';

/**
 * checking: asking the server; signedIn / signedOut; unreachable: the server did not answer.
 */
export type StaffSessionState = 'checking' | 'signedIn' | 'signedOut' | 'unreachable';

export type SignInResult =
  | { ok: true }
  | { ok: false; code: 'INVALID_PIN'; triesLeft: number }
  | { ok: false; code: 'LOCKED'; retryAfterSeconds: number }
  | { ok: false; code: 'ERROR' };

/**
 * The staff session (BR1.7, BR1.8). It asks the server whether the browser is signed in before any staff
 * page shows; IF yes the page shows, IF no only the PIN screen. A 401 from any staff request, or a staff
 * stream that failed while the check also answers 401, returns the screen to the PIN screen.
 */
export function useStaffSession(): {
  state: StaffSessionState;
  signIn: (pin: string) => Promise<SignInResult>;
  signOut: () => Promise<void>;
  recheck: () => Promise<void>;
} {
  const [state, setState] = useState<StaffSessionState>('checking');
  const aliveRef = useRef(true);

  const recheck = useCallback(async () => {
    try {
      const res = await fetch('/api/staff/session');
      if (!aliveRef.current) return;
      setState(res.ok ? 'signedIn' : res.status === 401 ? 'signedOut' : 'unreachable');
    } catch {
      if (aliveRef.current) setState('unreachable');
    }
  }, []);

  useEffect(() => {
    aliveRef.current = true;
    void recheck();
    const stop = onStaffUnauthorized(() => {
      if (aliveRef.current) setState('signedOut');
    });
    return () => {
      aliveRef.current = false;
      stop();
    };
  }, [recheck]);

  const signIn = useCallback(async (pin: string): Promise<SignInResult> => {
    try {
      const res = await fetch('/api/staff/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin }),
      });
      if (res.status === 204 || res.ok) {
        if (aliveRef.current) setState('signedIn');
        return { ok: true };
      }
      const body = (await res.json().catch(() => null)) as {
        error?: { code?: string; details?: { tries_left?: number; retry_after_seconds?: number } };
      } | null;
      if (res.status === 429 || body?.error?.code === 'LOCKED') {
        return { ok: false, code: 'LOCKED', retryAfterSeconds: body?.error?.details?.retry_after_seconds ?? 60 };
      }
      if (res.status === 401) {
        return { ok: false, code: 'INVALID_PIN', triesLeft: body?.error?.details?.tries_left ?? 0 };
      }
      return { ok: false, code: 'ERROR' };
    } catch {
      return { ok: false, code: 'ERROR' };
    }
  }, []);

  const signOut = useCallback(async () => {
    try {
      await fetch('/api/staff/logout', { method: 'POST' });
    } catch {
      // The server could not be told; the screen still returns to the PIN screen, and the session ends on its own.
    }
    if (aliveRef.current) setState('signedOut');
  }, []);

  return { state, signIn, signOut, recheck };
}
