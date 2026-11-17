import { describe, it, expect, beforeAll } from 'bun:test';
import {
  checkCsrf,
  checkBodySize,
  checkHost,
  parseAllowedHosts,
  hostnameOnly,
} from '../security.js';
import { createApp } from '../app.js';
import { createAuth } from '../auth.js';
import {
  initializeDatabase,
  findOrCreateCard,
  insertStatement,
  insertTransaction,
  runInTransaction,
} from '../db.js';
import { runReadOnlyQuery, QueryTimeoutError } from '../queryRunner.js';
import { csvSafeText } from '../routes.js';

const ORIGIN = 'http://app.test';

function req(path, { method = 'GET', headers = {}, body } = {}) {
  return new Request(`${ORIGIN}${path}`, {
    method,
    headers: { host: 'app.test', ...headers },
    body,
  });
}

function jsonPost(path, payload, extra = {}) {
  const body = JSON.stringify(payload);
  return req(path, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'content-length': String(body.length),
      'x-requested-with': 'paisa',
      origin: ORIGIN,
      'sec-fetch-site': 'same-origin',
      ...extra,
    },
    body,
  });
}

const run = (r) => checkCsrf(r, new URL(r.url));

describe('checkCsrf', () => {
  it('allows safe methods without any headers', () => {
    expect(run(req('/api/transactions'))).toBeNull();
    expect(run(req('/api/transactions', { method: 'HEAD' }))).toBeNull();
  });

  it('allows a well-formed same-origin JSON mutation', () => {
    expect(run(jsonPost('/api/categories', { name: 'x' }))).toBeNull();
  });

  it('rejects cross-site Sec-Fetch-Site', () => {
    for (const site of ['cross-site', 'same-site']) {
      const res = run(jsonPost('/api/categories', { name: 'x' }, { 'sec-fetch-site': site }));
      expect(res.status).toBe(403);
    }
  });

  it('accepts Sec-Fetch-Site: none (typed URL / bookmark)', () => {
    expect(run(jsonPost('/api/categories', { name: 'x' }, { 'sec-fetch-site': 'none' }))).toBeNull();
  });

  it('rejects a foreign Origin', () => {
    const res = run(jsonPost('/api/categories', { name: 'x' }, { origin: 'https://evil.example' }));
    expect(res.status).toBe(403);
  });

  it('rejects a malformed Origin', () => {
    const res = run(jsonPost('/api/categories', { name: 'x' }, { origin: 'not a url' }));
    expect(res.status).toBe(403);
  });

  it('accepts Origin matching X-Forwarded-Host', () => {
    const r = jsonPost('/api/categories', { name: 'x' }, {
      host: '127.0.0.1:3000',
      origin: 'https://expenses.example.ts.net',
      'x-forwarded-host': 'expenses.example.ts.net',
    });
    expect(run(r)).toBeNull();
  });

  it('requires X-Requested-With: paisa', () => {
    const missing = run(jsonPost('/api/categories', { name: 'x' }, { 'x-requested-with': '' }));
    expect(missing.status).toBe(403);
    const wrong = run(jsonPost('/api/categories', { name: 'x' }, { 'x-requested-with': 'XMLHttpRequest' }));
    expect(wrong.status).toBe(403);
  });

  it('works with no cookie or session at all (no Origin, no Fetch-Metadata)', () => {
    const body = '{"name":"x"}';
    const r = req('/api/categories', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'content-length': String(body.length) },
      body,
    });
    expect(run(r).status).toBe(403); // custom header still required
  });

  it('rejects text/plain JSON bodies with 415', () => {
    const res = run(jsonPost('/api/categories', { name: 'x' }, { 'content-type': 'text/plain' }));
    expect(res.status).toBe(415);
  });

  it('requires multipart for /api/upload', () => {
    const res = run(jsonPost('/api/upload', { a: 1 }));
    expect(res.status).toBe(415);
  });

  it('allows empty-body POST (apply-rules) with only the custom header', () => {
    const r = req('/api/categories/apply-rules', {
      method: 'POST',
      headers: { 'x-requested-with': 'paisa', origin: ORIGIN },
    });
    expect(run(r)).toBeNull();
  });

  it('covers DELETE and PUT too', () => {
    expect(run(req('/api/statements/1', { method: 'DELETE' })).status).toBe(403);
    expect(run(req('/api/categories/1', { method: 'PUT' })).status).toBe(403);
  });
});

