import { defineConfig } from 'vite';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { gzipSync } from 'node:zlib';
import { shellAssets } from './tools/shell-assets.js';

// Only application assets are cached. Recordings and progress live in IndexedDB.
function offlineShell() {
  return {
    name: 'offline-shell',
    async generateBundle(_options, bundle) {
      const graph = shellAssets(bundle);
      const compressedCore = graph.core.reduce((total, name) => total + gzipSync(bundle[name].code ?? bundle[name].source).length, 0);
      if (compressedCore > 150 * 1024) this.error(`Core JavaScript/CSS exceeds the 150 KB gzip budget (${compressedCore} bytes).`);
      const assets = ['index.html', 'manifest.webmanifest', 'icon.svg', ...graph.core];
      const publicAssets = await Promise.all(['manifest.webmanifest', 'icon.svg']
        .map(name => readFile(new URL(`./app/public/${name}`, import.meta.url))));
      const revision = createHash('sha256')
        .update(JSON.stringify(Object.values(bundle).map(item => item.code ?? item.source)))
        .update(Buffer.concat(publicAssets))
        .digest('hex').slice(0, 12);
      this.emitFile({ type: 'asset', fileName: 'asset-budget.json', source: JSON.stringify({ coreGzipBytes: compressedCore, limit: 150 * 1024, ...graph }, null, 2) });
      this.emitFile({ type: 'asset', fileName: 'sw.js', source: `
const PREFIX = 'sprich-shell-' + encodeURIComponent(self.registration.scope) + '-';
const CACHE = PREFIX + '${revision}';
const ASSETS = ${JSON.stringify(assets)}.map(path => new URL(path, self.registration.scope).href);
const OPTIONAL = ${JSON.stringify(graph.optional)}.map(path => new URL(path, self.registration.scope).href);
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS)));
});
self.addEventListener('message', event => {
  if (event.data === 'ACTIVATE_UPDATE') self.skipWaiting();
  if (event.data === 'CACHE_OPTIONAL') event.waitUntil(caches.open(CACHE).then(async cache => {
    for (const url of OPTIONAL) if (!await cache.match(url, { ignoreVary: true })) await cache.add(url);
    event.ports[0]?.postMessage({ ok: true });
  }).catch(() => event.ports[0]?.postMessage({ ok: false })));
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
  } else if (ASSETS.includes(event.request.url) || OPTIONAL.includes(event.request.url)) {
    event.respondWith(caches.open(CACHE).then(async cache =>
      (await cache.match(event.request.url, { ignoreVary: true })) || fetch(event.request).then(response => {
        if (response.ok) cache.put(event.request.url, response.clone());
        return response;
      })));
  }
});
` });
    },
    async writeBundle(options, bundle) {
      // Measure final emitted bytes too: later Vite plugins can rewrite preload helpers.
      const graph = shellAssets(bundle);
      const sizes = await Promise.all(graph.core.map(async name => gzipSync(await readFile(resolve(options.dir, name))).length));
      const coreGzipBytes = sizes.reduce((sum, size) => sum + size, 0);
      if (coreGzipBytes > 150 * 1024) this.error(`Emitted core JavaScript/CSS exceeds the 150 KiB gzip budget (${coreGzipBytes} bytes).`);
      await writeFile(resolve(options.dir, 'asset-budget.json'), JSON.stringify({ coreGzipBytes, limit: 150 * 1024, ...graph }, null, 2));
    },
  };
}

// The browser must reach /api on its own origin: the gateway rejects cross-origin
// mutations, so the dev and preview servers proxy to the loopback gateway instead.
const gatewayProxy = { '/api': { target: `http://127.0.0.1:${process.env.AI_GATEWAY_PORT || 8787}`, changeOrigin: false } };

export default defineConfig({
  root: 'app',
  base: './',
  build: { outDir: '../dist', emptyOutDir: true, target: 'es2022' },
  server: { host: 'localhost', port: 8080, strictPort: true, proxy: gatewayProxy },
  preview: { host: '127.0.0.1', port: 4173, strictPort: true, proxy: gatewayProxy },
  plugins: [offlineShell()],
});
