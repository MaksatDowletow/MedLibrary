import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const code = fs.readFileSync(new URL('../assets/catalog.js', import.meta.url), 'utf8');
const context = {
  window: { MedLibraryConfig: {} },
  console,
  fetch: async () => { throw new Error('not used'); },
};
vm.createContext(context);
vm.runInContext(code, context);

const { isReaderAvailable, readerUnavailableReason } = context.window.MedLibraryCatalog;
assert.equal(typeof isReaderAvailable, 'function');

assert.equal(isReaderAvailable({
  pdfAvailable: true,
  readAvailable: true,
  summaryMeta: 'Çeşme: Metadata (PDF baglanyşygy tapylmady)',
  summary: 'Bu kitap üçin degişli PDF faýly tapylmady.',
}), false, 'contradictory metadata must not open the reader');

assert.equal(isReaderAvailable({
  pdfStatus: 'verified',
  pdfAvailable: true,
  readAvailable: true,
  summaryMeta: 'old stale text: PDF baglanyşygy tapylmady',
}), true, 'an explicit storage verification must override stale summary text');

assert.equal(isReaderAvailable({ pdfAvailable: false, readAvailable: false }), false);
assert.equal(isReaderAvailable({
  pdfAvailable: true,
  readAvailable: true,
  legacy: { pdfPath: 'BooksDB/book.pdf' },
  summaryMeta: 'Çeşme: BooksDB PDF',
}), true);

assert.match(readerUnavailableReason({
  pdfAvailable: true,
  readAvailable: true,
  summary: 'PDF faýly tapylmady',
}), /PDF/i);

console.log('PASS qa-pdf-availability-gate');
