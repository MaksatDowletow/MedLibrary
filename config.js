// Runtime configuration for MedLibrary front-end
// Replace values below during deployment to avoid hard-coding credentials in HTML.
window.__APP_CONFIG__ = window.__APP_CONFIG__ || {
  apiBase: '',
  googleClientId: '',
};

(function applyRuntimeConfig(config) {
  const applyConfig = () => {
    const body = document.body;
    if (!body) return;

    if (config.apiBase) {
      body.dataset.apiBase = config.apiBase;
    }

    if (config.googleClientId) {
      body.dataset.googleClientId = config.googleClientId;
      const googleMeta = document.querySelector('meta[name="google-client-id"]');
      if (googleMeta) {
        googleMeta.content = config.googleClientId;
      }
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', applyConfig, { once: true });
  } else {
    applyConfig();
  }
})(window.__APP_CONFIG__);
