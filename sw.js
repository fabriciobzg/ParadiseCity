// Service worker: deixa o Ritmo funcionando offline.
// Ao publicar uma nova versão, aumente o número do CACHE.
const CACHE = 'ritmo-v3';
const ASSETS = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './manifest.webmanifest',
  './icons/icon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png',
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Responde do cache na hora e atualiza em segundo plano.
self.addEventListener('fetch', event => {
  const { request } = event;
  if (request.method !== 'GET' || new URL(request.url).origin !== location.origin) return;

  event.respondWith(
    caches.open(CACHE).then(async cache => {
      const key = request.mode === 'navigate' ? './index.html' : request;
      const cached = await cache.match(key, { ignoreSearch: request.mode === 'navigate' });
      const network = fetch(request)
        .then(response => {
          if (response.ok) cache.put(key, response.clone());
          return response;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});
