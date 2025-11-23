const LANG_STORAGE_KEY = 'preferredLanguage';

function setLanguage(lang) {
  document.documentElement.lang = lang;
  document.documentElement.dataset.lang = lang;

  document.querySelectorAll('[data-lang]').forEach(element => {
    element.hidden = element.dataset.lang !== lang;
  });
}

function initLanguage() {
  const languageSelect = document.getElementById('language-select');
  const savedLanguage = localStorage.getItem(LANG_STORAGE_KEY);
  const defaultLanguage = languageSelect?.value || 'tm';
  const initialLanguage = savedLanguage || defaultLanguage;

  setLanguage(initialLanguage);

  if (languageSelect) {
    languageSelect.value = initialLanguage;
    languageSelect.addEventListener('change', event => {
      const selectedLang = event.target.value;
      setLanguage(selectedLang);
      localStorage.setItem(LANG_STORAGE_KEY, selectedLang);
    });
  }
}

document.addEventListener('DOMContentLoaded', initLanguage);
