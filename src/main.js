import header from './components/header.html?raw';
import hero from './components/hero.html?raw';
import audit from './components/audit.html?raw';
import features from './components/features.html?raw';
import catalogPreview from './components/catalog-preview.html?raw';
import platform from './components/platform.html?raw';
import gallery from './components/gallery.html?raw';
import contact from './components/contact.html?raw';
import footer from './components/footer.html?raw';

import en from './i18n/en.json';
import ru from './i18n/ru.json';
import tm from './i18n/tm.json';

import '../styles.css';

const LANG_STORAGE_KEY = 'preferredLanguage';
const translations = { en, ru, tm };

function injectLayout() {
  const app = document.getElementById('app');
  if (!app) return;

  app.innerHTML = `
    <div class="page">
      ${header}
      <main>
        ${hero}
        ${audit}
        ${features}
        ${catalogPreview}
        ${platform}
        ${gallery}
        ${contact}
      </main>
      ${footer}
    </div>
  `;
}

function getTranslation(lang, key) {
  const dictionary = translations[lang] || translations.ru;
  return key.split('.').reduce((value, part) => (value ? value[part] : undefined), dictionary);
}

function applyTranslations(lang) {
  document.documentElement.lang = lang;
  document.documentElement.dataset.lang = lang;

  const dictionary = translations[lang] || translations.ru;

  document.querySelectorAll('[data-i18n]').forEach(element => {
    const key = element.dataset.i18n;
    const attr = element.dataset.i18nAttr || element.dataset.i18nTarget;
    const translation = getTranslation(lang, key);

    if (!translation) {
      return;
    }

    if (attr) {
      element.setAttribute(attr, translation);
    } else {
      element.textContent = translation;
    }
  });

  document.querySelectorAll('[data-i18n-placeholder]').forEach(element => {
    const key = element.dataset.i18nPlaceholder;
    const translation = getTranslation(lang, key);
    if (translation) {
      element.setAttribute('placeholder', translation);
    }
  });

  const descriptionMeta = document.querySelector('meta[name="description"]');
  if (descriptionMeta && dictionary.meta?.description) {
    descriptionMeta.setAttribute('content', dictionary.meta.description);
  }

  const pageTitle = document.querySelector('title[data-i18n]');
  if (pageTitle && dictionary.meta?.title) {
    pageTitle.textContent = dictionary.meta.title;
  }

  document.querySelectorAll('.lang-switch [data-lang]').forEach(button => {
    button.classList.toggle('lang-switch__active', button.dataset.lang === lang);
  });
}

function bindLanguageSwitch() {
  document.querySelectorAll('.lang-switch [data-lang]').forEach(button => {
    button.addEventListener('click', () => {
      const selectedLang = button.dataset.lang;
      localStorage.setItem(LANG_STORAGE_KEY, selectedLang);
      applyTranslations(selectedLang);
    });
  });
}

function initLanguage() {
  const savedLanguage = localStorage.getItem(LANG_STORAGE_KEY);
  const initialLanguage = savedLanguage || document.documentElement.lang || 'ru';
  applyTranslations(initialLanguage);
}

function init() {
  injectLayout();
  initLanguage();
  bindLanguageSwitch();
}

document.addEventListener('DOMContentLoaded', init);
