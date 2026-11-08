/**
 * Presence heartbeat route (U5 Step 9). BR8.1: a diner page sends its page id when it opens and about
 * every 60 seconds. The route is open to everyone, so it is bounded: a page id that does not match the
 * allowed form is refused, and the number of remembered pages is capped in presence.ts (BR8.2).
 */
import { Router } from 'express';
import { sendApiError } from '../errors.js';
import { PAGE_ID_PATTERN, heartbeat } from '../presence.js';
import { tableExists } from '../repositories/tableRepo.js';
import { parseTableId, unknownTable } from './tableId.js';

const router = Router();

// POST /api/tables/:id/presence
router.post('/tables/:id/presence', (req, res) => {
  const tableId = parseTableId(req.params.id);
  if (tableId === null || !tableExists(tableId)) {
    unknownTable(res, req.params.id);
    return;
  }
  const { page_id } = (req.body ?? {}) as { page_id?: unknown };
  if (typeof page_id !== 'string' || !PAGE_ID_PATTERN.test(page_id)) {
    sendApiError(res, 400, 'INVALID_REQUEST', 'page_id must be 8 to 64 letters, digits or hyphens', { field: 'page_id' });
    return;
  }
  heartbeat(tableId, page_id);
  res.status(204).end();
});

export default router;
