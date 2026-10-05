import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    env: {
      REDIS_URL: 'redis://127.0.0.1:6379',
    },
    include: ['src/**/*.test.ts'],
    exclude: ['src/**/*.int.test.ts', 'node_modules', 'dist'],
  },
});
