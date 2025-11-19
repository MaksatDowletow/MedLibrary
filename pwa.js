
(function initPWA() {
  if (!('serviceWorker' in navigator)) {
    return;
  }

  let deferredPrompt = null;
  const installButtons = new Map();

  function registerButtons() {
    document.querySelectorAll('[data-install-trigger]').forEach((button) => {
      if (installButtons.has(button)) {
        return;
      }
      const isSticky = button.hasAttribute('data-install-sticky');
      installButtons.set(button, { sticky: isSticky });
      button.addEventListener('click', (event) => handleInstallClick(event, button));
      if (deferredPrompt || isSticky) {
        button.hidden = false;
      }
    });
  }

  async function registerServiceWorker() {
    try {
      await navigator.serviceWorker.register('./service-worker.js');
    } catch (error) {
      console.error('SW registration failed', error);
    }
  }

  async function handleInstallClick(event, button) {
    event.preventDefault();
    if (!deferredPrompt) {
      window.open('./manifest.webmanifest', '_blank');
      return;
    }
    try {
      const promptEvent = deferredPrompt;
      deferredPrompt = null;
      const { outcome } = await promptEvent.prompt();
      if (outcome === 'accepted') {
        hideInstallButtons();
      }
    } catch (error) {
      console.error('PWA install failed', error);
    }
  }

  function hideInstallButtons() {
    installButtons.forEach((meta, button) => {
      if (!meta.sticky) {
        button.hidden = true;
      }
    });
  }

  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferredPrompt = event;
    installButtons.forEach((meta, button) => {
      if (!meta.sticky) {
        button.hidden = false;
      }
      button.disabled = false;
    });
  });

  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    hideInstallButtons();
  });

  registerButtons();
  document.addEventListener('DOMContentLoaded', registerButtons);
  window.addEventListener('load', registerServiceWorker);
})();
