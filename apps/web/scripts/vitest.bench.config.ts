import { defineConfig } from 'vitest/config';

// Separate from the app's tests on purpose: the bench calls a real model.
// Run from apps/web:  npx vitest run --config scripts/vitest.bench.config.ts
export default defineConfig({
  test: {
    // Pick one with a file filter, e.g. `… vitest.bench.config.ts bench-protected`.
    include: ['scripts/bench-*.run.ts'],
    testTimeout: 30 * 60_000
  }
});
