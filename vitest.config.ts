import { defineConfig } from 'vitest/config';

export default defineConfig({
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
    environment: 'node',
    // Each test file runs in its own context — module singletons are isolated
    pool: 'forks',
    poolOptions: {
      forks: {
        isolate: true,
      },
    },
  },
});
