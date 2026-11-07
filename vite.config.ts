import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(() => {
  return {
    define: {
      'import.meta.env.VITE_SUPABASE_URL': JSON.stringify('https://iiuavileukbczktzqdbs.supabase.co'),
      'import.meta.env.VITE_SUPABASE_ANON_KEY': JSON.stringify('sb_publishable_LvefQjGqsWeE9sLtspBhLQ_cWKgzZu-'),
    },
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        registerType: 'autoUpdate',
        devOptions: {
          enabled: false,
          type: 'module',
        },
        includeAssets: [
          'icon.svg',
          'apple-touch-icon.png',
          'pwa-192x192.png',
          'pwa-512x512.png',
          'pwa-maskable-512x512.png',
          'pwa-screenshot-mobile.png',
        ],
        manifest: {
          id: '/',
          name: 'Terra 16 — Exploration Cartographique 16-Bit',
          short_name: 'Terra 16',
          description:
            "Jeu d'exploration géolocalisé sur carte 16-bit avec points d'intérêt réels, brouillard de proximité, trésors enfouis, quêtes locales et carnet d'exploration.",
          theme_color: '#28160d',
          background_color: '#28160d',
          display: 'standalone',
          display_override: ['standalone', 'fullscreen', 'window-controls-overlay'],
          orientation: 'any',
          dir: 'ltr',
          start_url: '/',
          scope: '/',
          lang: 'fr',
          categories: ['games', 'navigation', 'travel', 'education'],
          prefer_related_applications: false,
          launch_handler: {
            client_mode: 'navigate-existing',
          },
          icons: [
            {
              src: '/pwa-192x192.png',
              sizes: '192x192',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: '/pwa-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: '/pwa-maskable-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
          ],
          screenshots: [
            {
              src: '/pwa-screenshot-mobile.png',
              sizes: '540x960',
              type: 'image/png',
              form_factor: 'narrow',
              label: 'Exploration GPS 16-bit en plein écran sur Android',
            },
            {
              src: '/assets/aistudio/image_8dd58472.png',
              sizes: '1172x666',
              type: 'image/png',
              form_factor: 'wide',
              label: 'Grimoire cartographique 16-bit Terra 16',
            },
          ],
          shortcuts: [
            {
              name: 'Carte 16-Bit',
              short_name: 'Carte',
              description: 'Ouvrir directement la carte d’exploration 16-bit',
              url: '/?tab=carte',
              icons: [{ src: '/pwa-192x192.png', sizes: '192x192', type: 'image/png' }],
            },
            {
              name: 'Carnet & Reliquaire',
              short_name: 'Carnet',
              description: 'Consulter les découvertes, l’herbier et les trésors',
              url: '/?tab=carnet',
              icons: [{ src: '/pwa-192x192.png', sizes: '192x192', type: 'image/png' }],
            },
            {
              name: 'Contrats & Quêtes',
              short_name: 'Quêtes',
              description: 'Voir les contrats de terrain locaux du secteur',
              url: '/?tab=missions',
              icons: [{ src: '/pwa-192x192.png', sizes: '192x192', type: 'image/png' }],
            },
          ],
        },
        workbox: {
          maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
          globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
          globIgnores: ['**/*firebase-applet-config*', '**/*.map', 'assets/aistudio/**'],
          navigateFallbackDenylist: [/^\/api\//],
          runtimeCaching: [
            {
              urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'terra16-google-fonts-css',
                expiration: {
                  maxEntries: 10,
                  maxAgeSeconds: 60 * 60 * 24 * 365,
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
            {
              urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'terra16-google-fonts-woff2',
                expiration: {
                  maxEntries: 20,
                  maxAgeSeconds: 60 * 60 * 24 * 365,
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
          ],
        },
      }),
    ],
    resolve: {
      alias: {
        '@': path.resolve(import.meta.dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
