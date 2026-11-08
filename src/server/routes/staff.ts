/**
 * Staff sign-in and the guard on everything under /api/staff (U5 Step 9).
 * Implements BR1.2 (login sets the session cookie), BR1.5 (guard), BR14.4 (logout and session routes).
 */
import { Router } from 'express';
import { AppError, sendApiError, sendIfAppError, sendInternalError } from '../errors.js';
import {
  clearedSessionCookie,
  clientAddress,
  getStaffToken,
  isSessionValid,
  requireStaff,
  sessionCookie,
  signIn,
  signOut,
} from '../staffAccess.js';

const router = Router();

// POST /api/staff/login — open to everyone; wrong tries are counted per client address (BR1.4)
router.post('/staff/login', (req, res) => {
  const body = (req.body ?? {}) as { pin?: unknown };
  try {
    const token = signIn(clientAddress(req), body.pin);
    res.setHeader('Set-Cookie', sessionCookie(token));
    res.status(204).end();
  } catch (err) {
    if (err instanceof AppError && err.code === 'LOCKED' && typeof err.details?.retry_after_seconds === 'number') {
      res.setHeader('Retry-After', String(err.details.retry_after_seconds));
    }
    if (sendIfAppError(res, err)) return;
    sendInternalError(res, 'POST /api/staff/login', err);
  }
});

// POST /api/staff/logout — ends the session, clears the cookie and closes the session's open streams.
// It sits before the guard so that a session that has already ended is still answered 401 (contract 2)
// AND the old cookie is cleared, so the browser does not keep sending a dead session (code review, Minor).
router.post('/staff/logout', (req, res) => {
  const token = getStaffToken(req);
  const wasValid = isSessionValid(token);
  signOut(token);
  res.setHeader('Set-Cookie', clearedSessionCookie());
  if (!wasValid) {
    sendApiError(res, 401, 'UNAUTHORIZED', 'Staff sign-in is required.');
    return;
  }
  res.status(204).end();
});

// Everything else under /api/staff needs a staff session (BR1.5). This guard is mounted here, before
// U7's route modules, so a U7 route can never be reached without a session, stub or not (BR14.1).
router.use('/staff', requireStaff());

// GET /api/staff/session — the shell asks this before it shows any staff page (BR1.8)
router.get('/staff/session', (_req, res) => {
  res.json({ signed_in: true });
});

export default router;
