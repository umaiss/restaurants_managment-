/**
 * Service call routes (U5 Step 9). BR6.1 (open), BR6.2 (respond), BR1.5 (respond needs a staff
 * session; a table's calls are open), BR9.1 (write, then publish).
 */
import { Router } from 'express';
import { sendApiError, sendIfAppError, sendInternalError } from '../errors.js';
import { isCallKind, isPaymentMethod, listCalls, openCall, respondCall } from '../repositories/serviceCallRepo.js';
import { tableExists } from '../repositories/tableRepo.js';
import { publish } from '../sse.js';
import { requireStaff } from '../staffAccess.js';
import { parseTableId, unknownTable } from './tableId.js';

const router = Router();

// GET /api/tables/:id/calls — open and answered requests of the current visit
router.get('/tables/:id/calls', (req, res) => {
  const tableId = parseTableId(req.params.id);
  if (tableId === null) {
    unknownTable(res, req.params.id);
    return;
  }
  try {
    const calls = listCalls(tableId).map((c) => ({
      id: c.id,
      kind: c.kind,
      status: c.status,
      opened_at: c.opened_at,
      responded_at: c.responded_at,
      payment_method: c.payment_method,
      wants_receipt: c.wants_receipt,
    }));
    res.json({ calls });
  } catch (err) {
    if (sendIfAppError(res, err)) return;
    sendInternalError(res, 'GET /api/tables/:id/calls', err);
  }
});

// POST /api/tables/:id/calls — call the waiter or ask for the bill; idempotent per kind
router.post('/tables/:id/calls', (req, res) => {
  const tableId = parseTableId(req.params.id);
  if (tableId === null || !tableExists(tableId)) {
    unknownTable(res, req.params.id);
    return;
  }
  const { kind, payment_method, wants_receipt } = (req.body ?? {}) as { kind?: unknown; payment_method?: unknown; wants_receipt?: unknown };
  if (!isCallKind(kind)) {
    sendApiError(res, 400, 'INVALID_KIND', 'kind must be "waiter" or "bill"');
    return;
  }
  if (payment_method !== undefined && payment_method !== null && !isPaymentMethod(payment_method)) {
    sendApiError(res, 400, 'INVALID_PAYMENT_METHOD', 'payment_method must be "cash" or "card"');
    return;
  }
  if (wants_receipt !== undefined && typeof wants_receipt !== 'boolean') {
    sendApiError(res, 400, 'INVALID_WANTS_RECEIPT', 'wants_receipt must be true or false');
    return;
  }
  try {
    const { call, created } = openCall(tableId, kind, new Date(), { paymentMethod: payment_method ?? null, wantsReceipt: wants_receipt === true });
    if (created) {
      const payload = {
        call_id: call.id,
        table_id: tableId,
        kind: call.kind,
        opened_at: call.opened_at,
        ...(call.payment_method ? { payment_method: call.payment_method } : {}),
        ...(call.wants_receipt ? { wants_receipt: true } : {}),
      };
      publish('staff', 'SERVICE_CALL_OPENED', payload);
      publish(`table:${tableId}`, 'SERVICE_CALL_OPENED', payload);
    }
    res.status(created ? 201 : 200).json({
      id: call.id,
      kind: call.kind,
      status: call.status,
      opened_at: call.opened_at,
      payment_method: call.payment_method,
      wants_receipt: call.wants_receipt,
    });
  } catch (err) {
    if (sendIfAppError(res, err)) return;
    sendInternalError(res, 'POST /api/tables/:id/calls', err);
  }
});

// POST /api/service-calls/:id/respond — staff only; a second respond answers 200 unchanged
router.post('/service-calls/:id/respond', requireStaff(), (req, res) => {
  try {
    const { call, changed } = respondCall(req.params.id);
    if (changed) {
      const payload = {
        call_id: call.id,
        table_id: call.table_id,
        kind: call.kind,
        responded_at: call.responded_at,
      };
      publish('staff', 'SERVICE_CALL_RESPONDED', payload);
      publish(`table:${call.table_id}`, 'SERVICE_CALL_RESPONDED', payload);
    }
    res.json({ id: call.id, status: call.status });
  } catch (err) {
    if (sendIfAppError(res, err)) return;
    sendInternalError(res, 'POST /api/service-calls/:id/respond', err);
  }
});

export default router;
