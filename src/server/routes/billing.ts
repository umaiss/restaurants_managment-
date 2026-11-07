import { Router } from 'express';
import { buildBill, closeTable, BillingError } from '../repositories/billingRepo.js';
import { publish } from '../sse.js';
import { parseTableId, unknownTable } from './tableId.js';

const router = Router();

// GET /api/tables/:id/bill
router.get('/tables/:id/bill', (req, res) => {
  const tableId = parseTableId(req.params.id);
  if (tableId === null) {
    unknownTable(res, req.params.id);
    return;
  }
  try {
    res.json(buildBill(tableId));
  } catch (err) {
    if (err instanceof BillingError && err.code === 'UNKNOWN_TABLE') {
      unknownTable(res, req.params.id);
      return;
    }
    console.error('GET /api/tables/:id/bill error:', err);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } });
  }
});

// POST /api/tables/:id/close
router.post('/tables/:id/close', (req, res) => {
  const tableId = parseTableId(req.params.id);
  if (tableId === null) {
    unknownTable(res, req.params.id);
    return;
  }
  try {
    const result = closeTable(tableId);
    const payload = { table_id: tableId, archived_visit_id: result.archived_visit_id };
    publish('staff', 'TABLE_CLOSED', payload);
    publish(`table:${tableId}`, 'TABLE_CLOSED', payload);
    res.status(200).json(result);
  } catch (err) {
    if (err instanceof BillingError) {
      switch (err.code) {
        case 'UNKNOWN_TABLE':
          unknownTable(res, req.params.id);
          return;
        case 'TABLE_ALREADY_CLOSED':
          res.status(409).json({ error: { code: err.code, message: err.message } });
          return;
        case 'CLOSE_BLOCKED':
          res.status(422).json({ error: { code: err.code, message: err.message, details: err.details } });
          return;
        case 'TABLE_EMPTY':
          res.status(422).json({ error: { code: err.code, message: err.message } });
          return;
      }
    }
    console.error('POST /api/tables/:id/close error:', err);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } });
  }
});

export default router;
