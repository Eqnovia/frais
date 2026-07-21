/**
 * Eqnovia Notes de Frais — Service Worker
 * Stratégie : Cache-First pour les assets statiques, Network-First pour les CDN
 * Version: 2.0
 */

const CACHE_NAME = 'eqnovia-frais-v2';
const STATIC_CACHE = 'eqnovia-static-v2';
const CDN_CACHE = 'eqnovia-cdn-v2';

const STATIC_ASSETS = [
  './',
  'index.html',
  'manifest.json',
  'style.css',
  'app.js',
  'icon-192.png',
  'icon-512.png'
];

const CDN_ASSETS = [
  'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap'
];

// Install: cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    Promise.all([
      caches.open(STATIC_CACHE).then((cache) => cache.addAll(STATIC_ASSETS)),
      caches.open(CDN_CACHE).then((cache) => {
        // Try to cache CDN assets, but don't fail if unavailable
        return Promise.allSettled(
          CDN_ASSETS.map((url) => 
            fetch(url).then((res) => {
              if (res.ok) cache.put(url, res);
            }).catch(() => {})
          )
        );
      })
    ])
  );
  self.skipWaiting();
});

// Activate: clean old caches
self.addEventListener('activate', (event) => {
  const validCaches = [STATIC_CACHE, CDN_CACHE];
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => !validCaches.includes(key))
          .map((key) => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

// Fetch strategy
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') return;

  // Skip Firebase connections (already live)
  if (url.hostname.includes('firebase') || url.hostname.includes('gstatic.com')) {
    // Network-only for Firebase
    return;
  }

  // Handle CDN resources (fonts, libs) — Cache-First
  if (url.hostname.includes('fonts.') || url.hostname.includes('cdnjs.') || url.hostname.includes('cdn.jsdelivr')) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CDN_CACHE).then((cache) => cache.put(request, clone));
          }
          return response;
        }).catch(() => new Response('', { status: 200, statusText: 'Offline fallback' }));
      })
    );
    return;
  }

  // Handle our own assets — Stale-While-Revalidate
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.match(request).then((cached) => {
        const fetchPromise = fetch(request).then((response) => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(STATIC_CACHE).then((cache) => cache.put(request, clone));
          }
          return response;
        }).catch(() => cached);

        return cached || fetchPromise;
      })
    );
    return;
  }

  // Default: Network-First with cache fallback
  event.respondWith(
    fetch(request).then((response) => {
      if (response && response.status === 200) {
        const clone = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
      }
      return response;
    }).catch(() => caches.match(request).then((cached) => {
      return cached || new Response('Hors-ligne', { status: 503 });
    }))
  );
});
