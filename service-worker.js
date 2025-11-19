importScripts("/MedLibrary/offline-assets.js");

const CACHE_NAME = "medlibrary-v1";

const URLS_TO_CACHE = Array.isArray(self.MEDLIBRARY_OFFLINE_ASSETS)
  ? Array.from(new Set(self.MEDLIBRARY_OFFLINE_ASSETS))
  : [];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(URLS_TO_CACHE))
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) =>
        Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== CACHE_NAME) {
              return caches.delete(cacheName);
            }
            return null;
          })
        )
      )
  );
});

self.addEventListener("fetch", (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      if (response) {
        return response;
      }
      return fetch(event.request);
    })
  );
});
