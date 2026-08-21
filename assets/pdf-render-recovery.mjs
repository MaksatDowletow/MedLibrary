const DEFAULT_MAX_CANVAS_PIXELS = 16_000_000;

export function clamp(value, min, max) {
  const n = Number(value);
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, n));
}

export function computeRenderGeometry({
  viewportWidth,
  viewportHeight,
  devicePixelRatio = 1,
  maxCanvasPixels = DEFAULT_MAX_CANVAS_PIXELS,
  maxDevicePixelRatio = 2,
}) {
  const cssWidth = Math.max(1, Number(viewportWidth) || 1);
  const cssHeight = Math.max(1, Number(viewportHeight) || 1);
  let outputScale = clamp(devicePixelRatio, 0.1, maxDevicePixelRatio);
  const cssPixels = cssWidth * cssHeight;
  if (cssPixels * outputScale * outputScale > maxCanvasPixels) {
    outputScale = Math.sqrt(maxCanvasPixels / cssPixels);
    outputScale = clamp(outputScale, 0.1, maxDevicePixelRatio);
  }
  return {
    cssWidth,
    cssHeight,
    outputScale,
    pixelWidth: Math.max(1, Math.floor(cssWidth * outputScale)),
    pixelHeight: Math.max(1, Math.floor(cssHeight * outputScale)),
  };
}

function getVisibleCanvas(canvas) {
  if (!canvas) throw new Error('PDF canvas tapylmady.');
  let active = canvas;
  let ctx = null;
  try {
    ctx = active.getContext('2d', { alpha: false, willReadFrequently: true });
  } catch (_) {
    ctx = null;
  }
  if (!ctx && active.parentNode) {
    const replacement = active.cloneNode(false);
    replacement.removeAttribute('width');
    replacement.removeAttribute('height');
    active.parentNode.replaceChild(replacement, active);
    active = replacement;
    ctx = active.getContext('2d', { alpha: false, willReadFrequently: true });
  }
  if (!ctx) throw new Error('Canvas 2D context döredilmedi.');

  active.hidden = false;
  active.removeAttribute('aria-hidden');
  active.style.display = 'block';
  active.style.visibility = 'visible';
  active.style.opacity = '1';
  active.style.background = '#fff';
  active.style.maxWidth = '100%';
  active.style.height = 'auto';
  return { canvas: active, ctx };
}

function sampleCanvas(ctx, canvas, sampleGrid = 9) {
  if (!canvas.width || !canvas.height) return [];
  const out = [];
  for (let gy = 0; gy < sampleGrid; gy += 1) {
    for (let gx = 0; gx < sampleGrid; gx += 1) {
      const x = Math.min(canvas.width - 1, Math.max(0, Math.floor(((gx + 0.5) / sampleGrid) * canvas.width)));
      const y = Math.min(canvas.height - 1, Math.max(0, Math.floor(((gy + 0.5) / sampleGrid) * canvas.height)));
      try {
        out.push(...ctx.getImageData(x, y, 1, 1).data);
      } catch (_) {
        return [];
      }
    }
  }
  return out;
}

export function pixelSamplesLookBlank(samples, threshold = 248) {
  if (!samples?.length) return false;
  for (let i = 0; i < samples.length; i += 4) {
    const r = samples[i];
    const g = samples[i + 1];
    const b = samples[i + 2];
    const a = samples[i + 3];
    if (a > 12 && (r < threshold || g < threshold || b < threshold)) return false;
  }
  return true;
}

export function shouldRetryBlankCanvas({ samples, hasText = false, operatorCount = 0 }) {
  return pixelSamplesLookBlank(samples) && (Boolean(hasText) || Number(operatorCount) > 0);
}

function isRenderingCancelled(error) {
  return error?.name === 'RenderingCancelledException' || /cancelled/i.test(String(error?.message || ''));
}

function applyGeometry(canvas, ctx, viewport, geometry) {
  canvas.width = geometry.pixelWidth;
  canvas.height = geometry.pixelHeight;
  canvas.style.width = `${geometry.cssWidth}px`;
  canvas.style.height = `${geometry.cssHeight}px`;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  return geometry.outputScale === 1 ? null : [geometry.outputScale, 0, 0, geometry.outputScale, 0, 0];
}

