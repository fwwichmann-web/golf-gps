const CACHE_NAME = 'golf-gps-v1';

const APP_SHELL = [
  '/',
  '/index.html',
  '/css/style.css',
  '/js/distance.js',
  '/js/storage.js',
  '/js/course-data.js',
  '/js/gps.js',
  '/js/shot-tracker.js',
  '/js/app.js',
  '/manifest.json'
];

// Install — cache app shell
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

// Activate — clean old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// Fetch — cache-first for app shell, network-first for map tiles
self.addEventListener('fetch', event => {
  const url = event.request.url;

  // Map tiles: network-first with cache fallback
  if (url.includes('arcgisonline.com') || url.includes('unpkg.com')) {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // App shell: cache-first
  event.respondWith(
    caches.match(event.request)
      .then(cached => cached || fetch(event.request))
  );
});
