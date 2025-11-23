const CACHE_NAME = 'medlibrary-v8';
const STATIC_ASSETS = [
  '/MedLibrary/',
  '/MedLibrary/index.html',
  '/MedLibrary/book.html',
  '/MedLibrary/styles.css',
  '/MedLibrary/scripts.js',
  '/MedLibrary/pwa.js',
  '/MedLibrary/src/main.js',
];

const CATALOG_URL = '/MedLibrary/data/books.json';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll([...STATIC_ASSETS, CATALOG_URL]))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.map((key) => {
            if (key !== CACHE_NAME) {
              return caches.delete(key);
            }
            return null;
          })
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') {
    return;
  }

  const url = new URL(request.url);

  if (url.origin !== self.location.origin) {
    event.respondWith(fetch(request));
    return;
  }

  if (url.pathname === CATALOG_URL) {
    event.respondWith(networkFirst(request));
    return;
  }

  const normalizedPath = url.pathname === '/MedLibrary' ? '/MedLibrary/' : url.pathname;
  if (STATIC_ASSETS.includes(normalizedPath) || request.destination === 'document') {
    event.respondWith(cacheFirst(request));
    return;
  }

  event.respondWith(fetch(request));
});

function networkFirst(request, options = {}) {
  return fetch(request)
    .then((response) => {
      const copy = response.clone();
      caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
      return response;
    })
    .catch(() => {
      if (options.fallbackToShell && request.destination === 'document') {
        return caches.match('/MedLibrary/index.html');
      }
      return caches.match(request);
    });
}

function cacheFirst(request) {
  return caches.match(request).then((cached) => {
    if (cached) {
      return cached;
    }
    return fetch(request)
      .then((response) => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        return response;
      })
      .catch(() => caches.match(request));
  });
}
