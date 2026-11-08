/**
 * Signs in once before the whole run (U5 Step 17, BR11.3): every test starts with a staff session, so
 * v1's browser tests need no change of their own. The session cookie is saved where the Playwright config
 * points `storageState`. Tests of the PIN screen itself start from an empty state (test.use).
 */
import { request as playwrightRequest, type FullConfig } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { signInAsStaff } from './index.js';

export const STAFF_STATE_FILE = path.join('test-results', '.auth', 'staff.json');

export default async function globalSetup(config: FullConfig): Promise<void> {
  const baseURL = config.projects[0].use.baseURL;
  const api = await playwrightRequest.newContext({ baseURL });
  try {
    await signInAsStaff(null, api);
    fs.mkdirSync(path.dirname(STAFF_STATE_FILE), { recursive: true });
    await api.storageState({ path: STAFF_STATE_FILE });
  } finally {
    await api.dispose();
  }
}
