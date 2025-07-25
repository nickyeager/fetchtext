import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react-swc'
import tsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
  plugins: [react(), tsconfigPaths()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    // Simpler config to avoid potential instability
    testTimeout: 20000,
    hookTimeout: 20000,
    env: {
      VITE_SUPABASE_URL: 'http://localhost:8000',
      VITE_SUPABASE_ANON_KEY: 'test_anon_key',
    },
  },
})