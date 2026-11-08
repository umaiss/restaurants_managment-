/**
 * Order routes (v1, extended by U5 Step 9).
 * BR1.5 and BR1.6 (by=staff needs a staff session; by=diner stays open and only cancels a Pending order),
 * BR3.1 to BR3.5 (options, specials, stored estimate), BR9.1 (write, then publish), BR5.5 (SPECIAL_CHANGED
 * when stock changed), BR3.6 (completed_at on ORDER_STATUS_CHANGED).
 */
import { Router } from 'express';
import { placeOrderAtTable, transitionOrder, getOrdersByVisit, type OrderStatus, type PlaceOrderInputLine } from '../repositories/orderRepo.js';
import { getTableStatus } from '../repositories/tableRepo.js';
import { getCurrentVisit } from '../db.js';
import { getCurrentSpecial } from '../repositories/specialsRepo.js';
import { computeEstimate } from '../services/waitEstimation.js';
import { publishSpecialChanged } from '../menuEvents.js';
import { publish } from '../sse.js';
import { sendApiError } from '../errors.js';
import { getStaffToken, touchSession } from '../staffAccess.js';
import { parseTableId, unknownTable, parseOrderNumber, unknownOrder } from './tableId.js';

/** The most lines one order, and the most option ids one line, may carry. */
const MAX_LINES_PER_ORDER = 50;
const MAX_OPTION_IDS_PER_LINE = 20;

const router = Router();

