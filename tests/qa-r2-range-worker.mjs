import assert from 'node:assert/strict';
import workerModule from '../cloudflare/pdf-r2-worker.mjs';

const ORIGIN = 'https://medlib.example';
const SIZE = 4096;
const ETAG = '"test-etag"';

function metadataObject(overrides = {}) {
  return {
    size: SIZE,
    httpEtag: ETAG,
    uploaded: new Date('2026-08-21T00:00:00Z'),
    httpMetadata: { contentType: 'application/pdf' },
    writeHttpMetadata(headers) {
      headers.set('Content-Type', 'application/pdf');
    },
    ...overrides,
  };
}

function makeEnv({ invalidRange = false } = {}) {
  return {
    CORS_ORIGINS: ORIGIN,
    MEDLIB_BUCKET: {
      async head(key) {
        assert.equal(key, 'BooksDB/book.pdf');
        return metadataObject();
      },
      async get(key, options) {
        assert.equal(key, 'BooksDB/book.pdf');
        assert.ok(options?.range instanceof Headers, 'R2 range input must preserve request headers');
        assert.equal(options.range.get('Range'), 'bytes=0-1023');
        if (invalidRange) throw new Error('InvalidRange: requested range not satisfiable');
        return metadataObject({
          range: { offset: 0, length: 1024 },
          body: new Uint8Array(1024),
        });
      },
    },
  };
}

const rangeRequest = new Request('https://books.example/pdf/BooksDB/book.pdf', {
  method: 'GET',
  headers: {
    Origin: ORIGIN,
    Range: 'bytes=0-1023',
  },
});
const rangeResponse = await workerModule.fetch(rangeRequest, makeEnv());
assert.equal(rangeResponse.status, 206);
assert.equal(rangeResponse.headers.get('Content-Type'), 'application/pdf');
assert.equal(rangeResponse.headers.get('Accept-Ranges'), 'bytes');
assert.equal(rangeResponse.headers.get('Content-Range'), `bytes 0-1023/${SIZE}`);
assert.equal(rangeResponse.headers.get('Content-Length'), '1024');
assert.equal(rangeResponse.headers.get('Access-Control-Allow-Origin'), ORIGIN);
assert.match(rangeResponse.headers.get('Access-Control-Expose-Headers') || '', /Content-Range/);
assert.equal((await rangeResponse.arrayBuffer()).byteLength, 1024);

const headRequest = new Request('https://books.example/pdf/BooksDB/book.pdf', {
  method: 'HEAD',
  headers: { Origin: ORIGIN },
});
const headResponse = await workerModule.fetch(headRequest, makeEnv());
assert.equal(headResponse.status, 200);
assert.equal(headResponse.headers.get('Accept-Ranges'), 'bytes');
assert.equal(headResponse.headers.get('Content-Length'), String(SIZE));
assert.equal(headResponse.headers.get('ETag'), ETAG);
assert.equal((await headResponse.arrayBuffer()).byteLength, 0);

const invalidRangeResponse = await workerModule.fetch(rangeRequest, makeEnv({ invalidRange: true }));
assert.equal(invalidRangeResponse.status, 416);
assert.equal(invalidRangeResponse.headers.get('Accept-Ranges'), 'bytes');
assert.equal(invalidRangeResponse.headers.get('Content-Range'), `bytes */${SIZE}`);
assert.equal(invalidRangeResponse.headers.get('Access-Control-Allow-Origin'), ORIGIN);

const optionsResponse = await workerModule.fetch(new Request('https://books.example/pdf/BooksDB/book.pdf', {
  method: 'OPTIONS',
  headers: { Origin: ORIGIN },
}), makeEnv());
assert.equal(optionsResponse.status, 204);
assert.match(optionsResponse.headers.get('Access-Control-Allow-Headers') || '', /Range/);

console.log('qa-r2-range-worker: PASS');
