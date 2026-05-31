(function () {
  'use strict';

  document.addEventListener('DOMContentLoaded', async () => {
    const container = document.querySelector('[data-reader-content]');
    if (!container) return;

    const loader = window.MedLibraryCatalog?.loadCatalog;
    const catalog = loader ? await loader() : { books: [] };
    const id = new URLSearchParams(window.location.search).get('id');
    const book = catalog.books.find((item, index) => String(item.id || index) === String(id));

    if (!book) {
      container.innerHTML = '<div class="empty-state" role="status">Häzirlikçe maglumat ýok</div>';
      return;
    }

    container.innerHTML = `
      <article class="detail-card">
        <h2>${String(book.title || book.name || 'Kitap').replace(/[<>&]/g, '')}</h2>
        <p>Bu kitap üçin okalýan faýl entek goşulmady.</p>
      </article>
    `;
  });
}());
