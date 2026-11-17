/**
 * Request pipeline, independent of Bun.serve so it can be tested directly.
 *
 * Order: host allow-list → (OPTIONS) → /api: body size → CSRF → auth → router
 *        → data-version bump → security headers. Non-API: static files.
 */
import { handleApiRequest } from './routes.js';
import { ALLOWED_HOSTS, isDev, SECURITY_HEADERS } from './config.js';
import { checkCsrf, checkBodySize, checkHost, parseAllowedHosts } from './security.js';
import { getAuth } from './auth.js';
import { bumpDataVersion, getDataVersion, startedAt } from './dataVersion.js';
import { createStaticHandler } from './static.js';

const allowedHosts = parseAllowedHosts(ALLOWED_HOSTS);
const MUTATING = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/** GET endpoints whose output depends only on DB contents (+ month for budgets). */
const CACHEABLE = new Set([
  '/api/transactions',
  '/api/cards',
  '/api/statements',
  '/api/categories',
  '/api/budgets',
  '/api/recurring',
]);
const GZIP_MIN_BYTES = 1024;

function yearMonthNow() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/** Weak ETag from server start, data version and the exact URL. */
export function apiEtag(url) {
  const key = url.pathname + url.search + (url.pathname === '/api/budgets' ? `@${yearMonthNow()}` : '');
  return `W/"${startedAt.toString(36)}-${getDataVersion()}-${Bun.hash(key).toString(36)}"`;
}

function etagMatches(req, etag) {
  const inm = req.headers.get('if-none-match');
  return Boolean(inm) && inm.split(',').some(t => t.trim() === etag);
}

function acceptsGzip(req) {
  return /\bgzip\b/i.test(req.headers.get('accept-encoding') || '');
}

/** Gzip a JSON/CSV API response when it's worth it. */
async function maybeGzip(req, response) {
  if (!acceptsGzip(req) || response.status === 204 || response.status === 304) return response;
  if (response.headers.has('content-encoding')) return response;
  const type = response.headers.get('content-type') || '';
  if (!/json|csv/.test(type)) return response;
  const body = new Uint8Array(await response.arrayBuffer());
  const headers = new Headers(response.headers);
  headers.append('Vary', 'Accept-Encoding');
  if (body.length < GZIP_MIN_BYTES) {
    return new Response(body, { status: response.status, statusText: response.statusText, headers });
  }
  headers.set('Content-Encoding', 'gzip');
  headers.delete('Content-Length');
  return new Response(Bun.gzipSync(body, { level: 6 }), {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export function withSecurityHeaders(response) {
  const headers = new Headers(response.headers);
  for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
    if (!headers.has(key)) headers.set(key, value);
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

/**
 * Create the fetch handler. Options exist for tests.
 */
export function createApp({
  auth = getAuth(),
  hosts = allowedHosts,
  distDir = './dist',
  serveStatic = !isDev,
} = {}) {
  const handleStatic = createStaticHandler(distDir);

  async function handleApi(req, url) {
    const blocked = checkBodySize(req, url) || checkCsrf(req, url) || await auth.handle(req, url);
    if (blocked) return blocked;

    // Conditional GET: answer 304 before running any SQL (after auth!).
    const cacheable = req.method === 'GET' && CACHEABLE.has(url.pathname);
    const etag = cacheable ? apiEtag(url) : null;
    if (etag && etagMatches(req, etag)) {
      return new Response(null, {
        status: 304,
        headers: { ETag: etag, 'Cache-Control': 'private, no-cache' },
      });
    }

    let response = await handleApiRequest(req, url);
    if (MUTATING.has(req.method) && response.status < 400) bumpDataVersion();

    const headers = new Headers(response.headers);
    if (etag && response.status === 200) {
      headers.set('ETag', etag);
      headers.set('Cache-Control', 'private, no-cache');
    } else if (!headers.has('Cache-Control')) {
      // Financial data: never store other API responses.
      headers.set('Cache-Control', 'no-store');
    }
    response = new Response(response.body, { status: response.status, statusText: response.statusText, headers });
    return maybeGzip(req, response);
  }

  return async function handleRequest(req) {
    const url = new URL(req.url);

    const badHost = checkHost(req, hosts);
    if (badHost) return withSecurityHeaders(badHost);

    // No CORS: the SPA is always same-origin (Vite proxies /api in dev), so
    // every cross-origin preflight is refused.
    if (req.method === 'OPTIONS') {
      return withSecurityHeaders(new Response(null, { status: 204 }));
    }

    if (url.pathname === '/api' || url.pathname.startsWith('/api/')) {
      return withSecurityHeaders(await handleApi(req, url));
    }

    if (serveStatic) {
      try {
        return withSecurityHeaders(handleStatic(req, url));
      } catch (error) {
        console.error('Error serving static file:', error);
        return withSecurityHeaders(new Response('Internal Server Error', { status: 500 }));
      }
    }

    return withSecurityHeaders(new Response(
      'Development mode: Frontend is served by Vite at http://localhost:5173\n' +
      'API is available at http://localhost:3000/api',
      { status: 404 }
    ));
  };
}
