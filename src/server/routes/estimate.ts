/**
 * Estimate route (U5 Step 9). BR4.3: the table must exist (else 404 UNKNOWN_TABLE) but does not change
 * the value, which is the same for every table. Screens read it again when an order is placed or
 * changes status; there is no event of its own.
 */
import { Router } from 'express';
import { sendInternalError } from '../errors.js';
import { tableExists } from '../repositories/tableRepo.js';
import { computeEstimate } from '../services/waitEstimation.js';
import { parseTableId, unknownTable } from './tableId.js';

const router = Router();

// GET /api/estimate?table=<n>
router.get('/estimate', (req, res) => {
  const raw = typeof req.query.table === 'string' ? req.query.table : '';
  const tableId = parseTableId(raw);
  if (tableId === null || !tableExists(tableId)) {
    unknownTable(res, raw);
    return;
  }
  try {
    res.json(computeEstimate());
  } catch (err) {
    sendInternalError(res, 'GET /api/estimate', err);
  }
});

export default router;
