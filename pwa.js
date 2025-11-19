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

(function setupInstallPrompt() {
  const installButton = document.getElementById("install-button");
  const hintElement = document.getElementById("install-hint");
  if (!installButton && !hintElement) {
    return;
  }

  let deferredPrompt = null;
  const fallbackTexts = {
    installHintDefault: "Установка доступна в поддерживаемых браузерах.",
    installHintReady: "Нажмите, чтобы установить приложение.",
    installHintInstalled: "Приложение установлено на устройство.",
  };

  const translateText = (key) => {
    if (typeof window.translate === "function") {
      return window.translate(key);
    }
    return fallbackTexts[key] || fallbackTexts.installHintDefault;
  };

  const updateHint = (key) => {
    if (!hintElement) {
      return;
    }
    hintElement.dataset.i18nKey = key;
    if (typeof window.translateElement === "function") {
      window.translateElement(hintElement);
      return;
    }
    hintElement.textContent = translateText(key);
  };

  const hideButton = () => {
    if (installButton) {
      installButton.hidden = true;
      installButton.disabled = false;
    }
  };

  const showButton = () => {
    if (installButton) {
      installButton.hidden = false;
      installButton.disabled = false;
    }
  };

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredPrompt = event;
    showButton();
    updateHint("installHintReady");
  });

  installButton?.addEventListener("click", async () => {
    if (!deferredPrompt) {
      updateHint("installHintDefault");
      return;
    }

    installButton.disabled = true;
    const promptEvent = deferredPrompt;
    promptEvent.prompt();
    const { outcome } = await promptEvent.userChoice;
    deferredPrompt = null;
    installButton.disabled = false;

    if (outcome === "accepted") {
      updateHint("installHintInstalled");
      hideButton();
    } else {
      updateHint("installHintReady");
    }
  });

  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
    updateHint("installHintInstalled");
    hideButton();
  });

  const isStandalone = () =>
    window.matchMedia("(display-mode: standalone)").matches ||
    window.navigator.standalone;

  if (isStandalone()) {
    updateHint("installHintInstalled");
    hideButton();
  }
})();