// POST /api/tables/:id/orders
router.post('/tables/:id/orders', (req, res) => {
  const tableId = parseTableId(req.params.id);
  if (tableId === null) {
    unknownTable(res, req.params.id);
    return;
  }
  const body = (req.body ?? {}) as { placement_key?: unknown; lines?: unknown };

  if (typeof body.placement_key !== 'string' || body.placement_key.trim() === '') {
    res.status(400).json({ error: { code: 'INVALID_REQUEST', message: 'placement_key is required and must be a string' } });
    return;
  }
  const placement_key = body.placement_key;

  if (!Array.isArray(body.lines) || body.lines.length === 0) {
    res.status(400).json({ error: { code: 'EMPTY_ORDER', message: 'lines must be a non-empty array' } });
    return;
  }

  // The route is open to everyone, so what one request may carry is bounded (code review, Minor).
  if (body.lines.length > MAX_LINES_PER_ORDER) {
    res.status(400).json({ error: { code: 'INVALID_REQUEST', message: `an order may have at most ${MAX_LINES_PER_ORDER} lines`, details: { field: 'lines' } } });
    return;
  }

  // Every line must be an object with a string menu_item_id and a whole-number quantity of 1 to 20.
  const lines: PlaceOrderInputLine[] = [];
  for (const raw of body.lines as unknown[]) {
    const line = (raw ?? {}) as { menu_item_id?: unknown; quantity?: unknown; option_ids?: unknown; special_id?: unknown };
    if (typeof raw !== 'object' || raw === null || typeof line.menu_item_id !== 'string' || line.menu_item_id === '') {
      res.status(400).json({ error: { code: 'INVALID_REQUEST', message: 'each line needs a menu_item_id string and a quantity' } });
      return;
    }
    if (typeof line.quantity !== 'number' || !Number.isInteger(line.quantity) || line.quantity < 1 || line.quantity > 20) {
      res.status(400).json({ error: { code: 'INVALID_QUANTITY', message: `quantity for ${line.menu_item_id} must be a whole number from 1 to 20` } });
      return;
    }
    // NEW: option_ids is a list of strings; special_id is a string. Anything else is a malformed request.
    if (
      line.option_ids !== undefined &&
      (!Array.isArray(line.option_ids) || line.option_ids.some((id) => typeof id !== 'string'))
    ) {
      res.status(400).json({ error: { code: 'INVALID_REQUEST', message: `option_ids for ${line.menu_item_id} must be a list of strings`, details: { field: 'option_ids' } } });
      return;
    }
    if (Array.isArray(line.option_ids) && line.option_ids.length > MAX_OPTION_IDS_PER_LINE) {
      res.status(400).json({ error: { code: 'INVALID_REQUEST', message: `a line may have at most ${MAX_OPTION_IDS_PER_LINE} option_ids`, details: { field: 'option_ids' } } });
      return;
    }
    if (line.special_id !== undefined && (typeof line.special_id !== 'string' || line.special_id === '')) {
      res.status(400).json({ error: { code: 'INVALID_REQUEST', message: `special_id for ${line.menu_item_id} must be a string`, details: { field: 'special_id' } } });
      return;
    }
    const clean: PlaceOrderInputLine = { menu_item_id: line.menu_item_id, quantity: line.quantity };
    if (line.option_ids !== undefined) clean.option_ids = line.option_ids as string[];
    if (line.special_id !== undefined) clean.special_id = line.special_id as string;
    lines.push(clean);
  }

  try {
    // Check table state
    let tableStatus;
    try {
      tableStatus = getTableStatus(tableId);
    } catch {
      res.status(404).json({ error: { code: 'UNKNOWN_TABLE', message: `Table ${tableId} not found` } });
      return;
    }

    // A closed table is not refused: closing "resets" the table, so the next order placed here
    // opens a new visit (getOrOpenVisit below). The TABLE_CLOSED error code stays unused by order placement.

    // BR3.5: the estimate shown at placement is worked out just before placing and stored on the order.
    const estimate = computeEstimate();

    // The visit, the order, its lines, their options and any special stock reduction are one transaction (BR3.10).
    const result = placeOrderAtTable(tableId, placement_key, lines, estimate.estimate_minutes);
    const visitId = result.visit_id;

    const body = {
      order_number: result.order_number,
      status: result.status,
      placed_at: result.placed_at,
      estimate_minutes: result.estimate_minutes,
      lines: result.lines,
      dropped_lines: result.dropped_lines,
    };

    if (result.isDuplicate) {
      // Contract: a repeated placement_key within the same visit returns 200 with the
      // existing order, and nothing is published (the order was already announced).
      res.status(200).json(body);
      return;
    }

    // Build SSE payload with full item list (the write has succeeded: publish after it, BR9.1)
    const total_cents = result.lines.reduce((sum, l) => sum + l.subtotal_cents, 0);
    const ssePayload = {
      order_number: result.order_number,
      table_id: tableId,
      visit_id: visitId,
      status: result.status,
      placed_at: result.placed_at,
      estimate_minutes: result.estimate_minutes,
      lines: result.lines.map((l) => ({
        menu_item_id: l.menu_item_id,
        name: l.name,
        quantity: l.quantity,
        price_cents_each: l.price_cents_each,
        subtotal_cents: l.subtotal_cents,
        station: l.station,
        options: l.options,
      })),
      total_cents,
    };

    publish('staff', 'ORDER_PLACED', ssePayload);
    publish(`table:${tableId}`, 'ORDER_PLACED', ssePayload);
    // BR5.5: a special's stock changed (or sold out): everyone's Menu updates at once.
    if (result.special_stock_changed) publishSpecialChanged(getCurrentSpecial());

    res.status(201).json(body);
  } catch (err: unknown) {
    const error = err as { code?: string; message?: string; details?: Record<string, unknown> };
    if (error.code === 'INVALID_OPTIONS') {
      res.status(400).json({ error: { code: 'INVALID_OPTIONS', message: error.message, details: error.details } });
    } else if (error.code === 'EMPTY_ORDER') {
      res.status(400).json({ error: { code: 'EMPTY_ORDER', message: error.message } });
    } else if (error.code === 'INVALID_QUANTITY') {
      res.status(400).json({ error: { code: 'INVALID_QUANTITY', message: error.message } });
    } else if (error.code === 'UNKNOWN_ITEM') {
      res.status(400).json({ error: { code: 'UNKNOWN_ITEM', message: error.message } });
    } else {
      console.error('POST /api/tables/:id/orders error:', err);
      res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } });
    }
  }
});

