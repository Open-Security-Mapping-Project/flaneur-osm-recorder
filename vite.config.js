import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import fs from 'fs';
import path from 'path';

export default defineConfig({
  base: './', // makes all paths relative
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: false,
    https: {
      key: fs.readFileSync(path.resolve(__dirname, '.cert/key.pem')),
      cert: fs.readFileSync(path.resolve(__dirname, '.cert/cert.pem')),
    },
  },
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'icons/*.png'],
      manifest: {
        name: 'Flaneur OSM Recorder',
        short_name: 'Flaneur',
        description: 'Field survey data collector for OpenStreetMap / JOSM workflows',
        theme_color: '#0a0e1a',
        background_color: '#0a0e1a',
        display: 'standalone',
        orientation: 'portrait',
        scope: './', // Also make scope relative
        start_url: './', // And start_url relative
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable',
          },
        ],
      },
      workbox: {
        runtimeCaching: [
          {
            // Cache OSM tile layers
            urlPattern: /^https:\/\/[abc]\.tile\.openstreetmap\.org\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'osm-tiles',
              expiration: { maxEntries: 1000, maxAgeSeconds: 60 * 60 * 24 * 7 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
    {
      name: 'network-address-display',
      configureServer(server) {
        server.httpServer?.once('listening', () => {
          setTimeout(() => {
            const address = server.httpServer?.address();
            if (address && typeof address === 'object') {
              const networkInterfaces = require('os').networkInterfaces();
              const localIPs = [];

              for (const name of Object.keys(networkInterfaces)) {
                for (const iface of networkInterfaces[name]) {
                  // Skip internal (loopback) and non-IPv4 addresses
                  if (iface.family === 'IPv4' && !iface.internal) {
                    localIPs.push(iface.address);
                  }
                }
              }

              if (localIPs.length > 0) {
                console.log('\n  🌐 Network addresses (HTTPS):');
                localIPs.forEach((ip) => {
                  console.log(`     → https://${ip}:${address.port}/`);
                });
                console.log('');
              }
            }
          }, 100);
        });
      },
    },
  ],
  build: {
    target: 'es2020',
    sourcemap: true,
  },
});
