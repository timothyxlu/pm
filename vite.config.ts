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
        name: 'MyPM',
        short_name: 'MyPM',
        description: 'Projects and issues',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        // Android takes the system bar colors from the manifest, which has no
        // dark variant. Use the dark colors: the in-app <meta theme-color>
        // still switches the top bar to light when the light theme is on.
        background_color: '#111113',
        theme_color: '#111113',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        navigateFallback: '/index.html',
        // Serve the app shell only for the app's own routes (see router.svelte.ts).
        // Every other navigation must reach the network: the Worker's routes, and
        // above all Cloudflare Access's /cdn-cgi/access/authorized, which sets the
        // session cookie after sign-in. Answering that one from the cache made
        // "sign in again" silently do nothing.
        navigateFallbackAllowlist: [/^\/(\?|$)/, /^\/(active|search|settings|new|p|i)(\/|\?|$)/],
        globPatterns: ['**/*.{js,css,html,svg,png,webmanifest}'],
      },
    }),
  ],
});
