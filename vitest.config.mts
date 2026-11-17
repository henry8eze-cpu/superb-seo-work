import { defineConfig } from 'vitest/config'
import path from 'node:path'

const TEST_DB_PORT = Number(process.env.TEST_DB_PORT || 54330)

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname),
      'server-only': path.resolve(import.meta.dirname, 'tests/stubs/server-only.ts'),
    },
  },
  test: {
    include: ['tests/**/*.test.ts'],
    globalSetup: ['tests/global-setup.ts'],
    setupFiles: ['tests/setup.ts'],
    // Tests share one database; run files one after another.
    fileParallelism: false,
    testTimeout: 60_000,
    hookTimeout: 120_000,
    env: {
      NODE_ENV: 'test',
      DATABASE_URL: `postgresql://postgres:postgres@localhost:${TEST_DB_PORT}/test`,
      TEST_DB_PORT: String(TEST_DB_PORT),
      EMAIL_PROVIDER: 'mock',
      PAYMENTS_PROVIDER: 'mock',
      APP_URL: 'http://localhost:3000',
    },
  },
})
