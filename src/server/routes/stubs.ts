/**
 * Guarded stubs for the routes U7 owns (U5 Step 9, BR14.1).
 * The staff guard runs first, so a request without a session is answered 401 and a signed-in request
 * is answered 501 NOT_BUILT. U7 replaces a stub module's body and never edits the registry.
 */
import { Router } from 'express';
import { sendApiError } from '../errors.js';
import { requireStaff } from '../staffAccess.js';

export type StubMethod = 'get' | 'post' | 'put' | 'patch' | 'delete';

export interface StubRoute {
  method: StubMethod;
  /** Path relative to /api, for example "/staff/stations/:station/board". */
  path: string;
}

export function createStubRouter(routes: StubRoute[]): Router {
  const router = Router();
  for (const route of routes) {
    router[route.method](route.path, requireStaff(), (_req, res) => {
      sendApiError(res, 501, 'NOT_BUILT', 'This staff route is not built yet.');
    });
  }
  return router;
}
