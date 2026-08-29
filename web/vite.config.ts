import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * The demo build is published as one self-contained HTML file, so it must not
 * be code-split: a dynamic import would resolve to an asset URL that has no
 * origin to be fetched from. Everything goes in one chunk instead.
 */
const demo = process.env.VITE_DEMO === '1';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true,
    // The API and the socket both live on the server; proxying in dev keeps
    // everything same-origin so the session cookie just works.
    proxy: {
      '/api': { target: 'http://localhost:4000', changeOrigin: true },
      '/uploads': { target: 'http://localhost:4000', changeOrigin: true },
      '/socket.io': { target: 'http://localhost:4000', ws: true, changeOrigin: true },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: !demo,
    ...(demo
      ? { rollupOptions: { output: { inlineDynamicImports: true } } }
      : {}),
  },
});
