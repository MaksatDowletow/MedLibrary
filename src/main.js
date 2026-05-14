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
  const normalizedLang = translations[lang] ? lang : 'ru';

  document.documentElement.lang = normalizedLang;
  document.documentElement.dataset.lang = normalizedLang;

  const dictionary = translations[normalizedLang] || translations.ru || {};

  document.querySelectorAll('[data-i18n]').forEach(element => {
    const key = element.dataset.i18n;
    const attr = element.dataset.i18nAttr || element.dataset.i18nTarget;
    const translation = getTranslation(normalizedLang, key);

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
    const translation = getTranslation(normalizedLang, key);
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
    const isActive = button.dataset.lang === normalizedLang;
    button.classList.toggle('is-active', isActive);
    button.classList.toggle('lang-switch__active', isActive);
    button.setAttribute('aria-pressed', isActive ? 'true' : 'false');
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

function initGallerySlider() {
  const slider = document.querySelector('.gallery-slider');
  if (!slider || slider.dataset.sliderReady === 'true') {
    return;
  }

  const viewport = slider.querySelector('.gallery-slider__viewport');
  const slides = Array.from(slider.querySelectorAll('.slide'));
  const nextButton = slider.querySelector('.next');
  const prevButton = slider.querySelector('.prev');

  if (!viewport || slides.length < 2) {
    return;
  }

  slider.dataset.sliderReady = 'true';
  let currentSlide = 0;
  let timerId;

  const renderSlides = () => {
    slides.forEach((slide, index) => {
      slide.setAttribute('aria-hidden', index === currentSlide ? 'false' : 'true');
    });
    viewport.scrollTo({
      left: viewport.clientWidth * currentSlide,
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
    });
  };

  const goToSlide = direction => {
    currentSlide = (currentSlide + direction + slides.length) % slides.length;
    renderSlides();
  };

  const restartTimer = () => {
    window.clearInterval(timerId);
    timerId = window.setInterval(() => goToSlide(1), 10000);
  };

  nextButton?.addEventListener('click', () => {
    goToSlide(1);
    restartTimer();
  });
  prevButton?.addEventListener('click', () => {
    goToSlide(-1);
    restartTimer();
  });

  slider.addEventListener('mouseenter', () => window.clearInterval(timerId));
  slider.addEventListener('mouseleave', restartTimer);
  slider.addEventListener('focusin', () => window.clearInterval(timerId));
  slider.addEventListener('focusout', restartTimer);

  renderSlides();
  restartTimer();
}

function dispatchLayoutReady() {
  document.dispatchEvent(new CustomEvent('medlibrary:layout-ready'));
}

function injectLayout(components) {
  const app = document.getElementById('app');
  if (!app) return;

  app.setAttribute('aria-busy', 'false');
  app.innerHTML = `
    <div class="page">
      ${components.header || ''}
      <main id="main-content" tabindex="-1">
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
    initGallerySlider();
    dispatchLayoutReady();
  } catch (error) {
    console.error(error);
    const app = document.getElementById('app');
    if (app) {
      app.setAttribute('aria-busy', 'false');
      app.innerHTML = '<p class="text-center app-error" role="alert">Не удалось загрузить интерфейс. Попробуйте обновить страницу.</p>';
    }
  }
}

document.addEventListener('DOMContentLoaded', init);
