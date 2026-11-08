/**
 * Kitchen stations routes (contract 3). U7 owns this module; it replaces U5's stub body and
 * routes/registry.ts is not edited. Every route is behind U5's staff guard (mounted first in staff.ts).
 * Rules: BR1.1 (a station's board), BR1.2 (the done mark), BR1.3 (events after the write), BR10.2.
 */
import { Router } from 'express';
import { publish } from '../sse.js';
import { sendApiError } from '../errors.js';
import { getStationBoard, isStation, markStationDone } from './u7/stations.js';
import { sendU7Error } from './u7/errors.js';
import { parseOrderNumber, unknownOrder } from './tableId.js';

const router = Router();

// GET /api/staff/stations/:station/board
router.get('/staff/stations/:station/board', (req, res) => {
  const { station } = req.params;
  if (!isStation(station)) {
    sendApiError(res, 404, 'UNKNOWN_STATION', `Station ${station} not found`);
    return;
  }
  try {
    res.json({ station, orders: getStationBoard(station) });
  } catch (err) {
    sendU7Error(res, 'GET /api/staff/stations/:station/board', err);
  }
});

// POST /api/staff/orders/:order_number/stations/:station/done
router.post('/staff/orders/:order_number/stations/:station/done', (req, res) => {
  const { station } = req.params;
  if (!isStation(station)) {
    sendApiError(res, 404, 'UNKNOWN_STATION', `Station ${station} not found`);
    return;
  }
  const orderNumber = parseOrderNumber(req.params.order_number);
  if (orderNumber === null) {
    unknownOrder(res, req.params.order_number);
    return;
  }
  try {
    const result = markStationDone(orderNumber, station);

    // BR1.3: published after the write, and only when something changed.
    if (result.changed) {
      publish('staff', 'STATION_DONE', {
        order_number: result.order_number,
        table_id: result.table_id,
        station,
        remaining: result.stations_remaining,
      });
      for (const change of result.changes) {
        const payload = {
          order_number: result.order_number,
          table_id: change.table_id,
          status: change.status,
          ...(change.completed_at ? { completed_at: change.completed_at } : {}),
        };
        publish('staff', 'ORDER_STATUS_CHANGED', payload);
        publish(`table:${change.table_id}`, 'ORDER_STATUS_CHANGED', payload);
      }
    }

    res.json({
      order_number: result.order_number,
      status: result.status,
      stations_done: result.stations_done,
      stations_remaining: result.stations_remaining,
    });
  } catch (err) {
    sendU7Error(res, 'POST /api/staff/orders/:order_number/stations/:station/done', err);
  }
});

export default router;
