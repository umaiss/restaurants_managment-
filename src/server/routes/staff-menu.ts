/**
 * Menu management routes (contract 3). U7 owns this module; it replaces U5's stub body.
 * Rules: BR5.1 (the staff read), BR5.2 to BR5.4 (checks), BR5.5 (publishMenuChange after every successful
 * write), BR5.6 (no delete route), BR10.2. Behind U5's staff guard.
 */
import { Router } from 'express';
import { getStaffMenu } from '../repositories/menuRepo.js';
import { publishMenuChange, watchSpecial } from '../menuEvents.js';
import { createCategory, createItem, replaceOptions, updateCategory, updateItem } from './u7/menuAdmin.js';
import { sendU7Error } from './u7/errors.js';

const router = Router();

// GET /api/staff/menu — hidden items and categories included
router.get('/staff/menu', (_req, res) => {
  try {
    res.json(getStaffMenu());
  } catch (err) {
    sendU7Error(res, 'GET /api/staff/menu', err);
  }
});

// POST /api/staff/menu/items
router.post('/staff/menu/items', (req, res) => {
  try {
    const item = createItem(req.body);
    publishMenuChange('item', [item.id]);
    res.status(201).json(item);
  } catch (err) {
    sendU7Error(res, 'POST /api/staff/menu/items', err);
  }
});

// PATCH /api/staff/menu/items/:id
router.patch('/staff/menu/items/:id', (req, res) => {
  try {
    const item = watchSpecial(() => updateItem(req.params.id, req.body));
    publishMenuChange('item', [item.id]);
    res.json(item);
  } catch (err) {
    sendU7Error(res, 'PATCH /api/staff/menu/items/:id', err);
  }
});

// PUT /api/staff/menu/items/:id/options
router.put('/staff/menu/items/:id/options', (req, res) => {
  try {
    const options = watchSpecial(() => replaceOptions(req.params.id, req.body));
    publishMenuChange('options', [req.params.id]);
    res.json({ item_id: req.params.id, options });
  } catch (err) {
    sendU7Error(res, 'PUT /api/staff/menu/items/:id/options', err);
  }
});

// POST /api/staff/menu/categories
router.post('/staff/menu/categories', (req, res) => {
  try {
    const category = createCategory(req.body);
    publishMenuChange('category', [category.id]);
    res.status(201).json(category);
  } catch (err) {
    sendU7Error(res, 'POST /api/staff/menu/categories', err);
  }
});

// PATCH /api/staff/menu/categories/:id
router.patch('/staff/menu/categories/:id', (req, res) => {
  try {
    const category = watchSpecial(() => updateCategory(req.params.id, req.body));
    publishMenuChange('category', [category.id]);
    res.json(category);
  } catch (err) {
    sendU7Error(res, 'PATCH /api/staff/menu/categories/:id', err);
  }
});

export default router;
