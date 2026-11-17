/**
 * Production static file serving from dist/ (P1).
 *
 * - Serves precompressed .br / .gz siblings (made by scripts/compress-dist.js)
 *   according to Accept-Encoding, with the original Content-Type.
 * - /assets/* (content-hashed by Vite) → immutable for a year; everything else
 *   (index.html, SPA fallback, theme-init.js, manifest, icons) → no-cache.
 * - ETag "<size>-<mtimeMs>" of the served variant; If-None-Match → 304.
 * - Stat results are cached per path: dist/ is immutable while running.
 */
import path from 'path';
import { statSync } from 'fs';

function statOrNull(file) {
  try {
    const s = statSync(file);
    return s.isFile() ? { size: s.size, mtimeMs: Math.floor(s.mtimeMs) } : null;
  } catch {
    return null;
  }
}

function acceptsEncoding(header, name) {
  if (!header) return false;
  return header.split(',').some((part) => {
    const [token, ...params] = part.trim().toLowerCase().split(';');
    if (token !== name && token !== '*') return false;
    const q = params.map(p => p.trim()).find(p => p.startsWith('q='));
    return !q || Number(q.slice(2)) > 0;
  });
}

export function createStaticHandler(distDir = './dist') {
  const distRoot = path.resolve(distDir);
  const cache = new Map();

  function describe(file) {
    let entry = cache.get(file);
    if (entry) return entry;
    const raw = statOrNull(file);
    entry = raw && {
      file,
      type: Bun.file(file).type,
      raw,
      br: statOrNull(`${file}.br`),
      gz: statOrNull(`${file}.gz`),
    };
    cache.set(file, entry);
    return entry;
  }

  function resolve(urlPathname) {
    let decoded;
    try {
      decoded = decodeURIComponent(urlPathname);
    } catch {
      return null;
    }
    const relative = decoded === '/' ? 'index.html' : decoded.replace(/^\/+/, '');
    const resolved = path.resolve(distRoot, relative);
    if (!resolved.startsWith(distRoot + path.sep) && resolved !== distRoot) return null;
    return resolved;
  }

  return function serveStatic(req, url) {
    const { pathname } = url;

    // Compressed variants are only reachable through content negotiation.
    if (/\.(gz|br)$/i.test(pathname)) return new Response('Not Found', { status: 404 });

    const filePath = resolve(pathname);
    if (!filePath) return new Response('Forbidden', { status: 403 });

    let entry = describe(filePath);
    const isAsset = pathname.startsWith('/assets/');
    if (!entry) {
      // Missing hashed asset → real 404 (not HTML with a JS MIME mismatch).
      if (isAsset) return new Response('Not Found', { status: 404 });
      entry = describe(path.join(distRoot, 'index.html'));
      if (!entry) return new Response('Not Found', { status: 404 });
    }

    const accept = req.headers.get('accept-encoding');
    let variant = { file: entry.file, stat: entry.raw, encoding: null };
    if (entry.br && acceptsEncoding(accept, 'br')) {
      variant = { file: `${entry.file}.br`, stat: entry.br, encoding: 'br' };
    } else if (entry.gz && acceptsEncoding(accept, 'gzip')) {
      variant = { file: `${entry.file}.gz`, stat: entry.gz, encoding: 'gzip' };
    }

    const etag = `"${variant.stat.size}-${variant.stat.mtimeMs}"`;
    const headers = new Headers({
      'Content-Type': entry.type,
      'Cache-Control': isAsset ? 'public, max-age=31536000, immutable' : 'no-cache',
      ETag: etag,
    });
    if (entry.br || entry.gz) headers.set('Vary', 'Accept-Encoding');
    if (variant.encoding) headers.set('Content-Encoding', variant.encoding);

    const inm = req.headers.get('if-none-match');
    if (inm && inm.split(',').some(t => t.trim() === etag)) {
      return new Response(null, { status: 304, headers });
    }

    return new Response(Bun.file(variant.file), { headers });
  };
}
