import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    reporters: ['verbose', 'json'],
    outputFile: {
      json: 'test-results/unit.json',
    },
    coverage: {
      provider: 'v8',
      reportsDirectory: 'coverage',
      reporter: ['text', 'json-summary'],
    },
    // Server tests use 'node'; React component tests use 'jsdom'
    // Per-file environment via docblock: @vitest-environment jsdom
    environment: 'node',
    environmentMatchGlobs: [
      ['src/client/**/*.test.tsx', 'jsdom'],
      ['src/client/**/*.test.ts', 'jsdom'],
    ],
    setupFiles: ['src/test-setup.ts'],
    // Each test file runs in its own context — module singletons are isolated
    pool: 'forks',
    poolOptions: {
      forks: {
        isolate: true,
      },
    },
  },
});