describe('checkBodySize', () => {
  it('rejects large JSON bodies', () => {
    const r = req('/api/categories', { method: 'POST', headers: { 'content-length': String(32 * 1024) } });
    expect(checkBodySize(r, new URL(r.url)).status).toBe(413);
  });

  it('rejects uploads over the limit by Content-Length before reading', () => {
    const r = req('/api/upload', { method: 'POST', headers: { 'content-length': String(50 * 1024 * 1024) } });
    expect(checkBodySize(r, new URL(r.url)).status).toBe(413);
  });

  it('allows normal sizes', () => {
    const r = req('/api/upload', { method: 'POST', headers: { 'content-length': '1000' } });
    expect(checkBodySize(r, new URL(r.url))).toBeNull();
  });
});

describe('checkHost', () => {
  it('parses lists and strips ports', () => {
    expect(parseAllowedHosts(' Localhost, 127.0.0.1 ,,')).toEqual(['localhost', '127.0.0.1']);
    expect(hostnameOnly('LOCALHOST:5173')).toBe('localhost');
    expect(hostnameOnly('[::1]:3000')).toBe('[::1]');
  });

  it('is disabled with an empty list', () => {
    expect(checkHost(req('/'), [])).toBeNull();
  });

  it('rejects unlisted hosts with 421 (DNS rebinding)', () => {
    const r = new Request('http://attacker.example:3000/api/transactions', {
      headers: { host: 'attacker.example:3000' },
    });
    expect(checkHost(r, ['localhost', '127.0.0.1']).status).toBe(421);
    const ok = new Request('http://localhost:3000/', { headers: { host: 'localhost:3000' } });
    expect(checkHost(ok, ['localhost'])).toBeNull();
  });
});

describe('csvSafeText (S10)', () => {
  it('prefixes formula-looking values', () => {
    expect(csvSafeText('=HYPERLINK("x")')).toBe('\'=HYPERLINK("x")');
    expect(csvSafeText('+1')).toBe("'+1");
    expect(csvSafeText('-cmd')).toBe("'-cmd");
    expect(csvSafeText('@SUM(A1)')).toBe("'@SUM(A1)");
    expect(csvSafeText('\tx')).toBe("'\tx");
    expect(csvSafeText('SWIGGY')).toBe('SWIGGY');
    expect(csvSafeText(null)).toBe('');
  });
});

describe('request pipeline (app.js)', () => {
  let handle;

  beforeAll(() => {
    initializeDatabase();
    handle = createApp({
      auth: createAuth({ passwordHash: '' }),
      hosts: ['app.test'],
      serveStatic: false,
    });
  });

  it('blocks the verified CSRF repro (text/plain POST to /api/categories)', async () => {
    const res = await handle(req('/api/categories', {
      method: 'POST',
      headers: { 'content-type': 'text/plain', 'content-length': '20' },
      body: '{"name":"csrf-test"}',
    }));
    expect([403, 415]).toContain(res.status);
  });

  it('blocks Origin: https://evil.example', async () => {
    const res = await handle(jsonPost('/api/categories', { name: 'evil' }, { origin: 'https://evil.example' }));
    expect(res.status).toBe(403);
  });

  it('lets the real client through and returns security headers', async () => {
    const name = `cat-${Date.now()}`;
    const res = await handle(jsonPost('/api/categories', { name, color: '#123abc' }));
    expect(res.status).toBe(201);
    expect(res.headers.get('x-content-type-options')).toBe('nosniff');
    expect(res.headers.get('permissions-policy')).toContain('camera=()');
  });

  it('rejects a foreign Host with 421', async () => {
    const res = await handle(new Request('http://evil.test/api/transactions', { headers: { host: 'evil.test' } }));
    expect(res.status).toBe(421);
  });

  it('refuses CORS preflights (no Access-Control headers)', async () => {
    const res = await handle(req('/api/categories', { method: 'OPTIONS', headers: { origin: 'https://evil.example' } }));
    expect(res.headers.get('access-control-allow-origin')).toBeNull();
  });

  it('validates input (S9) and hides internal errors (S8)', async () => {
    const badColor = await handle(jsonPost('/api/categories', { name: 'x1', color: 'red;background:url(x)' }));
    expect(badColor.status).toBe(400);
    const longName = await handle(jsonPost('/api/categories', { name: 'x'.repeat(41) }));
    expect(longName.status).toBe(400);
    const badCard = await handle(req('/api/transactions?cardId=abc'));
    expect(badCard.status).toBe(400);
    const badDate = await handle(req('/api/export?startDate=yesterday'));
    expect(badDate.status).toBe(400);
    const badJson = await handle(req('/api/categories', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'content-length': '5', 'x-requested-with': 'paisa' },
      body: '{bad}',
    }));
    expect(badJson.status).toBe(400);
    const badBudget = await handle(jsonPost('/api/budgets', { categoryId: 1, amount: 100, period: 'weekly' }));
    expect(badBudget.status).toBe(400);
    const badRule = await handle(jsonPost('/api/categories/rules', { categoryId: 1, pattern: 'X', priority: 500 }));
    expect(badRule.status).toBe(400);
  });

  it('maps UNIQUE violations to a friendly 409', async () => {
    const name = `dup-${Date.now()}`;
    await handle(jsonPost('/api/categories', { name }));
    const res = await handle(jsonPost('/api/categories', { name }));
    expect(res.status).toBe(409);
    expect((await res.json()).error).toBe('A category with that name already exists');
  });

  it('rejects an invalid cardLast4 override on upload', async () => {
    const fd = new FormData();
    fd.append('file', new File(['DATE~AMT\n01/01/2025~10'], 's.csv', { type: 'text/csv' }));
    fd.append('bankName', 'HDFC');
    fd.append('cardLast4', '12ab');
    const r = new Request(`${ORIGIN}/api/upload`, {
      method: 'POST',
      headers: { host: 'app.test', 'x-requested-with': 'paisa', origin: ORIGIN },
      body: fd,
    });
    const res = await handle(r);
    expect(res.status).toBe(400);
  });
});

