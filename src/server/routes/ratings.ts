/**
 * Rating route (U5 Step 9). BR7.1 and BR7.2: the checks and their order live in ratingRepo.
 * Open to everyone (a diner rates after the table is closed).
 */
import { Router } from 'express';
import { sendApiError, sendIfAppError, sendInternalError } from '../errors.js';
import { saveRatings } from '../repositories/ratingRepo.js';
import { tableExists } from '../repositories/tableRepo.js';
import { parseTableId, unknownTable } from './tableId.js';

const router = Router();

// POST /api/tables/:id/ratings
router.post('/tables/:id/ratings', (req, res) => {
  const tableId = parseTableId(req.params.id);
  if (tableId === null || !tableExists(tableId)) {
    unknownTable(res, req.params.id);
    return;
  }
  const body = (req.body ?? {}) as { visit_id?: unknown; done?: unknown; ratings?: unknown };
  if (typeof body.visit_id !== 'string' || body.visit_id === '') {
    sendApiError(res, 400, 'INVALID_REQUEST', 'visit_id is required and must be a string', { field: 'visit_id' });
    return;
  }
  if (body.done !== undefined && typeof body.done !== 'boolean') {
    sendApiError(res, 400, 'INVALID_REQUEST', 'done must be true or false', { field: 'done' });
    return;
  }
  try {
    res.json(saveRatings(tableId, body.visit_id, body.ratings, body.done === true));
  } catch (err) {
    if (sendIfAppError(res, err)) return;
    sendInternalError(res, 'POST /api/tables/:id/ratings', err);
  }
});

export default router;
