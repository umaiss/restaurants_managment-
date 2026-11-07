import { Router } from 'express';
import { subscribe, sendEvent } from '../sse.js';
import { parseTableId, unknownTable } from './tableId.js';

const router = Router();

// GET /sse/staff
router.get('/staff', (req, res) => {
  subscribe('staff', res);
  // HELLO goes to this connection only, so the client can confirm connectivity.
  sendEvent(res, 'HELLO', { message: 'Connected to staff channel' });
});

// GET /sse/tables/:id
// Missed events are replayed by `subscribe` from the Last-Event-ID header or `lastEventId` query value.
router.get('/tables/:id', (req, res) => {
  // Only a plain table number opens a stream: "5abc" is refused, not read as table 5.
  const parsed = parseTableId(req.params.id);
  if (parsed === null) {
    unknownTable(res, req.params.id);
    return;
  }
  const tableId = String(parsed);
  subscribe(`table:${tableId}`, res);
  // HELLO goes to this connection only.
  sendEvent(res, 'HELLO', { message: `Connected to table ${tableId} channel` });
});

export default router;
