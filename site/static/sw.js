/**
 * Imigi Studio - Service Worker
 * Implements Network-First for HTML navigation and Cache-First for static assets.
 */

const CACHE_NAME = 'imigi-v20261117';
const APP_SHELL = [
  '/',
  '/static/manifest.webmanifest',
  '/static/css/newstyle.css?v=20261104',
  '/static/js/app.js',
  '/static/js/image-tools.js',
  '/static/js/pdf-tools.js',
  '/static/js/video-tools.js',
  '/static/js/scanner-tools.js',
  '/static/js/pwa.js',
  '/static/icons/imigi-icon.svg'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  // 1. Network-First Strategy for Page Navigations (Go SSR Templates)
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          return response;
        })
        .catch(() => {
          return caches.match(event.request).then((cached) => cached || caches.match('/'));
        })
    );
    return;
  }

  // 2. Cache-First Strategy for Static Assets (CSS, JS, Icons)
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) {
        return cached;
      }

      return fetch(event.request)
        .then((response) => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          return response;
        })
        .catch(() => Response.error());
    })
  );
});