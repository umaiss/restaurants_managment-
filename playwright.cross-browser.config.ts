import { defineConfig, devices } from '@playwright/test';
import baseConfig from './playwright.config';

// Build and Test: the same browser tests in the installed Google Chrome and in WebKit (Safari's engine).
// Firefox is not installed or tested. The mockup-match specs are left out here because they save the
// screenshots the team looks at (taken in Chromium) and would overwrite them.
// Run: npx playwright test --config playwright.cross-browser.config.ts
export default defineConfig({
  ...baseConfig,
  testIgnore: ['**/mockup-match.spec.ts'],
  reporter: [['json', { outputFile: 'test-results/cross-browser.json' }]],
  projects: [
    { name: 'chrome', use: { ...devices['Desktop Chrome'], channel: 'chrome' } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],
});
