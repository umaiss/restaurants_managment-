/**
 * The route registry (U5 Step 9, BR14.1 and contract 7): every route module in one place, pre-filled.
 * U6 uses U5's routes only. U7 replaces the body of its five stub modules (staff-stations, staff-menu,
 * staff-floor, staff-sales, staff-qr) and never edits this file, so the Units never touch the same line.
 *
 * Order matters:
 *  - staff.ts comes first among the staff modules: it holds the open login route and then the guard
 *    that protects every other /api/staff route, stubs included.
 *  - every module is mounted before the page catch-all in index.ts (BR11.4).
 */
import type { Router } from 'express';
import menuRouter from './menu.js';
import ordersRouter from './orders.js';
import billingRouter from './billing.js';
import staffRouter from './staff.js';
import specialsRouter from './specials.js';
import callsRouter from './calls.js';
import ratingsRouter from './ratings.js';
import presenceRouter from './presence.js';
import estimateRouter from './estimate.js';
import staffStationsRouter from './staff-stations.js';
import staffMenuRouter from './staff-menu.js';
import staffFloorRouter from './staff-floor.js';
import staffSalesRouter from './staff-sales.js';
import staffQrRouter from './staff-qr.js';
import sseRouter from './sse.js';

export interface RouteModule {
  /** A short name for tests and logs. */
  name: string;
  /** Where the router is mounted. */
  mount: '/api' | '/sse';
  router: Router;
  /** Which Unit owns the module's body. */
  owner: 'v1' | 'U5' | 'U7';
}

export const routeModules: RouteModule[] = [
  { name: 'menu', mount: '/api', router: menuRouter, owner: 'v1' },
  { name: 'orders', mount: '/api', router: ordersRouter, owner: 'v1' },
  { name: 'billing', mount: '/api', router: billingRouter, owner: 'v1' },
  { name: 'staff', mount: '/api', router: staffRouter, owner: 'U5' },
  { name: 'specials', mount: '/api', router: specialsRouter, owner: 'U5' },
  { name: 'calls', mount: '/api', router: callsRouter, owner: 'U5' },
  { name: 'ratings', mount: '/api', router: ratingsRouter, owner: 'U5' },
  { name: 'presence', mount: '/api', router: presenceRouter, owner: 'U5' },
  { name: 'estimate', mount: '/api', router: estimateRouter, owner: 'U5' },
  { name: 'staff-stations', mount: '/api', router: staffStationsRouter, owner: 'U7' },
  { name: 'staff-menu', mount: '/api', router: staffMenuRouter, owner: 'U7' },
  { name: 'staff-floor', mount: '/api', router: staffFloorRouter, owner: 'U7' },
  { name: 'staff-sales', mount: '/api', router: staffSalesRouter, owner: 'U7' },
  { name: 'staff-qr', mount: '/api', router: staffQrRouter, owner: 'U7' },
  { name: 'sse', mount: '/sse', router: sseRouter, owner: 'v1' },
];
