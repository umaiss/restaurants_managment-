import { Router } from 'express';
import { placeOrder, transitionOrder, getOrdersByVisit, getOrOpenVisit, type OrderStatus } from '../repositories/orderRepo.js';
import { getTableStatus } from '../repositories/tableRepo.js';
import { getCurrentVisit } from '../db.js';
import { publish } from '../sse.js';
import { parseTableId, unknownTable, parseOrderNumber, unknownOrder } from './tableId.js';

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

  // Every line must be an object with a string menu_item_id and a whole-number quantity of 1 to 20.
  const lines: Array<{ menu_item_id: string; quantity: number }> = [];
  for (const raw of body.lines as unknown[]) {
    const line = (raw ?? {}) as { menu_item_id?: unknown; quantity?: unknown };
    if (typeof raw !== 'object' || raw === null || typeof line.menu_item_id !== 'string' || line.menu_item_id === '') {
      res.status(400).json({ error: { code: 'INVALID_REQUEST', message: 'each line needs a menu_item_id string and a quantity' } });
      return;
    }
    if (typeof line.quantity !== 'number' || !Number.isInteger(line.quantity) || line.quantity < 1 || line.quantity > 20) {
      res.status(400).json({ error: { code: 'INVALID_QUANTITY', message: `quantity for ${line.menu_item_id} must be a whole number from 1 to 20` } });
      return;
    }
    lines.push({ menu_item_id: line.menu_item_id, quantity: line.quantity });
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

    const visitId = getOrOpenVisit(tableId);

    const result = placeOrder(tableId, visitId, placement_key, lines);

    // Build SSE payload with full item list
    const total_cents = result.lines.reduce((sum, l) => sum + l.subtotal_cents, 0);
    const ssePayload = {
      order_number: result.order_number,
      table_id: tableId,
      visit_id: visitId,
      status: result.status,
      placed_at: result.placed_at,
      lines: result.lines.map((l) => ({
        menu_item_id: l.menu_item_id,
        name: l.name,
        quantity: l.quantity,
        price_cents_each: l.price_cents_each,
        subtotal_cents: l.subtotal_cents,
      })),
      total_cents,
    };

    if (result.isDuplicate) {
      // Contract: a repeated placement_key within the same visit returns 200 with the
      // existing order, and nothing is published (the order was already announced).
      res.status(200).json({
        order_number: result.order_number,
        status: result.status,
        placed_at: result.placed_at,
        lines: result.lines,
        dropped_lines: result.dropped_lines,
      });
      return;
    }

    publish('staff', 'ORDER_PLACED', ssePayload);
    publish(`table:${tableId}`, 'ORDER_PLACED', ssePayload);

    res.status(201).json({
      order_number: result.order_number,
      status: result.status,
      placed_at: result.placed_at,
      lines: result.lines,
      dropped_lines: result.dropped_lines,
    });
  } catch (err: unknown) {
    const error = err as { code?: string; message?: string };
    if (error.code === 'EMPTY_ORDER') {
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
  const { to, by } = req.body as { to: string; by: string };

  if (!by) {
    res.status(400).json({ error: { code: 'INVALID_ACTOR', message: '`by` is required' } });
    return;
  }
  if (!to) {
    res.status(400).json({ error: { code: 'INVALID_REQUEST', message: '`to` is required' } });
    return;
  }

  try {
    const result = transitionOrder(orderNumber, to as OrderStatus, by);

    publish('staff', 'ORDER_STATUS_CHANGED', {
      order_number: result.order_number,
      table_id: result.table_id,
      status: result.status,
    });
    publish(`table:${result.table_id}`, 'ORDER_STATUS_CHANGED', {
      order_number: result.order_number,
      table_id: result.table_id,
      status: result.status,
    });

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
