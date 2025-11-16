(function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) {
    return;
  }

  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/MedLibrary/service-worker.js")
      .catch((error) => {
        console.error("SW registration failed:", error);
      });
  });
})();
