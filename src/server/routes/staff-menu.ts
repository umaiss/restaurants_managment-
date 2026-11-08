// U7 owns this module (menu management, contract 3). U5 ships it as a guarded stub (BR14.1): 401 without
// a session, then 501 NOT_BUILT. U7 replaces the body of this file and never edits routes/registry.ts.
// GET /api/staff/menu is served by U7 with U5's data function getStaffMenu() (BR2.7).
import { createStubRouter } from './stubs.js';

export default createStubRouter([
  { method: 'get', path: '/staff/menu' },
  { method: 'post', path: '/staff/menu/items' },
  { method: 'patch', path: '/staff/menu/items/:id' },
  { method: 'put', path: '/staff/menu/items/:id/options' },
  { method: 'post', path: '/staff/menu/categories' },
  { method: 'patch', path: '/staff/menu/categories/:id' },
]);
