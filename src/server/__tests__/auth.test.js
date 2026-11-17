import { describe, it, expect, beforeAll } from 'bun:test';
import { createAuth, parseCookies, hashToken, COOKIE_NAME } from '../auth.js';
import { createApp } from '../app.js';
import { initializeDatabase, getSession, createSession } from '../db.js';

const ORIGIN = 'http://app.test';
let passwordHash;

function request(path, { method = 'GET', cookie, body } = {}) {
  const headers = { host: 'app.test', 'x-requested-with': 'paisa', origin: ORIGIN };
  if (cookie) headers.cookie = cookie;
  let payload;
  if (body !== undefined) {
    payload = JSON.stringify(body);
    headers['content-type'] = 'application/json';
    headers['content-length'] = String(payload.length);
  }
  return new Request(`${ORIGIN}${path}`, { method, headers, body: payload });
}

function cookieFrom(res) {
  const set = res.headers.get('set-cookie') || '';
  return set.split(';')[0];
}

function makeApp(opts = {}) {
  return createApp({
    auth: createAuth({ passwordHash, secureCookie: false, ...opts }),
    hosts: [],
    serveStatic: false,
  });
}

beforeAll(async () => {
  initializeDatabase();
  passwordHash = await Bun.password.hash('correct horse', { algorithm: 'argon2id' });
});

describe('parseCookies', () => {
  it('parses multiple cookies and ignores junk', () => {
    expect(parseCookies('a=1; pkg_session=abc; junk; b="q%20x"')).toEqual({
      a: '1', pkg_session: 'abc', b: 'q x',
    });
    expect(parseCookies(null)).toEqual({});
  });
});

describe('auth disabled (default)', () => {
  it('reports authRequired:false and lets every request through', async () => {
    const app = createApp({ auth: createAuth({ passwordHash: '' }), hosts: [], serveStatic: false });
    const me = await app(request('/api/auth/me'));
    expect(await me.json()).toEqual({ authenticated: true, authRequired: false });
    const tx = await app(request('/api/transactions'));
    expect(tx.status).toBe(200);
    const login = await app(request('/api/auth/login', { method: 'POST', body: { password: 'x' } }));
    expect(login.status).toBe(404);
  });
});

describe('auth enabled', () => {
  it('gates the API but keeps health and me public', async () => {
    const app = makeApp();
    expect((await app(request('/api/transactions'))).status).toBe(401);
    expect((await app(request('/api/categories', { method: 'POST', body: { name: 'x' } }))).status).toBe(401);
    expect((await app(request('/api/health'))).status).toBe(200);
    const me = await app(request('/api/auth/me'));
    expect(me.status).toBe(401);
    expect(await me.json()).toEqual({ authenticated: false, authRequired: true });
  });

  it('logs in, sets a hardened cookie, and stores only the token hash', async () => {
    const app = makeApp();
    const res = await app(request('/api/auth/login', { method: 'POST', body: { password: 'correct horse' } }));
    expect(res.status).toBe(200);
    const setCookie = res.headers.get('set-cookie');
    expect(setCookie).toContain(`${COOKIE_NAME}=`);
    expect(setCookie).toContain('HttpOnly');
    expect(setCookie).toContain('SameSite=Strict');
    expect(setCookie).toContain('Path=/');

    const cookie = cookieFrom(res);
    const token = cookie.split('=')[1];
    expect(getSession(token)).toBeNull(); // raw token never stored
    expect(getSession(hashToken(token))).not.toBeNull();

    expect((await app(request('/api/transactions', { cookie }))).status).toBe(200);
    const me = await app(request('/api/auth/me', { cookie }));
    expect(await me.json()).toEqual({ authenticated: true, authRequired: true });
  });

  it('adds Secure in production mode', async () => {
    const app = createApp({ auth: createAuth({ passwordHash, secureCookie: true }), hosts: [], serveStatic: false });
    const res = await app(request('/api/auth/login', { method: 'POST', body: { password: 'correct horse' } }));
    expect(res.headers.get('set-cookie')).toContain('Secure');
  });

  it('rejects a wrong password with 401', async () => {
    const app = makeApp();
    const res = await app(request('/api/auth/login', { method: 'POST', body: { password: 'nope' } }));
    expect(res.status).toBe(401);
    expect(res.headers.get('set-cookie')).toBeNull();
  });

  it('rate limits after 5 failures with 429 + Retry-After, and resets on success', async () => {
    let clock = 1_000_000;
    const app = makeApp({ now: () => clock });
    for (let i = 0; i < 5; i++) {
      const r = await app(request('/api/auth/login', { method: 'POST', body: { password: 'bad' } }));
      expect(r.status).toBe(401);
    }
    // 6th failure triggers the block
    expect((await app(request('/api/auth/login', { method: 'POST', body: { password: 'bad' } }))).status).toBe(401);
    const blocked = await app(request('/api/auth/login', { method: 'POST', body: { password: 'correct horse' } }));
    expect(blocked.status).toBe(429);
    expect(Number(blocked.headers.get('retry-after'))).toBeGreaterThan(0);

    clock += 5_000;
    const ok = await app(request('/api/auth/login', { method: 'POST', body: { password: 'correct horse' } }));
    expect(ok.status).toBe(200);
    // counter reset: a new failure does not block
    expect((await app(request('/api/auth/login', { method: 'POST', body: { password: 'bad' } }))).status).toBe(401);
  });

  it('rejects expired sessions', async () => {
    const app = makeApp();
    const token = 'expired-token-value';
    createSession(hashToken(token), -1000);
    const res = await app(request('/api/transactions', { cookie: `${COOKIE_NAME}=${token}` }));
    expect(res.status).toBe(401);
  });

  it('logout invalidates the session server-side', async () => {
    const app = makeApp();
    const login = await app(request('/api/auth/login', { method: 'POST', body: { password: 'correct horse' } }));
    const cookie = cookieFrom(login);
    const out = await app(request('/api/auth/logout', { method: 'POST', cookie }));
    expect(out.status).toBe(200);
    expect(out.headers.get('set-cookie')).toContain('Max-Age=0');
    expect((await app(request('/api/transactions', { cookie }))).status).toBe(401);
  });

  it('sessions survive a restart (new auth instance, same DB)', async () => {
    const login = await makeApp()(request('/api/auth/login', { method: 'POST', body: { password: 'correct horse' } }));
    const cookie = cookieFrom(login);
    const restarted = makeApp();
    expect((await restarted(request('/api/transactions', { cookie }))).status).toBe(200);
  });
});
