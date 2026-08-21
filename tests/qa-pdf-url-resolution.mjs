import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const source = fs.readFileSync(new URL('../assets/reader.js', import.meta.url), 'utf8');
const pageUrl = new URL('https://medlib.example/reader/2054682f-fe16-43d9-9907-e1db5fe816fd');
const window = { MedLibraryConfig: {} };
const document = {
  currentScript: { src: 'https://medlib.example/assets/reader.js' },
  querySelector() { return null; },
  addEventListener() {},
};
const context = {
  window,
  document,
  location: {
    href: pageUrl.href,
    origin: pageUrl.origin,
    protocol: pageUrl.protocol,
    search: pageUrl.search,
    reload() {},
  },
  URL,
  URLSearchParams,
  console,
  setTimeout,
  clearTimeout,
  AbortController,
  CustomEvent: class CustomEvent {},
};
vm.createContext(context);
vm.runInContext(source, context, { filename: 'assets/reader.js' });
const resolvePdfUrl = window.MedLibraryReader.resolvePdfUrl;

assert.equal(
  resolvePdfUrl({ pdfPath: 'BooksDB/707. 1429.pdf' }, '2054682f-fe16-43d9-9907-e1db5fe816fd'),
  'https://medlib.example/api/books/2054682f-fe16-43d9-9907-e1db5fe816fd/pdf',
  'BooksDB storage keys must use the protected API endpoint',
);
assert.equal(
  resolvePdfUrl({ legacy: { pdfPath: 'BooksDB/281. Manning.pdf' } }, '07466fdf-693f-4de3-a364-4871c62f74fe'),
  'https://medlib.example/api/books/07466fdf-693f-4de3-a364-4871c62f74fe/pdf',
  'legacy BooksDB storage keys must not resolve under /reader/',
);
assert.equal(
  resolvePdfUrl({ pdfUrl: 'https://cdn.example/book.pdf', pdfPath: 'BooksDB/book.pdf' }, 'book-1'),
  'https://cdn.example/book.pdf',
  'an explicit absolute PDF URL remains supported',
);
window.MedLibraryConfig = { pdfEndpoint: 'https://api.example/books/{id}/pdf' };
assert.equal(
  resolvePdfUrl({ pdfPath: 'BooksDB/book.pdf' }, 'book 1'),
  'https://api.example/books/book%201/pdf',
  'configured PDF endpoints are used for storage keys',
);

console.log('qa-pdf-url-resolution: PASS');
