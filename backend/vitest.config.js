import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./tests/setupEnv.js'],
    testTimeout: 60000,
    hookTimeout: 60000,
    pool: 'forks',
    poolOptions: { forks: { singleFork: true } },
  },
});
