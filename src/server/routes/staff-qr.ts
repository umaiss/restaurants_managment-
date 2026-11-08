// U7 owns this module (QR codes for table addresses, contract 8). U5 ships it as a guarded stub
// (BR14.1): 401 without a session, then 501 NOT_BUILT. U7 replaces the body of this file and never
// edits routes/registry.ts. The path space /api/staff/qr/... is reserved for it.
import { createStubRouter } from './stubs.js';

export default createStubRouter([{ method: 'get', path: '/staff/qr/:table' }]);
