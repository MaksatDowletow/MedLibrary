function corsHeaders(request, env) {
  const origin = request.headers.get('Origin') || '';
  const allowed = String(env.CORS_ORIGINS || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  const allowOrigin = !origin || !allowed.length || allowed.includes(origin) ? (origin || '*') : '';
  const headers = new Headers();
  if (allowOrigin) headers.set('Access-Control-Allow-Origin', allowOrigin);
  headers.set('Vary', 'Origin');
  headers.set('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
  headers.set('Access-Control-Allow-Headers', 'Range, If-Range, If-None-Match, If-Modified-Since, Authorization, Content-Type');
  headers.set('Access-Control-Expose-Headers', 'Accept-Ranges, Content-Range, Content-Length, Content-Type, ETag, Last-Modified');
  return headers;
}

function applyObjectHeaders(object, headers) {
  object.writeHttpMetadata(headers);
  headers.set('ETag', object.httpEtag);
  headers.set('Accept-Ranges', 'bytes');
  headers.set('Content-Type', headers.get('Content-Type') || object.httpMetadata?.contentType || 'application/pdf');
  headers.set('Cache-Control', 'private, no-store');
  if (object.uploaded) headers.set('Last-Modified', object.uploaded.toUTCString());
}

function objectKeyFromRequest(request) {
  const url = new URL(request.url);
  let pathname = decodeURIComponent(url.pathname);
  pathname = pathname.replace(/^\/+/, '');
  pathname = pathname.replace(/^pdf\//i, '');
  if (!pathname || pathname.includes('\0') || pathname.split('/').some((part) => part === '..')) return '';
  return pathname;
}

function rangeHeaders(object, headers, requestedRange) {
  const returned = object.range;
  if (!requestedRange || !returned) {
    headers.set('Content-Length', String(object.size));
    return 200;
  }

  const offset = Number(returned.offset ?? 0);
  const length = Number(returned.length ?? Math.max(0, object.size - offset));
  const end = Math.max(offset, offset + length - 1);
  headers.set('Content-Range', `bytes ${offset}-${end}/${object.size}`);
  headers.set('Content-Length', String(length));
  return 206;
}

async function notSatisfiable(request, env, key) {
  const metadata = key ? await env.MEDLIB_BUCKET.head(key).catch(() => null) : null;
  const headers = corsHeaders(request, env);
  headers.set('Accept-Ranges', 'bytes');
  if (metadata) headers.set('Content-Range', `bytes */${metadata.size}`);
  return new Response('Range Not Satisfiable', { status: 416, headers });
}

export default {
  async fetch(request, env) {
    const cors = corsHeaders(request, env);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    if (!['GET', 'HEAD'].includes(request.method)) {
      cors.set('Allow', 'GET, HEAD, OPTIONS');
      return new Response('Method Not Allowed', { status: 405, headers: cors });
    }

    const key = objectKeyFromRequest(request);
    if (!key) return new Response('Invalid PDF key', { status: 400, headers: cors });

    if (request.method === 'HEAD') {
      const object = await env.MEDLIB_BUCKET.head(key);
      if (!object) return new Response('Not Found', { status: 404, headers: cors });
      applyObjectHeaders(object, cors);
      cors.set('Content-Length', String(object.size));
      return new Response(null, { status: 200, headers: cors });
    }

    const requestedRange = request.headers.get('Range');
    try {
      const object = await env.MEDLIB_BUCKET.get(key, {
        onlyIf: request.headers,
        range: request.headers,
      });
      if (!object) return new Response('Not Found', { status: 404, headers: cors });
      if (!('body' in object)) {
        applyObjectHeaders(object, cors);
        return new Response(null, { status: 412, headers: cors });
      }

      applyObjectHeaders(object, cors);
      const status = rangeHeaders(object, cors, requestedRange);
      return new Response(object.body, { status, headers: cors });
    } catch (error) {
      const message = String(error?.message || error || '');
      if (requestedRange && (/InvalidRange/i.test(message) || /10039/.test(message))) {
        return notSatisfiable(request, env, key);
      }
      console.error('R2 PDF stream failed', { key, message });
      return new Response('PDF storage error', { status: 502, headers: cors });
    }
  },
};
