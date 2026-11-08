/**
 * Live event streams (v1, extended by U5 Step 9).
 * BR1.5 and BR1.9 (the staff stream needs a staff session and ends with it), BR8.1 and BR8.2 (a table
 * stream carries an optional page id and counts as an open diner page).
 */
import crypto from 'crypto';
import { Router } from 'express';
import { subscribe, sendEvent } from '../sse.js';
import { sendApiError } from '../errors.js';
import { PAGE_ID_PATTERN, pageConnected, pageDisconnected } from '../presence.js';
import { tableExists } from '../repositories/tableRepo.js';
import { requireStaff } from '../staffAccess.js';
import { parseTableId, unknownTable } from './tableId.js';

const router = Router();

// GET /sse/staff — needs a staff session. Opening the stream does not count as staff action (BR1.9).
router.get('/staff', requireStaff({ refresh: false }), (req, res) => {
  subscribe('staff', res, { sessionToken: res.locals.staffToken as string });
  // HELLO goes to this connection only, so the client can confirm connectivity.
  sendEvent(res, 'HELLO', { message: 'Connected to staff channel' });
});

// GET /sse/tables/:id[?page=<page_id>]
// Missed events are replayed by `subscribe` from the Last-Event-ID header or `lastEventId` query value.
router.get('/tables/:id', (req, res) => {
  // Only a plain table number opens a stream: "5abc" is refused, not read as table 5.
  const parsed = parseTableId(req.params.id);
  if (parsed === null) {
    unknownTable(res, req.params.id);
    return;
  }
  const tableId = String(parsed);

  // BR8.1: an optional page id; a stream opened without one (an older client) gets one for as long as it lasts.
  const pageParam = req.query.page;
  if (pageParam !== undefined && (typeof pageParam !== 'string' || !PAGE_ID_PATTERN.test(pageParam))) {
    sendApiError(res, 400, 'INVALID_REQUEST', 'page must be 8 to 64 letters, digits or hyphens', { field: 'page' });
    return;
  }
  const pageId = typeof pageParam === 'string' ? pageParam : `auto-${crypto.randomUUID()}`;

  subscribe(`table:${tableId}`, res);
  // HELLO goes to this connection only.
  sendEvent(res, 'HELLO', { message: `Connected to table ${tableId} channel` });

  // Only a table that exists is tracked, so a stream to a made-up table number cannot fill the memory.
  if (tableExists(parsed)) {
    pageConnected(parsed, pageId);
    res.on('close', () => pageDisconnected(parsed, pageId));
  }
});

export default router;
