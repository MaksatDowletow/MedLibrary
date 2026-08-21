(function () {
  'use strict';

  const SCRIPT_URL = document.currentScript?.src || new URL('./assets/reader.js', location.href).href;
  const ASSET_BASE = new URL('./', SCRIPT_URL);
  const PDFJS_VERSION = '4.10.38';
  const state = {
    pdf: null,
    loadingTask: null,
    page: 1,
    scale: 1,
    fitWidth: true,
    renderController: null,
    currentText: '',
    book: null,
  };

  const $ = (selector) => document.querySelector(selector);
  const cleanText = (value) => String(value ?? '').replace(/[<>&]/g, '').trim();
  const clamp = (value, min, max) => Math.min(max, Math.max(min, Number(value) || min));

  function setStatus(message, kind = 'info') {
    const el = $('[data-reader-status]');
    if (!el) return;
    el.hidden = !message;
    el.textContent = message || '';
    el.dataset.kind = kind;
  }

  function showError(message, details = '') {
    const box = $('[data-reader-error]');
    if (!box) return;
    box.hidden = false;
    box.innerHTML = '';
    const title = document.createElement('strong');
    title.textContent = 'PDF görkezmek başartmady.';
    const body = document.createElement('p');
    body.textContent = message || 'Nämälim näsazlyk.';
    const meta = document.createElement('small');
    meta.textContent = details;
    const retry = document.createElement('button');
    retry.type = 'button';
    retry.className = 'button';
    retry.textContent = 'Gaýtadan synanyş';
    retry.addEventListener('click', () => location.reload(), { once: true });
    box.append(title, body, meta, retry);
    setStatus('PDF reader ýalňyşlygy', 'error');
  }

  function hideError() {
    const box = $('[data-reader-error]');
    if (box) box.hidden = true;
  }

  async function loadPdfJs() {
    const local = new URL('pdfjs/pdf.min.mjs', ASSET_BASE).href;
    const localWorker = new URL('pdfjs/pdf.worker.min.mjs', ASSET_BASE).href;
    try {
      const mod = await import(local);
      mod.GlobalWorkerOptions.workerSrc = localWorker;
      return mod;
    } catch (_) {
      const remote = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${PDFJS_VERSION}/build/pdf.min.mjs`;
      const remoteWorker = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${PDFJS_VERSION}/build/pdf.worker.min.mjs`;
      const mod = await import(remote);
      mod.GlobalWorkerOptions.workerSrc = remoteWorker;
      return mod;
    }
  }

  function resolveBookId() {
    const params = new URLSearchParams(location.search);
    const queryId = params.get('book') || params.get('id') || '';
    if (queryId) return queryId;

    const parts = String(location.pathname || '').split('/').filter(Boolean);
    const readerIndex = parts.findIndex((part) => part.toLowerCase() === 'reader');
    if (readerIndex >= 0 && parts[readerIndex + 1]) {
      try {
        return decodeURIComponent(parts[readerIndex + 1]);
      } catch (_) {
        return parts[readerIndex + 1];
      }
    }
    return '';
  }

  function safeUrl(value) {
    if (!value) return '';
    try {
      const url = new URL(String(value), location.href);
      if (!/^https?:$/.test(url.protocol)) return '';
      return url.href;
    } catch (_) {
      return '';
    }
  }

  function isStorageKey(value) {
    const raw = String(value ?? '').trim();
    if (!raw) return false;
    return /^(?:BooksDB[\\/]|vault[\\/]books[\\/])/i.test(raw);
  }

  function resolvePdfUrl(book, id) {
    const params = new URLSearchParams(location.search);
    const explicit = safeUrl(params.get('src'));
    if (explicit) return explicit;

    const candidates = [
      book?.pdfUrl,
      book?.pdfURL,
      book?.pdfPath,
      book?.pdf,
      book?.fileUrl,
      book?.legacy?.pdfPath,
    ];
    for (const candidate of candidates) {
      // BooksDB/... and vault/books/... are storage keys, not browser URLs.
      // Resolving them against /reader/<id> creates a false URL such as
      // /reader/BooksDB/... and bypasses the protected PDF API/R2 proxy.
      if (isStorageKey(candidate)) continue;
      const url = safeUrl(candidate);
      if (url) return url;
    }

    const config = window.MedLibraryConfig || {};
    if (id && config.pdfEndpoint) {
      return safeUrl(String(config.pdfEndpoint).replace('{id}', encodeURIComponent(id)));
    }
    if (id && location.protocol !== 'file:') {
      return new URL(`/api/books/${encodeURIComponent(id)}/pdf`, location.origin).href;
    }
    return '';
  }

  async function probePdf(url) {
    const response = await fetch(url, {
      method: 'GET',
      credentials: 'include',
      headers: { Range: 'bytes=0-1023' },
      cache: 'no-store',
    });
    if (response.status === 401) throw new Error('Kitaby açmak üçin giriş etmeli.');
    if (response.status === 403) throw new Error('Bu kitaba giriş rugsady ýok ýa-da abuna möhleti gutardy.');
    if (response.status === 404) throw new Error('Bu kitap üçin PDF faýly tapylmady.');
    if (response.status === 416) throw new Error('PDF byte-range jogaby nädogry.');
    if (!response.ok && response.status !== 206) throw new Error(`PDF serweri ${response.status} jogabyny berdi.`);

    const contentType = String(response.headers.get('Content-Type') || '').toLowerCase();
    if (contentType && !contentType.includes('application/pdf') && !contentType.includes('octet-stream')) {
      throw new Error(`PDF endpoint nädogry Content-Type berdi: ${contentType}`);
    }
    if (response.status === 206 && !response.headers.get('Content-Range')) {
      throw new Error('206 jogaby bar, emma Content-Range ýok.');
    }

    let prefix = new Uint8Array(0);
    if (response.body?.getReader) {
      const reader = response.body.getReader();
      const chunks = [];
      let length = 0;
      try {
        while (length < 1024) {
          const { value, done } = await reader.read();
          if (done) break;
          if (value?.length) { chunks.push(value); length += value.length; }
        }
      } finally {
        try { await reader.cancel(); } catch (_) {}
      }
      prefix = new Uint8Array(Math.min(length, 1024));
      let offset = 0;
      for (const chunk of chunks) {
        const take = Math.min(chunk.length, prefix.length - offset);
        if (take <= 0) break;
        prefix.set(chunk.subarray(0, take), offset);
        offset += take;
      }
    } else {
      prefix = new Uint8Array((await response.arrayBuffer()).slice(0, 1024));
    }
    const ascii = new TextDecoder('latin1').decode(prefix);
    if (!ascii.includes('%PDF-')) throw new Error('Serwerden PDF ýerine başga mazmun geldi.');
  }

  function currentScaleForPage(page) {
    if (!state.fitWidth) return state.scale;
    const stage = $('[data-reader-stage]');
    const base = page.getViewport({ scale: 1 });
    const available = Math.max(240, (stage?.clientWidth || innerWidth) - 36);
    return clamp(available / base.width, .25, 3.5);
  }

  async function renderCurrentPage(pdfjsLib, renderer) {
    if (!state.pdf) return;
    state.renderController?.abort();
    state.renderController = new AbortController();
    const signal = state.renderController.signal;
    const canvas = $('[data-reader-canvas]');
    const shell = $('[data-reader-page-shell]');
    const pageInput = $('[data-reader-page-input]');
    const total = $('[data-reader-page-total]');

    hideError();
    setStatus(`Sahypa ${state.page} görkezilýär…`);
    const page = await state.pdf.getPage(state.page);
    const scale = currentScaleForPage(page);

    let result;
    try {
      result = await renderer.renderPdfPageRobust({
        page,
        canvas,
        scale,
        signal,
        onState(info) {
          if (info.phase === 'retry-low-resolution') setStatus('Canvas boş galdy — howpsuz pes ölçegde gaýtadan render edilýär…');
        },
      });
    } catch (error) {
      if (error?.name === 'AbortError' || /cancel/i.test(String(error?.message || ''))) return;
      showError(error?.message || 'Sahypa render edilmedi.', error?.code || error?.name || 'PDF_RENDER_ERROR');
      return;
    }

    if (shell && result.canvas.parentNode !== shell) shell.append(result.canvas);
    const text = result.textContent?.items?.map((item) => item.str || '').join(' ').replace(/\s+/g, ' ').trim() || '';
    state.currentText = text;

    window.dispatchEvent(new CustomEvent('medlibrary:pdf-page-text', {
      detail: { pageNumber: state.page, text, book: state.book },
    }));

    if (pageInput) pageInput.value = String(state.page);
    if (total) total.textContent = String(state.pdf.numPages);
    setStatus(`Sahypa ${state.page}/${state.pdf.numPages} taýýar`, 'ok');
  }

  function bindControls(pdfjsLib, renderer) {
    $('[data-reader-prev]')?.addEventListener('click', () => {
      if (!state.pdf || state.page <= 1) return;
      state.page -= 1;
      renderCurrentPage(pdfjsLib, renderer);
    });
    $('[data-reader-next]')?.addEventListener('click', () => {
      if (!state.pdf || state.page >= state.pdf.numPages) return;
      state.page += 1;
      renderCurrentPage(pdfjsLib, renderer);
    });
    $('[data-reader-page-input]')?.addEventListener('change', (event) => {
      if (!state.pdf) return;
      state.page = Math.round(clamp(event.target.value, 1, state.pdf.numPages));
      renderCurrentPage(pdfjsLib, renderer);
    });
    $('[data-reader-zoom-in]')?.addEventListener('click', () => {
      state.fitWidth = false;
      state.scale = clamp(state.scale * 1.2, .25, 4);
      renderCurrentPage(pdfjsLib, renderer);
    });
    $('[data-reader-zoom-out]')?.addEventListener('click', () => {
      state.fitWidth = false;
      state.scale = clamp(state.scale / 1.2, .25, 4);
      renderCurrentPage(pdfjsLib, renderer);
    });
    $('[data-reader-fit]')?.addEventListener('click', () => {
      state.fitWidth = true;
      renderCurrentPage(pdfjsLib, renderer);
    });
    window.addEventListener('resize', () => {
      if (!state.fitWidth || !state.pdf) return;
      clearTimeout(window.__medlibReaderResizeTimer);
      window.__medlibReaderResizeTimer = setTimeout(() => renderCurrentPage(pdfjsLib, renderer), 160);
    });
  }

  document.addEventListener('DOMContentLoaded', async () => {
    const container = $('[data-reader-content]');
    if (!container) return;

    const loader = window.MedLibraryCatalog?.loadCatalog;
    const catalog = loader ? await loader() : { books: [] };
    const id = resolveBookId();
    const book = catalog.books?.find((item, index) => String(item.id || index) === String(id)) || null;
    state.book = book;
    const title = cleanText(book?.title || book?.name || new URLSearchParams(location.search).get('title') || 'PDF okyjy');
    const titleEl = $('[data-reader-title]');
    if (titleEl) titleEl.textContent = title;

    const availabilityChecker = window.MedLibraryCatalog?.isReaderAvailable;
    if (book && typeof availabilityChecker === 'function' && !availabilityChecker(book)) {
      const reason = window.MedLibraryCatalog?.readerUnavailableReason?.(book) || 'PDF elýeterliligi tassyklanmady.';
      showError(reason, 'PDF_NOT_AVAILABLE');
      return;
    }

    const pdfUrl = resolvePdfUrl(book, id);
    if (!pdfUrl) {
      showError('PDF salgysy tapylmady.', 'PDF_URL_MISSING');
      return;
    }

    try {
      setStatus('PDF endpoint barlanýar…');
      await probePdf(pdfUrl);
      setStatus('PDF.js ýüklenýär…');
      const [pdfjsLib, renderer] = await Promise.all([
        loadPdfJs(),
        import(new URL('pdf-render-recovery.mjs', ASSET_BASE).href),
      ]);
      const loadingTask = pdfjsLib.getDocument({
        url: pdfUrl,
        withCredentials: true,
        disableRange: false,
        disableStream: false,
        disableAutoFetch: false,
      });
      state.loadingTask = loadingTask;
      loadingTask.onProgress = ({ loaded, total }) => {
        if (total) setStatus(`PDF ýüklenýär: ${Math.round((loaded / total) * 100)}%`);
      };
      state.pdf = await loadingTask.promise;
      state.page = 1;
      bindControls(pdfjsLib, renderer);
      await renderCurrentPage(pdfjsLib, renderer);
    } catch (error) {
      showError(error?.message || 'PDF açylmady.', error?.code || error?.name || 'PDF_LOAD_ERROR');
    }
  });

  window.MedLibraryReader = {
    getCurrentPageText: () => state.currentText,
    getCurrentPage: () => state.page,
    resolveBookId,
    resolvePdfUrl,
  };
}());
