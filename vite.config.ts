import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  publicDir: 'static',
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
  build: {
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            { name: 'react-vendor', test: /node_modules\/(react|react-dom|react-router)/ },
            { name: 'supabase-vendor', test: /node_modules\/@supabase/ },
            { name: 'motion-vendor', test: /node_modules\/framer-motion/ },
          ],
        },
      },
    },
  },
  server: {
    proxy: {
      '/file': {
        // Keep in sync with SUPABASE_URL in src/lib/supabase.ts (dev server only).
        target: process.env.VITE_SUPABASE_URL || 'https://isnxsygngysxgzeuhmjm.supabase.co',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/file/, '/storage/v1/object/authenticated'),
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq, req) => {
            // Forward the authorization header if present
            const authHeader = req.headers.authorization;
            if (authHeader) {
              proxyReq.setHeader('Authorization', authHeader);
            }
          });
        },
      },
    },
  },
});
