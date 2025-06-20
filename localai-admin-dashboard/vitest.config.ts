import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react-swc'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true,
        isolate: true,
        minForks: 1,
        maxForks: 1,
      },
    },
    maxConcurrency: 1,
    fileParallelism: false,
    sequence: {
      concurrent: false,
    },
    testTimeout: 10000,
    hookTimeout: 10000,
    teardownTimeout: 5000,
    env: {
      VITE_SUPABASE_URL: 'http://localhost:8000',
      VITE_SUPABASE_ANON_KEY: 'test_anon_key',
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})