const CACHE_NAME = "medlibrary-v1";

const URLS_TO_CACHE = [
  "/MedLibrary/",
  "/MedLibrary/index.html",
  "/MedLibrary/book.html",
  "/MedLibrary/books.html",
  "/MedLibrary/books2.html",
  "/MedLibrary/BookCategory.html",
  "/MedLibrary/auth.html",
  "/MedLibrary/auth.js",
  "/MedLibrary/styles.css",
  "/MedLibrary/scripts.js",
  "/MedLibrary/lang.js",
  "/MedLibrary/pwa.js",
  "/MedLibrary/manifest.webmanifest",
  "/MedLibrary/icons/icon-192.svg",
  "/MedLibrary/icons/icon-512.svg"
];

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
