/**
 * Sales and ratings reports (contract 3). U7 owns this module; it replaces U5's stub body.
 * Rules: BR7.1 to BR7.4 (sales by day), BR7.6 (best and worst rated), BR10.2. Behind U5's staff guard.
 */
import { Router } from 'express';
import { getRatings, getSales } from './u7/sales.js';
import { sendU7Error } from './u7/errors.js';

const router = Router();

// GET /api/staff/sales?from=&to=
router.get('/staff/sales', (req, res) => {
  try {
    res.json({ days: getSales({ from: req.query.from, to: req.query.to }) });
  } catch (err) {
    sendU7Error(res, 'GET /api/staff/sales', err);
  }
});

// GET /api/staff/ratings?day=
router.get('/staff/ratings', (req, res) => {
  try {
    res.json(getRatings(req.query.day));
  } catch (err) {
    sendU7Error(res, 'GET /api/staff/ratings', err);
  }
});

export default router;
