// GardenLog Service Worker
// Strategy: cache-first for the app shell, network-first for all Supabase / API calls.
// Bump CACHE_VERSION when you deploy a new index.html — old cache is purged automatically.

const CACHE_VERSION = 'gardenlog-v1';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/apple-touch-icon.png',
];

// Hosts that should always hit the network (Supabase, Google Fonts, etc.)
const NETWORK_ONLY_HOSTS = [
  'supabase.co',
  'googleapis.com',
  'gstatic.com',
  'zippopotam.us',
  'open-meteo.com',
  'archive-api.open-meteo.com',
];

// ── Install: pre-cache the app shell ────────────────────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then(cache => cache.addAll(STATIC_ASSETS))
  );
  // Take over immediately — don't wait for old worker to die
  self.skipWaiting();
});

// ── Activate: delete stale caches ────────────────────────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== CACHE_VERSION).map(k => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

// ── Fetch: route requests ─────────────────────────────────────────────────────
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Always go to network for Supabase, APIs, and non-GET requests
  if (
    event.request.method !== 'GET' ||
    NETWORK_ONLY_HOSTS.some(h => url.hostname.includes(h))
  ) {
    event.respondWith(fetch(event.request));
    return;
  }

  // For navigation requests (HTML pages): network-first, fall back to cached shell
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          // Update cache with fresh response
          const clone = response.clone();
          caches.open(CACHE_VERSION).then(cache => cache.put(event.request, clone));
          return response;
        })
        .catch(() => caches.match('/index.html'))
    );
    return;
  }

  // For everything else (icons, fonts, manifest): cache-first
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        if (response && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_VERSION).then(cache => cache.put(event.request, clone));
        }
        return response;
      });
    })
  );
});
