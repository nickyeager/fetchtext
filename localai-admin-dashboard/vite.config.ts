import path from 'path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import tailwindcss from '@tailwindcss/vite'
import { TanStackRouterVite } from '@tanstack/router-plugin/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    TanStackRouterVite({
      target: 'react',
      autoCodeSplitting: true,
    }),
    react(),
    tailwindcss(),
  ],
  // Enable source maps for debugging (both dev and build)
  build: {
    sourcemap: true,
  },
  css: {
    devSourcemap: true,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),

      // fix loading all icon chunks in dev mode
      // https://github.com/tabler/tabler-icons/issues/1233
      '@tabler/icons-react': '@tabler/icons-react/dist/esm/icons/index.mjs',
    },
  },
  server: {
    proxy: {
      // Proxy Supabase requests to local instance
      '/supabase': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/supabase/, ''),
        configure: (proxy, _options) => {
          proxy.on('error', (err, _req, _res) => {
            // eslint-disable-next-line no-console
            console.log('Supabase proxy error:', err);
          });
        },
      },
      // Proxy N8N webhook requests to avoid CORS issues
      '/n8n-webhook': {
        target: 'http://localhost:5678',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/n8n-webhook/, '/webhook'),
        configure: (proxy, _options) => {
          proxy.on('error', (err, _req, _res) => {
            // eslint-disable-next-line no-console
            console.log('N8N proxy error:', err);
          });
        },
      },
    },
  },
})
