import { Router } from 'express';
import { subscribe, publish } from '../sse.js';

const router = Router();

// GET /sse/staff
router.get('/staff', (req, res) => {
  subscribe('staff', res);
  // Send HELLO immediately so the client can confirm connectivity
  publish('staff', 'HELLO', { message: 'Connected to staff channel' });
});

// GET /sse/tables/:id
router.get('/tables/:id', (req, res) => {
  const tableId = req.params.id;
  // Read lastEventId from query param or header for future replay support
  const _lastEventId = (req.query['lastEventId'] as string | undefined) || (req.headers['last-event-id'] as string | undefined);
  // TODO: replay missed events using lastEventId when event log is persisted
  const channel = `table:${tableId}`;
  subscribe(channel, res);
  // Send HELLO immediately
  publish(channel, 'HELLO', { message: `Connected to table ${tableId} channel` });
});

export default router;
