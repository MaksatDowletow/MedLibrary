const LANG_STORAGE_KEY = 'preferredLanguage';
const COMPONENT_PATHS = {
  header: './src/components/header.html',
  hero: './src/components/hero.html',
  audit: './src/components/audit.html',
  features: './src/components/features.html',
  catalogPreview: './src/components/catalog-preview.html',
  platform: './src/components/platform.html',
  gallery: './src/components/gallery.html',
  contact: './src/components/contact.html',
  footer: './src/components/footer.html',
};
const TRANSLATION_PATHS = {
  en: './src/i18n/en.json',
  ru: './src/i18n/ru.json',
  tm: './src/i18n/tm.json',
};

const translations = {};

async function loadText(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Не удалось загрузить ${url}: ${response.status}`);
  }
  return response.text();
}

async function loadJson(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Не удалось загрузить ${url}: ${response.status}`);
  }
  return response.json();
}

async function loadComponents() {
  const entries = await Promise.all(
    Object.entries(COMPONENT_PATHS).map(async ([key, path]) => {
      const content = await loadText(path);
      return [key, content];
    })
  );
  return Object.fromEntries(entries);
}

async function loadTranslations() {
  const entries = await Promise.all(
    Object.entries(TRANSLATION_PATHS).map(async ([lang, path]) => {
      const dictionary = await loadJson(path);
      return [lang, dictionary];
    })
  );
  Object.assign(translations, Object.fromEntries(entries));
}

function getTranslation(lang, key) {
  const dictionary = translations[lang] || translations.ru || {};
  return key.split('.').reduce((value, part) => (value ? value[part] : undefined), dictionary);
}

function applyTranslations(lang) {
  document.documentElement.lang = lang;
  document.documentElement.dataset.lang = lang;

  const dictionary = translations[lang] || translations.ru || {};

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

function injectLayout(components) {
  const app = document.getElementById('app');
  if (!app) return;

  app.innerHTML = `
    <div class="page">
      ${components.header || ''}
      <main>
        ${components.hero || ''}
        ${components.audit || ''}
        ${components.features || ''}
        ${components.catalogPreview || ''}
        ${components.platform || ''}
        ${components.gallery || ''}
        ${components.contact || ''}
      </main>
      ${components.footer || ''}
    </div>
  `;
}

async function init() {
  try {
    const [components] = await Promise.all([loadComponents(), loadTranslations()]);
    injectLayout(components);
    initLanguage();
    bindLanguageSwitch();
  } catch (error) {
    console.error(error);
    const app = document.getElementById('app');
    if (app) {
      app.innerHTML = '<p class="text-center">Не удалось загрузить интерфейс. Попробуйте обновить страницу.</p>';
    }
  }
}

document.addEventListener('DOMContentLoaded', init);
