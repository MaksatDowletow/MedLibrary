(function () {
  'use strict';

  const config = window.MedLibraryConfig || {};
  const catalogUrl = config.catalogUrl || 'assets/data/library.json';
  const emptyCatalog = Object.freeze({
    updatedAt: '2026-05-31',
    books: [],
    categories: [],
    languages: [],
  });

  function normalizeArray(value) {
    return Array.isArray(value) ? value : [];
  }

  function normalizeCatalog(data) {
    const source = data && typeof data === 'object' ? data : {};
    return {
      updatedAt: source.updatedAt || emptyCatalog.updatedAt,
      books: normalizeArray(source.books),
      categories: normalizeArray(source.categories),
      languages: normalizeArray(source.languages),
    };
  }

  async function loadCatalog() {
    try {
      const response = await fetch(catalogUrl, { cache: 'no-cache' });
      if (!response.ok) {
        throw new Error(`Catalog request failed: ${response.status}`);
      }
      return normalizeCatalog(await response.json());
    } catch (error) {
      console.warn('MedLibrary catalog could not be loaded; using an empty catalog.', error);
      return { ...emptyCatalog };
    }
  }

  function bookMatches(book, query, category, language) {
    const text = [book.title, book.name, book.author, book.authors, book.publisher, book.category, book.language]
      .filter(Boolean)
      .join(' ')
      .toLocaleLowerCase();
    const normalizedQuery = (query || '').trim().toLocaleLowerCase();
    const selectedCategory = (category || '').trim();
    const selectedLanguage = (language || '').trim();

    return (!normalizedQuery || text.includes(normalizedQuery))
      && (!selectedCategory || String(book.category || book.categoryId || '') === selectedCategory)
      && (!selectedLanguage || String(book.language || book.languageId || '') === selectedLanguage);
  }

  window.MedLibraryCatalog = {
    emptyCatalog,
    loadCatalog,
    normalizeCatalog,
    bookMatches,
  };
}());
