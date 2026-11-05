import { Router } from 'express';
import { getMenu, updateItemAvailability } from '../repositories/menuRepo.js';
import { publish } from '../sse.js';
import { getDb } from '../db.js';

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
router.post('/menu/items/:id/availability', (req, res) => {
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

  // Notify all channels
  const db = getDb();
  const openVisits = db.prepare("SELECT table_id FROM visits WHERE closed_at IS NULL").all() as Array<{ table_id: number }>;
  for (const v of openVisits) {
    publish(`table:${v.table_id}`, 'MENU_AVAILABILITY_CHANGED', { menu_item_id: id, available });
  }
  publish('staff', 'MENU_AVAILABILITY_CHANGED', { menu_item_id: id, available });

  res.json(item);
});

export default router;
