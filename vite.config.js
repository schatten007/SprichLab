import { defineConfig } from 'vite';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';

// Only application assets are cached. Recordings and progress live in IndexedDB.
function offlineShell() {
  return {
    name: 'offline-shell',
    async generateBundle(_options, bundle) {
      const compressedCore = Object.values(bundle).filter(item => /\.(js|css)$/.test(item.fileName))
        .reduce((total, item) => total + gzipSync(item.code ?? item.source).length, 0);
      if (compressedCore > 150 * 1024) this.error(`Core JavaScript/CSS exceeds the 150 KB gzip budget (${compressedCore} bytes).`);
      const assets = ['index.html', 'manifest.webmanifest', 'icon.svg',
        ...Object.keys(bundle).filter(name => name !== 'index.html' && !name.endsWith('.map'))];
      const publicAssets = await Promise.all(['manifest.webmanifest', 'icon.svg']
        .map(name => readFile(new URL(`./app/public/${name}`, import.meta.url))));
      const revision = createHash('sha256')
        .update(JSON.stringify(Object.values(bundle).map(item => item.code ?? item.source)))
        .update(Buffer.concat(publicAssets))
        .digest('hex').slice(0, 12);
      this.emitFile({ type: 'asset', fileName: 'sw.js', source: `
const PREFIX = 'sprich-shell-' + encodeURIComponent(self.registration.scope) + '-';
const CACHE = PREFIX + '${revision}';
const ASSETS = ${JSON.stringify(assets)}.map(path => new URL(path, self.registration.scope).href);
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS)));
});
self.addEventListener('message', event => {
  if (event.data === 'ACTIVATE_UPDATE') self.skipWaiting();
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys
    .filter(key => key.startsWith(PREFIX) && key !== CACHE)
    .map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET' || new URL(event.request.url).origin !== self.location.origin) return;
  if (event.request.mode === 'navigate') {
    event.respondWith(fetch(event.request).catch(() =>
      caches.open(CACHE).then(cache => cache.match(new URL('index.html', self.registration.scope).href))));
  } else if (ASSETS.includes(event.request.url)) {
    event.respondWith(caches.open(CACHE).then(async cache =>
      (await cache.match(event.request.url, { ignoreVary: true })) || fetch(event.request)));
  }
});
` });
    },
  };
}

// The browser must reach /api on its own origin: the gateway rejects cross-origin
// mutations, so the dev and preview servers proxy to the loopback gateway instead.
const gatewayProxy = { '/api': { target: 'http://127.0.0.1:8787', changeOrigin: false } };

export default defineConfig({
  root: 'app',
  base: './',
  build: { outDir: '../dist', emptyOutDir: true, target: 'es2022' },
  server: { host: 'localhost', port: 8080, strictPort: true, proxy: gatewayProxy },
  preview: { host: '127.0.0.1', port: 4173, strictPort: true, proxy: gatewayProxy },
  plugins: [offlineShell()],
});
