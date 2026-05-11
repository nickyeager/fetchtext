import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react-swc'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    // Simpler config to avoid potential instability
    testTimeout: 20000,
    hookTimeout: 20000,
    // Memory optimization - prevent heap out of memory
    pool: 'forks',
    poolOptions: {
      forks: {
        maxForks: 2,
        minForks: 1,
      },
    },
    maxConcurrency: 5,
    fileParallelism: false,
    env: {
      VITE_SUPABASE_URL: 'http://localhost:8000',
      VITE_SUPABASE_ANON_KEY: 'test_anon_key',
    },
    // Root directory for test discovery
    root: path.resolve(__dirname),
    // Exclude E2E tests from Vitest (they use Playwright)
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      'tests/**',
      '**/*.pw.spec.ts',
      '**/*.pw.spec.tsx',
      '**/*.spec.ts',
      '**/*.spec.tsx',
    ],
    // Include patterns for Vitest tests - only src directory
    include: [
      'src/**/*.test.{ts,tsx}',
    ],
  },
})