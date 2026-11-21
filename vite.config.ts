import { svelte } from '@sveltejs/vite-plugin-svelte';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

// The web app lives in web/ and builds into public/, which the Worker serves
// as static assets.
export default defineConfig({
  root: 'web',
  build: { outDir: '../public', emptyOutDir: true, target: 'es2022' },
  server: {
    port: 5173,
    // In dev, API calls go to `npm run dev` (wrangler on :8787).
    proxy: { '/api': 'http://localhost:8787', '/login': 'http://localhost:8787' },
  },
  plugins: [
    svelte(),
    VitePWA({
      registerType: 'autoUpdate',
      // Access protects the manifest too, so the browser must send cookies.
      useCredentials: true,
      includeAssets: ['icon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'pm',
        short_name: 'pm',
        description: 'Projects and issues',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        background_color: '#F6F6F4',
        theme_color: '#F6F6F4',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        navigateFallback: '/index.html',
        // These paths belong to the Worker, never to the app shell.
        navigateFallbackDenylist: [/^\/api\//, /^\/mcp/, /^\/oauth\//, /^\/authorize/, /^\/\.well-known\//, /^\/webhooks\//, /^\/login/],
        globPatterns: ['**/*.{js,css,html,svg,png,webmanifest}'],
      },
    }),
  ],
});
