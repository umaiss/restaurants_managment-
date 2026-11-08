/**
 * Chef's special routes (U5 Step 9). BR5.1 (launch), BR5.2 (current), BR5.5 (SPECIAL_CHANGED),
 * BR1.5 (launch and end need a staff session; reading the current special is open), BR9.1 (write, then publish).
 */
import { Router } from 'express';
import { sendIfAppError, sendInternalError } from '../errors.js';
import { endCurrentSpecial, getCurrentSpecial, launchSpecial, type LaunchInput } from '../repositories/specialsRepo.js';
import { publishSpecialChanged } from '../menuEvents.js';
import { requireStaff } from '../staffAccess.js';

const router = Router();

// GET /api/specials/current — open to everyone
router.get('/specials/current', (_req, res) => {
  try {
    res.json({ special: getCurrentSpecial() });
  } catch (err) {
    sendInternalError(res, 'GET /api/specials/current', err);
  }
});

// POST /api/specials — launch; ends the current one
router.post('/specials', requireStaff(), (req, res) => {
  try {
    const special = launchSpecial((req.body ?? {}) as LaunchInput);
    publishSpecialChanged(special);
    res.status(201).json(special);
  } catch (err) {
    if (sendIfAppError(res, err)) return;
    sendInternalError(res, 'POST /api/specials', err);
  }
});

// DELETE /api/specials/current — end it now (ending when there is none is harmless: 204)
router.delete('/specials/current', requireStaff(), (_req, res) => {
  try {
    if (endCurrentSpecial()) publishSpecialChanged(null);
    res.status(204).end();
  } catch (err) {
    sendInternalError(res, 'DELETE /api/specials/current', err);
  }
});

export default router;
