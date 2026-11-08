import { defineConfig, devices } from '@playwright/test';

const E2E_PORT = parseInt(process.env.E2E_PORT ?? '3100');
// 127.0.0.1, not "localhost": the server counts wrong PIN tries per client address, and the lockout test
// uses the IPv6 address [::1] (e2e/helpers LOCKOUT_ORIGIN) so locking it never locks the other tests out (BR1.4).
const baseURL = `http://127.0.0.1:${E2E_PORT}`;
const STAFF_PIN = '4242';
const V1_MOCKUP_MATCH = /e2e[\\/]u[1-4]-[^\\/]+[\\/]mockup-match\.spec\.ts$/;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  // Every spec shares one server and one database (orders, tables, menu availability),
  // so spec files run one after another. Parallel files made tests see each other's orders.
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: [['json', { outputFile: 'test-results/e2e.json' }]],
  // One staff sign-in before the run (BR11.3): every test starts signed in, so v1's specs need no change.
  // A test of the PIN screen starts signed out with test.use({ storageState: { cookies: [], origins: [] } }).
  globalSetup: './e2e/helpers/global-setup.ts',
  use: {
    baseURL,
    trace: 'on-first-retry',
    storageState: 'test-results/.auth/staff.json',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      // v1's mockup-match specs compare against v1's dark look (BR11.3), so they run in the project below.
      testIgnore: V1_MOCKUP_MATCH,
    },
    {
      name: 'chromium-v1-mockups',
      use: { ...devices['Desktop Chrome'], colorScheme: 'dark' },
      testMatch: V1_MOCKUP_MATCH,
    },
  ],
  webServer: {
    // The test PIN is a test value, the same one src/test-setup.ts sets; the app has no PIN in its code (BR1.1).
    command: `E2E_PORT=${E2E_PORT} DB_FILE=:memory: STAFF_PIN=${STAFF_PIN} tsx src/server/index.ts`,
    url: baseURL,
    // Always start a fresh server with an in-memory database; never reuse one left running on the port.
    reuseExistingServer: false,
    timeout: 30000,
  },
});
