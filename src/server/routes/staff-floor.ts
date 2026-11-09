/**
 * The table list with each table's floor state (contract 3). U7 owns this module; it replaces U5's stub body.
 * Rules: BR4.1 (the server lists the tables), BR4.2 (floor state), BR10.2. Behind U5's staff guard.
 */
import { Router } from 'express';
import { getFloorTables } from './u7/floor.js';
import { sendU7Error } from './u7/errors.js';
import { sendApiError, sendIfAppError } from '../errors.js';
import { addTable, MAX_TABLE_LABEL } from '../repositories/tableRepo.js';

const router = Router();

// GET /api/staff/tables
router.get('/staff/tables', (_req, res) => {
  try {
    res.json({ tables: getFloorTables() });
  } catch (err) {
    sendU7Error(res, 'GET /api/staff/tables', err);
  }
});

// POST /api/staff/tables — adds the next table; its QR code is the page's address plus /table/<n>
router.post('/staff/tables', (req, res) => {
  const { label } = (req.body ?? {}) as { label?: unknown };
  if (label !== undefined && (typeof label !== 'string' || label.trim().length > MAX_TABLE_LABEL)) {
    sendApiError(res, 400, 'INVALID_LABEL', `label must be text of at most ${MAX_TABLE_LABEL} characters`);
    return;
  }
  try {
    res.status(201).json(addTable(label));
  } catch (err) {
    if (sendIfAppError(res, err)) return;
    sendU7Error(res, 'POST /api/staff/tables', err);
  }
});

export default router;
