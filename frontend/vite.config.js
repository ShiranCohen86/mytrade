import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // Custom service worker (push handlers + tuned runtime caching).
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.js',
      // We register manually in main.jsx to drive the "update available" prompt.
      injectRegister: null,
      registerType: 'prompt',
      // Manifest is hand-authored at public/manifest.webmanifest (rich shortcuts/screenshots).
      manifest: false,
      includeAssets: ['favicon.svg', 'apple-touch-icon.png', 'offline.html'],
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,svg,webmanifest,woff,woff2}', 'pwa-*.png', 'maskable-*.png', 'apple-touch-icon.png'],
        // iOS splash + promo screenshots are large and only needed on demand —
        // keep them out of the precache (served from network / HTTP cache).
        globIgnores: ['**/apple-splash-*.png', '**/screenshot-*.png'],
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
      },
      devOptions: { enabled: false, type: 'module' },
    }),
  ],
  resolve: {
    alias: {
      '@': resolve(__dirname, '.'),
    },
  },
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
      '/auth': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
      '/health': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
      '/admin': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
    },
  },
  define: {
    __APP_VERSION__: JSON.stringify(process.env.npm_package_version || '0.1.0'),
    __APP_BUILD__: JSON.stringify(new Date().toISOString()),
  },
  css: {
    preprocessorOptions: {
      scss: {
        api: 'modern',
      },
    },
  },
  build: {
    outDir: 'dist',
    chunkSizeWarningLimit: 1000,
    // recharts (vendor-charts) is only used by lazy routes — don't eagerly
    // preload it on first paint; it loads on demand when a chart route opens.
    modulePreload: {
      resolveDependencies: (_url, deps) => deps.filter((d) => !d.includes('vendor-charts')),
    },
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-charts': ['recharts'],
        },
      },
    },
  },
});
