// Deliberately minimal — this is what makes the site installable
// ("Add to Home Screen") plus a friendly offline fallback page, not a
// full offline-first rebuild of the app. Real collection data comes from
// Supabase on every page load; caching that here would risk showing
// stale or wrong data (someone else's edits, a price that's since
// changed) with no easy way for a user to tell it's stale. So:
// - Static assets (JS/CSS/images) get cache-first, since those are
//   genuinely safe to reuse and speed up repeat visits.
// - Page navigations are always network-first — try the real page, and
//   only fall back to the cached offline page if the network is
//   actually down.
// - Anything else (Supabase calls, API routes) isn't touched at all;
//   the fetch handler only intercepts same-origin GET requests.

const CACHE_NAME = 'shelf-life-v1';
const OFFLINE_URL = '/offline.html';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll([OFFLINE_URL])).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/')) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() => caches.match(OFFLINE_URL))
    );
    return;
  }

  if (['style', 'script', 'image', 'font'].includes(request.destination)) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return res;
        });
      })
    );
  }
});
