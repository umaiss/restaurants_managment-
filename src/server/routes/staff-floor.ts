// U7 owns this module (floor map and the table list the QR page uses, contract 3). U5 ships it as a
// guarded stub (BR14.1): 401 without a session, then 501 NOT_BUILT. U7 replaces the body of this file
// and never edits routes/registry.ts. It reads presence through U5's getPresence().
import { createStubRouter } from './stubs.js';

export default createStubRouter([{ method: 'get', path: '/staff/tables' }]);
