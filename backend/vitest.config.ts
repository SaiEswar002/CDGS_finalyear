import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./tests/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      exclude: ['tests/**', 'dist/**', '**/*.d.ts'],
    },
    // Run tests sequentially to avoid port conflicts
    pool: 'forks',
    poolOptions: {
      forks: { singleFork: true },
    },
  },
})
