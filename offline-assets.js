(function initOfflineAssetManifest(globalScope) {
  const assets = [
    "/MedLibrary/",
    "/MedLibrary/index.html",
    "/MedLibrary/book.html",
    "/MedLibrary/books.html",
    "/MedLibrary/books2.html",
    "/MedLibrary/BookCategory.html",
    "/MedLibrary/auth.html",
    "/MedLibrary/auth.js",
    "/MedLibrary/Book.xlsx",
    "/MedLibrary/styles.css",
    "/MedLibrary/scripts.js",
    "/MedLibrary/lang.js",
    "/MedLibrary/pwa.js",
    "/MedLibrary/offline-assets.js",
    "/MedLibrary/offline-download.js",
    "/MedLibrary/manifest.webmanifest",
    "/MedLibrary/service-worker.js",
    "/MedLibrary/icons/icon-192.svg",
    "/MedLibrary/icons/icon-512.svg",
  ];

  if (globalScope) {
    globalScope.MEDLIBRARY_OFFLINE_ASSETS = assets;
  }
})(typeof self !== "undefined" ? self : window);