// GET /api/tables/:id/orders?visit=current
router.get('/tables/:id/orders', (req, res) => {
  const tableId = parseTableId(req.params.id);
  if (tableId === null) {
    unknownTable(res, req.params.id);
    return;
  }
  const { visit } = req.query as { visit?: string };

  try {
    let visitId: string | null = null;
    if (visit === 'current') {
      const currentVisit = getCurrentVisit(tableId);
      visitId = currentVisit?.id ?? null;
    }

    if (!visitId) {
      res.json({ orders: [] });
      return;
    }

    const orders = getOrdersByVisit(visitId);
    res.json({ orders });
  } catch (err) {
    console.error('GET /api/tables/:id/orders error:', err);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } });
  }
});

// POST /api/orders/:order_number/transition
// Body: { to: <target status>, by: "diner"|"staff" }
// Note: the request body field is `to`, not `status` (despite plan prose wording).
router.post('/orders/:order_number/transition', (req, res) => {
  // Only a plain order number counts: "12abc" is refused, not read as order 12.
  const orderNumber = parseOrderNumber(req.params.order_number);
  if (orderNumber === null) {
    unknownOrder(res, req.params.order_number);
    return;
  }
  const { to, by } = (req.body ?? {}) as { to: string; by: string };

  if (!by) {
    res.status(400).json({ error: { code: 'INVALID_ACTOR', message: '`by` is required' } });
    return;
  }
  // BR1.5: only by=staff needs the session; by=diner stays open and may only cancel a Pending order (BR1.6).
  // The station actor belongs to U7's kitchen logic, which calls transitionOrder directly: a request can never claim it.
  if (by === 'station') {
    res.status(400).json({ error: { code: 'INVALID_ACTOR', message: `Invalid actor '${by}'` } });
    return;
  }
  if (by === 'staff' && !touchSession(getStaffToken(req))) {
    sendApiError(res, 401, 'UNAUTHORIZED', 'Staff sign-in is required.');
    return;
  }
  if (!to) {
    res.status(400).json({ error: { code: 'INVALID_REQUEST', message: '`to` is required' } });
    return;
  }

  try {
    const result = transitionOrder(orderNumber, to as OrderStatus, by);

    // BR3.6: completed_at is on the event only when the order became Completed.
    const payload = {
      order_number: result.order_number,
      table_id: result.table_id,
      status: result.status,
      ...(result.completed_at ? { completed_at: result.completed_at } : {}),
    };
    publish('staff', 'ORDER_STATUS_CHANGED', payload);
    publish(`table:${result.table_id}`, 'ORDER_STATUS_CHANGED', payload);

    res.json({ order_number: result.order_number, status: result.status });
  } catch (err: unknown) {
    const error = err as { code?: string; message?: string };
    if (error.code === 'INVALID_ACTOR') {
      res.status(400).json({ error: { code: 'INVALID_ACTOR', message: error.message } });
    } else if (error.code === 'ILLEGAL_TRANSITION') {
      res.status(422).json({ error: { code: 'ILLEGAL_TRANSITION', message: error.message } });
    } else if (error.code === 'UNKNOWN_ORDER') {
      res.status(404).json({ error: { code: 'UNKNOWN_ORDER', message: error.message } });
    } else {
      console.error('POST /api/orders/:order_number/transition error:', err);
      res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } });
    }
  }
});

// GET /api/tables/:id — table status
router.get('/tables/:id', (req, res) => {
  const tableId = parseTableId(req.params.id);
  if (tableId === null) {
    unknownTable(res, req.params.id);
    return;
  }
  try {
    const status = getTableStatus(tableId);
    res.json(status);
  } catch (err) {
    console.error('GET /api/tables/:id error:', err);
    res.status(404).json({ error: { code: 'UNKNOWN_TABLE', message: `Table ${tableId} not found` } });
  }
});

export default router;
