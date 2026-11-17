import { describe, it, expect, beforeAll } from 'bun:test';
import { mkdtempSync, mkdirSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import path from 'path';
import zlib from 'node:zlib';
import { createApp } from '../app.js';
import { createAuth } from '../auth.js';
import { initializeDatabase, getAllTransactions, findOrCreateCard, insertStatement, insertTransaction } from '../db.js';

const ORIGIN = 'http://app.test';
let dist;
let app;

function get(p, headers = {}) {
  return new Request(`${ORIGIN}${p}`, { headers: { host: 'app.test', ...headers } });
}

beforeAll(() => {
  initializeDatabase();
  dist = mkdtempSync(path.join(tmpdir(), 'paisa-dist-'));
  mkdirSync(path.join(dist, 'assets'));
  const js = 'console.log("hello");\n'.repeat(200);
  writeFileSync(path.join(dist, 'assets', 'main-abc123.js'), js);
  writeFileSync(path.join(dist, 'assets', 'main-abc123.js.gz'), Bun.gzipSync(Buffer.from(js)));
  writeFileSync(path.join(dist, 'assets', 'main-abc123.js.br'), zlib.brotliCompressSync(Buffer.from(js)));
  writeFileSync(path.join(dist, 'index.html'), '<!doctype html><title>t</title>');
  app = createApp({ auth: createAuth({ passwordHash: '' }), hosts: [], distDir: dist, serveStatic: true });
});

describe('static files (P1)', () => {
  it('serves brotli with immutable caching for hashed assets', async () => {
    const res = await app(get('/assets/main-abc123.js', { 'accept-encoding': 'gzip, deflate, br' }));
    expect(res.status).toBe(200);
    expect(res.headers.get('content-encoding')).toBe('br');
    expect(res.headers.get('content-type')).toContain('javascript');
    expect(res.headers.get('cache-control')).toBe('public, max-age=31536000, immutable');
    expect(res.headers.get('vary')).toBe('Accept-Encoding');
    const body = zlib.brotliDecompressSync(Buffer.from(await res.arrayBuffer())).toString();
    expect(body).toContain('hello');
  });

  it('falls back to gzip, then raw', async () => {
    const gz = await app(get('/assets/main-abc123.js', { 'accept-encoding': 'gzip' }));
    expect(gz.headers.get('content-encoding')).toBe('gzip');
    const raw = await app(get('/assets/main-abc123.js'));
    expect(raw.headers.get('content-encoding')).toBeNull();
    expect(await raw.text()).toContain('hello');
  });

  it('answers If-None-Match with 304', async () => {
    const first = await app(get('/assets/main-abc123.js', { 'accept-encoding': 'br' }));
    const etag = first.headers.get('etag');
    expect(etag).toBeTruthy();
    const second = await app(get('/assets/main-abc123.js', { 'accept-encoding': 'br', 'if-none-match': etag }));
    expect(second.status).toBe(304);
  });

  it('never serves .gz/.br directly and 404s missing assets', async () => {
    expect((await app(get('/assets/main-abc123.js.br'))).status).toBe(404);
    expect((await app(get('/assets/missing.js'))).status).toBe(404);
  });

  it('uses no-cache for index.html and the SPA fallback', async () => {
    const index = await app(get('/'));
    expect(index.headers.get('cache-control')).toBe('no-cache');
    const spa = await app(get('/transactions'));
    expect(spa.status).toBe(200);
    expect(spa.headers.get('content-type')).toContain('text/html');
    expect(spa.headers.get('cache-control')).toBe('no-cache');
  });

  it('blocks path traversal', async () => {
    const res = await app(get('/..%2f..%2fetc%2fpasswd'));
    expect([403, 404]).toContain(res.status);
  });
});

describe('API caching (P3)', () => {
  it('returns 304 for an unchanged resource and 200 after a mutation', async () => {
    const first = await app(get('/api/categories'));
    const etag = first.headers.get('etag');
    expect(etag).toMatch(/^W\//);
    expect(first.headers.get('cache-control')).toBe('private, no-cache');

    const second = await app(get('/api/categories', { 'if-none-match': etag }));
    expect(second.status).toBe(304);
    expect(await second.text()).toBe('');

    const body = JSON.stringify({ name: `perf-${Date.now()}` });
    const create = await app(new Request(`${ORIGIN}/api/categories`, {
      method: 'POST',
      headers: {
        host: 'app.test', origin: ORIGIN, 'x-requested-with': 'paisa',
        'content-type': 'application/json', 'content-length': String(body.length),
      },
      body,
    }));
    expect(create.status).toBe(201);

    const third = await app(get('/api/categories', { 'if-none-match': etag }));
    expect(third.status).toBe(200);
    expect(third.headers.get('etag')).not.toBe(etag);
  });

  it('gzips large JSON responses', async () => {
    const res = await app(get('/api/categories', { 'accept-encoding': 'gzip' }));
    expect(res.headers.get('content-encoding')).toBe('gzip');
    const json = JSON.parse(new TextDecoder().decode(Bun.gunzipSync(new Uint8Array(await res.arrayBuffer()))));
    expect(json.success).toBe(true);
  });

  it('marks non-cacheable API responses no-store', async () => {
    const res = await app(get('/api/health'));
    expect(res.headers.get('cache-control')).toBe('no-store');
  });
});

describe('lean transaction payload (P2)', () => {
  it('returns only client-used columns and filters by card', () => {
    const cardId = findOrCreateCard('LEANBANK', '1111');
    const stmt = insertStatement('lean.csv', `lean-${Date.now()}`, '2025-02-01', '2025-02-01', 1, cardId);
    insertTransaction(`lean-${Date.now()}`, '2025-02-01', 42, 'LEAN SHOP', false, 'Domestic', stmt);
    const rows = getAllTransactions(Number(cardId));
    expect(rows.length).toBe(1);
    expect(Object.keys(rows[0]).sort()).toEqual([
      'amount', 'bank_name', 'card_id', 'card_label', 'card_last4', 'category_color',
      'category_id', 'category_manual', 'category_name', 'date', 'description', 'id', 'is_credit', 'type',
    ]);
    expect(getAllTransactions().length).toBeGreaterThanOrEqual(1);
  });
});
