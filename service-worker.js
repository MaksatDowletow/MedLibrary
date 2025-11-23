const CACHE_NAME = 'medlibrary-v6';
const APP_SHELL = [
  './',
  './index.html',
  './auth.html',
  './book.html',
  './BookCategory.html',
  './db-catalog.html',
  './styles.css',
  './scripts.js',
  './auth.js',
  './db-catalog.js',
  './config.js',
  './lang.js',
  './pwa.js',
  './manifest.webmanifest',
  './data/books.json',
  './Book.xlsx',
  './icons/icon-192.svg',
  './icons/icon-512.svg'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)).then(() => self.skipWaiting())
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
    event.respondWith(networkFirst(request));
    return;
  }

  const normalizedPath = url.pathname === '/' ? './' : `.${url.pathname}`;
  if (APP_SHELL.includes(normalizedPath) || request.destination === 'document') {
    event.respondWith(networkFirst(request));
  } else {
    event.respondWith(cacheFirst(request));
  }
});

function networkFirst(request) {
  return fetch(request)
    .then((response) => {
      const copy = response.clone();
      caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
      return response;
    })
    .catch(() => caches.match(request).then((cached) => cached || caches.match('./index.html')));
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
      .catch(() => caches.match('./index.html'));
  });
}
