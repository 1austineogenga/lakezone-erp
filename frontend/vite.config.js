import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',

      includeAssets: ['favicon.png', 'favicon.svg', 'apple-touch-icon.png', 'icons/*.png'],
      manifest: {
        name: 'Lake Zone ERP',
        short_name: 'LZ ERP',
        description: 'Lake Zone Enterprises — Enterprise Resource Planning',
        theme_color: '#BF2026',
        background_color: '#ffffff',
        display: 'standalone',
        orientation: 'portrait-primary',
        scope: '/',
        start_url: '/',
        icons: [
          { src: '/icons/icon-72x72.png',            sizes: '72x72',   type: 'image/png', purpose: 'any' },
          { src: '/icons/icon-96x96.png',            sizes: '96x96',   type: 'image/png', purpose: 'any' },
          { src: '/icons/icon-128x128.png',          sizes: '128x128', type: 'image/png', purpose: 'any' },
          { src: '/icons/icon-144x144.png',          sizes: '144x144', type: 'image/png', purpose: 'any' },
          { src: '/icons/icon-152x152.png',          sizes: '152x152', type: 'image/png', purpose: 'any' },
          { src: '/icons/icon-192x192.png',          sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/icons/icon-384x384.png',          sizes: '384x384', type: 'image/png', purpose: 'any' },
          { src: '/icons/icon-512x512.png',          sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/icons/icon-192x192-maskable.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
          { src: '/icons/icon-512x512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/erp\.lakezone\.ke\/api\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache',
              expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 },
              networkTimeoutSeconds: 10,
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp|ico)$/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'images-cache',
              expiration: { maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 * 30 },
            },
          },
        ],
      },
      devOptions: { enabled: false },
    }),
  ],
  server: {
    port: 3000,
    strictPort: true,
    host: true,
    proxy: {
      '/api': { target: 'http://backend:8000', changeOrigin: true },
    },
  },
})
