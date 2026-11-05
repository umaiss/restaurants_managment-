import { defineConfig, devices } from '@playwright/test';

const E2E_PORT = parseInt(process.env.E2E_PORT ?? '3100');
const baseURL = `http://localhost:${E2E_PORT}`;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: [['json', { outputFile: 'test-results/e2e.json' }]],
  use: {
    baseURL,
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: `E2E_PORT=${E2E_PORT} DB_FILE=:memory: tsx src/server/index.ts`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 30000,
  },
});
