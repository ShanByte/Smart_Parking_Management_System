import { defineConfig } from 'vitest/config';
import path from 'path';

// Load root .env if present and process.loadEnvFile is supported
try {
  const rootEnvPath = path.resolve(__dirname, '../.env');
  if (typeof process.loadEnvFile === 'function') {
    process.loadEnvFile(rootEnvPath);
  }
} catch {
  // Ignore if .env is missing (e.g. in CI where env vars are set directly)
}

const isIntegration = process.env.TEST_TYPE === 'integration';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    env: {
      NODE_ENV: 'test',
      REDIS_URL: process.env.REDIS_URL || 'redis://127.0.0.1:6379',
    },
    fileParallelism: !isIntegration,
    include: isIntegration ? ['src/**/*.int.test.ts'] : ['src/**/*.test.ts'],
    exclude: isIntegration
      ? ['node_modules', 'dist']
      : ['src/**/*.int.test.ts', 'node_modules', 'dist'],
  },
});
