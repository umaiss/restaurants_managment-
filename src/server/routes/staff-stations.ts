// U7 owns this module (kitchen stations, contract 3). U5 ships it as a guarded stub (BR14.1): 401 without
// a session, then 501 NOT_BUILT. U7 replaces the body of this file and never edits routes/registry.ts.
import { createStubRouter } from './stubs.js';

export default createStubRouter([
  { method: 'get', path: '/staff/stations/:station/board' },
  { method: 'post', path: '/staff/orders/:order_number/stations/:station/done' },
]);
