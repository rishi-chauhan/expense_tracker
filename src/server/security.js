/**
 * Request-level security checks applied in index.js/app.js before routing.
 *
 * CSRF defence (S2) does NOT depend on any cookie or session:
 *   1. Fetch Metadata: Sec-Fetch-Site must be same-origin / none when present
 *   2. Origin (when present) must match the request Host
 *   3. Custom header X-Requested-With: paisa is required (forces a CORS
 *      preflight cross-origin, which the server never approves)
 *   4. Strict Content-Type for bodies (JSON routes vs multipart upload)
 */
import { MAX_UPLOAD_SIZE } from './config.js';

export const CSRF_HEADER = 'x-requested-with';
export const CSRF_HEADER_VALUE = 'paisa';
export const MAX_JSON_BODY = 16 * 1024;

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

function deny(status, error) {
  return Response.json({ success: false, error }, { status });
}

function hasBody(req) {
  const len = req.headers.get('content-length');
  if (len != null) return Number(len) > 0;
  return req.headers.has('transfer-encoding');
}

function hostOf(value) {
  if (!value) return '';
  return value.trim().toLowerCase();
}

/** Strip the port from a Host header value (handles [ipv6]:port). */
export function hostnameOnly(host) {
  const h = hostOf(host);
  if (h.startsWith('[')) return h.slice(0, h.indexOf(']') + 1);
  const idx = h.lastIndexOf(':');
  return idx === -1 ? h : h.slice(0, idx);
}

/**
 * CSRF check for mutating /api requests. Returns null when OK, else a Response.
 */
export function checkCsrf(req, url) {
  if (SAFE_METHODS.has(req.method)) return null;
  if (!url.pathname.startsWith('/api')) return null;

  const site = req.headers.get('sec-fetch-site');
  if (site && site !== 'same-origin' && site !== 'none') {
    return deny(403, 'Cross-site request blocked');
  }

  const origin = req.headers.get('origin');
  if (origin) {
    let originHost;
    try {
      originHost = new URL(origin).host.toLowerCase();
    } catch {
      return deny(403, 'Invalid Origin');
    }
    const host = hostOf(req.headers.get('host'));
    const fwdHost = hostOf(req.headers.get('x-forwarded-host')?.split(',')[0]);
    if (originHost !== host && originHost !== fwdHost) {
      return deny(403, 'Cross-origin request blocked');
    }
  }

  if (req.headers.get(CSRF_HEADER) !== CSRF_HEADER_VALUE) {
    return deny(403, 'Missing X-Requested-With header');
  }

  if (hasBody(req)) {
    const type = (req.headers.get('content-type') || '').toLowerCase();
    if (url.pathname === '/api/upload') {
      if (!type.startsWith('multipart/form-data')) {
        return deny(415, 'Upload must be multipart/form-data');
      }
    } else if (!type.startsWith('application/json')) {
      return deny(415, 'Content-Type must be application/json');
    }
  }

  return null;
}

/**
 * Body size check based on Content-Length (S7). Returns null or a 413 Response.
 * Bun's maxRequestBodySize is the hard backstop for chunked bodies.
 */
export function checkBodySize(req, url) {
  if (SAFE_METHODS.has(req.method)) return null;
  const len = Number(req.headers.get('content-length') || 0);
  const limit = url.pathname === '/api/upload' ? MAX_UPLOAD_SIZE + 64 * 1024 : MAX_JSON_BODY;
  if (len > limit) {
    return deny(413, url.pathname === '/api/upload'
      ? `File too large. Maximum upload size is ${Math.round(MAX_UPLOAD_SIZE / 1024 / 1024)} MB`
      : 'Request body too large');
  }
  return null;
}

/**
 * Host allow-list (S4, DNS-rebinding defence). `allowed` is an array of
 * lower-case hostnames; an empty list disables the check.
 */
export function checkHost(req, allowed) {
  if (!allowed || allowed.length === 0) return null;
  const hostname = hostnameOnly(req.headers.get('host'));
  if (!allowed.includes(hostname)) {
    return new Response('Misdirected Request', { status: 421 });
  }
  return null;
}

export function parseAllowedHosts(value) {
  return (value || '')
    .split(',')
    .map(s => s.trim().toLowerCase())
    .filter(Boolean);
}
