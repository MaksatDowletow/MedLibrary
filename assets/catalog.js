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

  function normalizedStatus(book) {
    return String(book?.pdfStatus || book?.storageStatus || '').trim().toLowerCase();
  }

  function hasMissingPdfEvidence(book) {
    const status = normalizedStatus(book);
    if (['missing', 'unavailable', 'deleted', 'not_found', 'not-found', 'broken'].includes(status)) return true;
    if (String(book?.readerUnavailableReason || '').trim()) return true;

    const summaryMeta = String(book?.summaryMeta || '').toLocaleLowerCase();
    const summary = String(book?.summary || '').toLocaleLowerCase();
    return summaryMeta.includes('pdf baglanyşygy tapylmady')
      || summaryMeta.includes('pdf faýly tapylmady')
      || summary.includes('pdf faýly tapylmady');
  }

  function isReaderAvailable(book) {
    if (!book || typeof book !== 'object') return false;

    const status = normalizedStatus(book);
    if (['ready', 'verified', 'available'].includes(status)) return true;
    if (book.storageVerified === true || book.pdfVerified === true) return true;

    if (book.pdfAvailable === false || book.readAvailable === false) return false;
    if (hasMissingPdfEvidence(book)) return false;

    return Boolean(
      book.pdfAvailable === true
      || book.readAvailable === true
      || book.pdfUrl
      || book.pdfURL
      || book.pdfPath
      || book.pdf
      || book.fileUrl
      || book.legacy?.pdfPath
      || book.links?.pdf
      || book.links?.reader
    );
  }

  function readerUnavailableReason(book) {
    const explicit = String(book?.readerUnavailableReason || '').trim();
    if (explicit) return explicit;
    if (hasMissingPdfEvidence(book)) return 'Bu kitap üçin tassyklanan PDF faýly tapylmady.';
    if (book?.pdfAvailable === false || book?.readAvailable === false) return 'Bu kitap häzir PDF okaýjyda elýeterli däl.';
    return 'PDF elýeterliligi tassyklanmady.';
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
    isReaderAvailable,
    readerUnavailableReason,
  };
}());