describe('AI query worker (S3)', () => {
  beforeAll(() => {
    initializeDatabase();
    // Enough rows that a 3-way cross join takes many seconds.
    runInTransaction(() => {
      const cardId = findOrCreateCard('TESTBANK', '4242');
      const stmtId = insertStatement('slow.csv', `slow-${Date.now()}`, '2025-01-01', '2025-01-31', 700, cardId);
      for (let i = 0; i < 700; i++) {
        insertTransaction(`slow-${Date.now()}-${i}`, '2025-01-15', i + 1, `MERCHANT ${i}`, false, 'Domestic', stmtId);
      }
    });
  });

  it('runs a normal query off the main thread', async () => {
    const rows = await runReadOnlyQuery('SELECT COUNT(*) AS n FROM transactions');
    expect(rows[0].n).toBeGreaterThanOrEqual(700);
  });

  it('rejects disallowed SQL before it reaches the worker', async () => {
    await expect(runReadOnlyQuery('SELECT randomblob(10)')).rejects.toThrow('disallowed');
  });

  it('kills a slow query at the timeout while /api/health keeps answering', async () => {
    const handle = createApp({ auth: createAuth({ passwordHash: '' }), hosts: [], serveStatic: false });
    const started = Date.now();
    const slow = runReadOnlyQuery(
      'SELECT COUNT(*) AS n FROM transactions a, transactions b, transactions c',
      { timeoutMs: 1500 }
    ).then(() => 'finished', (e) => e);

    await Bun.sleep(200);
    const t0 = performance.now();
    const health = await handle(req('/api/health'));
    const healthMs = performance.now() - t0;
    expect(health.status).toBe(200);
    expect(healthMs).toBeLessThan(500);

    const outcome = await slow;
    expect(outcome).toBeInstanceOf(QueryTimeoutError);
    expect(Date.now() - started).toBeLessThan(4000);

    // A fresh worker is spawned for the next query.
    const rows = await runReadOnlyQuery('SELECT 1 AS one');
    expect(rows[0].one).toBe(1);
  }, 15000);

  it('worker connection is read-only', async () => {
    // Validation would block writes anyway; prove query_only at the DB level
    // by sending a crafted message directly to a worker.
    const w = new Worker(new URL('../queryWorker.js', import.meta.url).href);
    const result = await new Promise((resolve) => {
      w.onmessage = (e) => resolve(e.data);
      w.postMessage({ id: 1, dbPath: process.env.DB_PATH, sql: 'DELETE FROM transactions' });
    });
    w.terminate();
    expect(result.error).toBeTruthy();
  });
});
