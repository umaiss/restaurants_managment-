/**
 * The table list with each table's floor state (contract 3). U7 owns this module; it replaces U5's stub body.
 * Rules: BR4.1 (the server lists the tables), BR4.2 (floor state), BR10.2. Behind U5's staff guard.
 */
import { Router } from 'express';
import { getFloorTables } from './u7/floor.js';
import { sendU7Error } from './u7/errors.js';

const router = Router();

// GET /api/staff/tables
router.get('/staff/tables', (_req, res) => {
  try {
    res.json({ tables: getFloorTables() });
  } catch (err) {
    sendU7Error(res, 'GET /api/staff/tables', err);
  }
});

export default router;
