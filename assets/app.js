(function () {
  'use strict';

  const config = window.MedLibraryConfig || {};
  const emptyMessage = config.emptyMessage || 'Häzirlikçe maglumat ýok';
  const categoriesEmptyMessage = config.categoriesEmptyMessage || 'Kategoriýa maglumatlary entek goşulmady';

  const state = {
    catalog: { updatedAt: '2026-05-31', books: [], categories: [], languages: [] },
  };

  function qs(selector, root = document) {
    return root.querySelector(selector);
  }

  function qsa(selector, root = document) {
    return Array.from(root.querySelectorAll(selector));
  }

  function getPageName() {
    const fromBody = document.body?.dataset.page;
    if (fromBody) return fromBody;
    const path = window.location.pathname.split('/').pop() || 'index.html';
    return path.replace('.html', '') || 'index';
  }

  function setText(selector, value) {
    const node = qs(selector);
    if (node) node.textContent = value;
  }

  function emptyBlock(message = emptyMessage) {
    const element = document.createElement('div');
    element.className = 'empty-state';
    element.setAttribute('role', 'status');
    element.textContent = message;
    return element;
  }

  function getBookTitle(book) {
    return book.title || book.name || book.bookName || 'Ady görkezilmedik kitap';
  }

  function getBookAuthor(book) {
    return book.author || book.authors || book.authorName || '';
  }

  function isReaderAvailable(book) {
    const checker = window.MedLibraryCatalog?.isReaderAvailable;
    return typeof checker === 'function' ? checker(book) : Boolean(book?.pdfAvailable !== false && book?.readAvailable !== false);
  }

  function readerUnavailableReason(book) {
    const getter = window.MedLibraryCatalog?.readerUnavailableReason;
    return typeof getter === 'function' ? getter(book) : 'PDF häzir elýeterli däl.';
  }

  function renderBookList(container, books) {
    container.innerHTML = '';
    if (!books.length) {
      container.appendChild(emptyBlock(emptyMessage));
      return;
    }

    const list = document.createElement('div');
    list.className = 'catalog-grid';
    books.forEach((book, index) => {
      const card = document.createElement('article');
      card.className = 'catalog-card';
      const title = getBookTitle(book);
      const author = getBookAuthor(book);
      const readable = isReaderAvailable(book);
      card.innerHTML = `
        <h3>${escapeHtml(title)}</h3>
        ${author ? `<p>${escapeHtml(author)}</p>` : ''}
        <dl>
          ${book.category ? `<div><dt>Kategoriýa</dt><dd>${escapeHtml(book.category)}</dd></div>` : ''}
          ${book.language ? `<div><dt>Dil</dt><dd>${escapeHtml(book.language)}</dd></div>` : ''}
        </dl>
        ${readable
          ? '<span class="reader-availability reader-availability--ok">PDF taýýar</span>'
          : `<span class="reader-availability reader-availability--off" title="${escapeHtml(readerUnavailableReason(book))}">PDF elýeterli däl</span>`}
        <a class="button button--small" href="book.html?id=${encodeURIComponent(book.id || index)}">Giňişleýin</a>
      `;
      list.appendChild(card);
    });
    container.appendChild(list);
  }

  function escapeHtml(value) {
    return String(value)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function populateSelect(selector, items, placeholder) {
    const select = qs(selector);
    if (!select) return;
    select.innerHTML = `<option value="">${escapeHtml(placeholder)}</option>`;
    items.forEach((item) => {
      const option = document.createElement('option');
      option.value = String(item.id || item.slug || item.name || item.title || item);
      option.textContent = String(item.name || item.title || item.label || item);
      select.appendChild(option);
    });
  }

  function initBooksPage() {
    const container = qs('[data-books-list]');
    if (!container) return;

    populateSelect('[data-category-filter]', state.catalog.categories, 'Ähli kategoriýalar');
    populateSelect('[data-language-filter]', state.catalog.languages, 'Ähli diller');

    const renderFiltered = () => {
      const query = qs('[data-search-input]')?.value || '';
      const category = qs('[data-category-filter]')?.value || '';
      const language = qs('[data-language-filter]')?.value || '';
      const matcher = window.MedLibraryCatalog?.bookMatches || (() => true);
      const books = state.catalog.books.filter((book) => matcher(book, query, category, language));
      renderBookList(container, books);
    };

    qsa('[data-search-input], [data-category-filter], [data-language-filter]').forEach((control) => {
      control.addEventListener('input', renderFiltered);
      control.addEventListener('change', renderFiltered);
    });

    renderFiltered();
  }

  function renderNamedList(selector, items, emptyText) {
    const container = qs(selector);
    if (!container) return;
    container.innerHTML = '';
    if (!items.length) {
      container.appendChild(emptyBlock(emptyText));
      return;
    }
    const list = document.createElement('div');
    list.className = 'simple-list';
    items.forEach((item) => {
      const card = document.createElement('article');
      card.className = 'simple-card';
      card.innerHTML = `<h3>${escapeHtml(item.name || item.title || item.label || item)}</h3>`;
      list.appendChild(card);
    });
    container.appendChild(list);
  }

  function initIndexPage() {
    setText('[data-updated-at]', state.catalog.updatedAt || '2026-05-31');
    setText('[data-book-count]', String(state.catalog.books.length));
    const preview = qs('[data-catalog-preview]');
    if (preview) renderBookList(preview, state.catalog.books.slice(0, 6));
  }

  function initBookDetailPage() {
    const container = qs('[data-book-detail]');
    if (!container) return;
    const id = new URLSearchParams(window.location.search).get('id');
    const book = state.catalog.books.find((item, index) => String(item.id || index) === String(id));
    container.innerHTML = '';
    if (!book) {
      container.appendChild(emptyBlock(emptyMessage));
      return;
    }

    const title = getBookTitle(book);
    const readable = isReaderAvailable(book);
    const readerAction = readable
      ? `<a class="button" href="reader.html?id=${encodeURIComponent(book.id || id || '')}">PDF okaýjyny aç</a>`
      : `<div class="reader-unavailable" role="status"><strong>PDF okaýjy elýeterli däl.</strong><p>${escapeHtml(readerUnavailableReason(book))}</p></div>`;

    container.innerHTML = `
      <article class="detail-card">
        <h2>${escapeHtml(title)}</h2>
        ${getBookAuthor(book) ? `<p>${escapeHtml(getBookAuthor(book))}</p>` : ''}
        ${readerAction}
      </article>
    `;
  }

  function initPage() {
    initIndexPage();
    initBooksPage();
    initBookDetailPage();
    renderNamedList('[data-categories-list]', state.catalog.categories, categoriesEmptyMessage);
    renderNamedList('[data-languages-list]', state.catalog.languages, emptyMessage);
  }

  document.addEventListener('DOMContentLoaded', async () => {
    const loader = window.MedLibraryCatalog?.loadCatalog;
    if (loader) {
      state.catalog = await loader();
    }
    document.body.classList.add(`page-${getPageName()}`);
    initPage();
  });
}());
