/**
 * Request pipeline, independent of Bun.serve so it can be tested directly.
 *
 * Order: host allow-list → (OPTIONS) → /api: body size → CSRF → auth → router
 *        → data-version bump → security headers. Non-API: static files.
 */
import path from 'path';
import { handleApiRequest } from './routes.js';
import { ALLOWED_HOSTS, isDev, SECURITY_HEADERS } from './config.js';
import { checkCsrf, checkBodySize, checkHost, parseAllowedHosts } from './security.js';
import { getAuth } from './auth.js';
import { bumpDataVersion } from './dataVersion.js';

const allowedHosts = parseAllowedHosts(ALLOWED_HOSTS);
const MUTATING = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

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

function resolveDistPath(distRoot, urlPathname) {
  const relative = urlPathname === '/' ? 'index.html' : urlPathname.replace(/^\//, '');
  const resolved = path.resolve(distRoot, relative);
  if (!resolved.startsWith(distRoot + path.sep) && resolved !== distRoot) return null;
  return resolved;
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
  const distRoot = path.resolve(distDir);

  async function handleApi(req, url) {
    const blocked = checkBodySize(req, url) || checkCsrf(req, url) || await auth.handle(req, url);
    if (blocked) return blocked;

    const response = await handleApiRequest(req, url);
    if (MUTATING.has(req.method) && response.status < 400) bumpDataVersion();
    return response;
  }

  async function handleStatic(req, url) {
    const filePath = resolveDistPath(distRoot, url.pathname);
    if (!filePath) return new Response('Forbidden', { status: 403 });
    const file = Bun.file(filePath);
    if (await file.exists()) return new Response(file);
    return new Response(Bun.file(path.join(distRoot, 'index.html')));
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
        return withSecurityHeaders(await handleStatic(req, url));
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