async function getOperatorCount(page) {
  if (!page?.getOperatorList) return 0;
  try {
    const operatorList = await page.getOperatorList();
    return Array.isArray(operatorList?.fnArray) ? operatorList.fnArray.length : 0;
  } catch (_) {
    return 0;
  }
}

export async function renderPdfPageRobust({
  page,
  canvas,
  scale = 1,
  rotation = 0,
  maxCanvasPixels = DEFAULT_MAX_CANVAS_PIXELS,
  maxDevicePixelRatio = 2,
  timeoutMs = 20_000,
  signal,
  onState,
}) {
  if (!page?.getViewport || !page?.render) throw new Error('PDF.js sahypasy nädogry.');

  const { canvas: activeCanvas, ctx } = getVisibleCanvas(canvas);
  const viewport = page.getViewport({ scale: clamp(scale, 0.2, 5), rotation });
  const geometry = computeRenderGeometry({
    viewportWidth: viewport.width,
    viewportHeight: viewport.height,
    devicePixelRatio: globalThis.devicePixelRatio || 1,
    maxCanvasPixels,
    maxDevicePixelRatio,
  });

  const firstTransform = applyGeometry(activeCanvas, ctx, viewport, geometry);
  onState?.({ phase: 'rendering', outputScale: geometry.outputScale });

  let task = page.render({
    canvasContext: ctx,
    viewport,
    transform: firstTransform,
    background: '#ffffff',
    intent: 'display',
  });
  const abortHandler = () => { try { task.cancel(); } catch (_) {} };
  signal?.addEventListener('abort', abortHandler, { once: true });
  let timeout = setTimeout(() => { try { task.cancel(); } catch (_) {} }, timeoutMs);
  try {
    await task.promise;
  } catch (error) {
    if (isRenderingCancelled(error) && !signal?.aborted) {
      onState?.({ phase: 'retry-low-resolution', reason: 'timeout' });
      clearTimeout(timeout);
      const retryGeometry = computeRenderGeometry({
        viewportWidth: viewport.width,
        viewportHeight: viewport.height,
        devicePixelRatio: 1,
        maxCanvasPixels,
        maxDevicePixelRatio: 1,
      });
      const retryTransform = applyGeometry(activeCanvas, ctx, viewport, retryGeometry);
      task = page.render({ canvasContext: ctx, viewport, transform: retryTransform, background: '#ffffff', intent: 'display' });
      timeout = setTimeout(() => { try { task.cancel(); } catch (_) {} }, timeoutMs);
      await task.promise;
    } else {
      throw error;
    }
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener('abort', abortHandler);
  }

  // Text extraction is deliberately AFTER canvas rendering. Translation/OCR
  // cannot block the visual page from becoming visible.
  let textContent = null;
  try {
    textContent = await page.getTextContent({ disableNormalization: false });
  } catch (_) {
    textContent = null;
  }

  const hasText = Boolean(textContent?.items?.some((item) => String(item?.str || '').trim()));
  const samples = sampleCanvas(ctx, activeCanvas);
  let operatorCount = 0;
  if (!hasText && pixelSamplesLookBlank(samples)) {
    // Scanned/image-only PDFs often have no text layer. Inspect the PDF.js
    // operator list only when the rendered canvas looks blank so image pages
    // still receive the low-resolution recovery pass.
    operatorCount = await getOperatorCount(page);
  }

  if (shouldRetryBlankCanvas({ samples, hasText, operatorCount })) {
    onState?.({ phase: 'retry-low-resolution', reason: hasText ? 'blank-canvas' : 'blank-image-canvas' });
    const retryGeometry = computeRenderGeometry({
      viewportWidth: viewport.width,
      viewportHeight: viewport.height,
      devicePixelRatio: 1,
      maxCanvasPixels,
      maxDevicePixelRatio: 1,
    });
    const retryTransform = applyGeometry(activeCanvas, ctx, viewport, retryGeometry);
    const retryTask = page.render({ canvasContext: ctx, viewport, transform: retryTransform, background: '#ffffff', intent: 'display' });
    await retryTask.promise;
  }

  onState?.({ phase: 'rendered', textContent });
  return { canvas: activeCanvas, viewport, textContent };
}
