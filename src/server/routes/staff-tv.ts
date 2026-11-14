/**
 * The TV wall's routes (U8, contracts C1, C2 and the new C3 event). Mounted after the staff module in the route
 * registry, so U5's guard answers 401 to any request without a staff session before these run (BR6.1), and
 * refreshes the session's idle time on every guarded read (BR6.2).
 * Rules: BR1.2 (only a boolean, in a body with exactly that one field), BR1.3 (saved first, then announced,
 * and only when the value changed).
 */
import { Router } from 'express';
import { sendApiError, sendInternalError } from '../errors.js';
import { publish } from '../sse.js';
import { getTvSettings, setShowTakings } from '../tvSettings.js';
import { buildTvSummary } from '../tvWallSummary.js';

const router = Router();

/** The new live event of C3, on the staff channel. */
export const TV_SETTINGS_CHANGED = 'TV_SETTINGS_CHANGED';

/** BR1.2: an object (not an array or null) with exactly one field, show_takings, holding true or false. */
function readShowTakings(body: unknown): { ok: true; value: boolean } | { ok: false; message: string } {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return { ok: false, message: 'The body must be an object with show_takings.' };
  }
  const keys = Object.keys(body);
  if (!keys.includes('show_takings')) return { ok: false, message: 'show_takings is required.' };
  if (keys.length !== 1) return { ok: false, message: 'Only show_takings may be sent.' };
  const value = (body as { show_takings: unknown }).show_takings;
  if (typeof value !== 'boolean') return { ok: false, message: 'show_takings must be true or false.' };
  return { ok: true, value };
}

// GET /api/staff/tv/summary — everything the TV wall shows (C1)
router.get('/staff/tv/summary', (_req, res) => {
  try {
    res.json(buildTvSummary());
  } catch (err) {
    sendInternalError(res, 'GET /api/staff/tv/summary', err); // logged; nothing partial is sent
  }
});

// GET /api/staff/tv/settings — the show-takings setting (C2)
router.get('/staff/tv/settings', (_req, res) => {
  try {
    res.json(getTvSettings());
  } catch (err) {
    sendInternalError(res, 'GET /api/staff/tv/settings', err);
  }
});

// PUT /api/staff/tv/settings — change the setting (C2); TV_SETTINGS_CHANGED follows a saved change (C3)
router.put('/staff/tv/settings', (req, res) => {
  const read = readShowTakings(req.body);
  if (!read.ok) {
    sendApiError(res, 400, 'INVALID_REQUEST', read.message, { field: 'show_takings' });
    return;
  }
  let result: ReturnType<typeof setShowTakings>;
  try {
    result = setShowTakings(read.value);
  } catch (err) {
    sendInternalError(res, 'PUT /api/staff/tv/settings', err); // a failed save publishes nothing
    return;
  }
  if (result.changed) {
    publish('staff', TV_SETTINGS_CHANGED, { show_takings: result.settings.show_takings, updated_at: result.settings.updated_at });
  }
  res.json(result.settings);
});

export default router;
