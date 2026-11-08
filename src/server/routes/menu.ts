import { Router } from 'express';
import { getMenu, updateItemAvailability } from '../repositories/menuRepo.js';
import { publish } from '../sse.js';
import { getDb } from '../db.js';
import { requireStaff } from '../staffAccess.js';

const router = Router();

// GET /api/menu
router.get('/menu', (_req, res) => {
  try {
    const menu = getMenu();
    res.json(menu);
  } catch (err) {
    console.error('GET /api/menu error:', err);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } });
  }
});

// POST /api/menu/items/:id/availability
// Staff only (BR1.5): the sold-out toggle needs a staff session.
router.post('/menu/items/:id/availability', requireStaff(), (req, res) => {
  const { id } = req.params;
  const { available } = req.body as { available: boolean };

  if (typeof available !== 'boolean') {
    res.status(400).json({ error: { code: 'INVALID_REQUEST', message: '`available` must be a boolean' } });
    return;
  }

  const item = updateItemAvailability(id, available);
  if (!item) {
    res.status(404).json({ error: { code: 'UNKNOWN_ITEM', message: `Item ${id} not found` } });
    return;
  }

  // Notify every table's channel, as the contract says, not only tables with an open visit:
  // a diner who is still browsing has no visit yet but must see a sold-out item at once.
  const db = getDb();
  const tableIds = db.prepare('SELECT id FROM tables').all() as Array<{ id: number }>;
  for (const t of tableIds) {
    publish(`table:${t.id}`, 'MENU_AVAILABILITY_CHANGED', { menu_item_id: id, available });
  }
  publish('staff', 'MENU_AVAILABILITY_CHANGED', { menu_item_id: id, available });

  res.json(item);
});

export default router;
