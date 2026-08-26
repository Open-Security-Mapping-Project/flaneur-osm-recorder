import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import fs from 'fs';
import os from 'os';
import path from 'path';

/**
 * Load the local mkcert certificate if the developer has generated one.
 *
 * `.cert/` is gitignored, so a fresh clone does not have it. Reading it
 * unconditionally made `npm run dev` AND `npm run build` crash with ENOENT
 * for every new contributor and in CI. HTTPS is only needed to test GPS on a
 * phone over the LAN — fall back to HTTP, which is a secure context on
 * localhost anyway.
 */
function loadDevCert() {
  const keyPath = path.resolve(__dirname, '.cert/key.pem');
  const certPath = path.resolve(__dirname, '.cert/cert.pem');
  if (!fs.existsSync(keyPath) || !fs.existsSync(certPath)) {
    console.log(
      '\n  ℹ️  No .cert/ found — serving over HTTP.\n' +
        '     GPS works on localhost regardless. To test on a phone over the LAN,\n' +
        '     see the mkcert instructions in README.md.\n'
    );
    return undefined;
  }
  return { key: fs.readFileSync(keyPath), cert: fs.readFileSync(certPath) };
}

const devCert = loadDevCert();

export default defineConfig({
  base: './', // makes all paths relative
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: false,
    https: devCert,
    // Vite 5.4 rejects requests whose Host header it does not recognise.
    // Allow Tailscale MagicDNS names so a phone on the tailnet can reach the
    // dev server by hostname. `.ts.net` covers any tailnet; add your own LAN
    // hostnames here if you use them.
    allowedHosts: ['.ts.net', 'localhost', '127.0.0.1'],
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
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          {
            // Separate file: maskable icons are cropped to a safe zone, so
            // this one is padded. Reusing the 'any' icon here got the pin
            // clipped by Android's adaptive icon mask.
            src: 'icons/icon-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
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
              const networkInterfaces = os.networkInterfaces();
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
                const scheme = devCert ? 'https' : 'http';
                console.log(`\n  🌐 Network addresses (${scheme.toUpperCase()}):`);
                localIPs.forEach((ip) => {
                  console.log(`     → ${scheme}://${ip}:${address.port}/`);
                });
                if (!devCert) {
                  console.log('     ⚠️  GPS needs HTTPS on a LAN IP — generate a cert (README).');
                }
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
