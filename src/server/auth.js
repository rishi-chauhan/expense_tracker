/**
 * Optional single-user login (S1). Enabled only when AUTH_PASSWORD_HASH is set.
 * Sessions are DB-backed; only SHA-256(token) is stored. The cookie is
 * HttpOnly + SameSite=Strict, a second CSRF layer on top of security.js.
 */
import {
  AUTH_PASSWORD_HASH,
  AUTH_ENABLED,
  SESSION_TTL_DAYS,
  isDev,
} from './config.js';
import {
  createSession,
  getSession,
  touchSession,
  deleteSession,
  deleteExpiredSessions,
} from './db.js';

export const COOKIE_NAME = 'pkg_session';

const PUBLIC_API = new Set(['GET /api/health', 'POST /api/auth/login', 'GET /api/auth/me']);
const RATE_WINDOW_MS = 15 * 60 * 1000;
const FREE_ATTEMPTS = 5;

export function parseCookies(header) {
  const out = {};
  if (!header) return out;
  for (const part of header.split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    const key = part.slice(0, idx).trim();
    if (!key || key in out) continue;
    let val = part.slice(idx + 1).trim();
    if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
    try {
      out[key] = decodeURIComponent(val);
    } catch {
      out[key] = val;
    }
  }
  return out;
}

export function hashToken(token) {
  return new Bun.CryptoHasher('sha256').update(token).digest('hex');
}

function newToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Buffer.from(bytes).toString('base64url');
}

function sessionCookie(token, maxAgeSeconds, secure) {
  return `${COOKIE_NAME}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAgeSeconds}`
    + (secure ? '; Secure' : '');
}

/**
 * Factory so tests can create an auth layer with a specific hash/TTL and a
 * fake clock. The default export below is wired to config.
 */
export function createAuth({
  passwordHash = AUTH_PASSWORD_HASH,
  ttlDays = SESSION_TTL_DAYS,
  secureCookie = !isDev,
  now = () => Date.now(),
} = {}) {
  const enabled = Boolean(passwordHash);
  const ttlMs = ttlDays * 24 * 60 * 60 * 1000;
  const limiter = { failures: [], blockedUntil: 0 };

  function recentFailures() {
    const cutoff = now() - RATE_WINDOW_MS;
    limiter.failures = limiter.failures.filter(t => t > cutoff);
    return limiter.failures.length;
  }

  function sessionFrom(req) {
    const token = parseCookies(req.headers.get('cookie'))[COOKIE_NAME];
    if (!token) return null;
    const tokenHash = hashToken(token);
    const session = getSession(tokenHash);
    if (!session || session.expires_at <= now()) return null;
    return { tokenHash, session };
  }

  async function login(req) {
    const wait = Math.ceil((limiter.blockedUntil - now()) / 1000);
    if (wait > 0) {
      return Response.json(
        { success: false, error: `Too many attempts. Try again in ${wait} s`, retryAfter: wait },
        { status: 429, headers: { 'Retry-After': String(wait) } }
      );
    }

    let password = '';
    try {
      const body = await req.json();
      password = typeof body?.password === 'string' ? body.password : '';
    } catch { /* treated as wrong password */ }

    let ok = false;
    try {
      ok = password.length > 0 && password.length <= 1024
        && await Bun.password.verify(password, passwordHash);
    } catch (error) {
      console.error('Password verify failed (bad AUTH_PASSWORD_HASH?):', error.message);
      ok = false;
    }

    if (!ok) {
      limiter.failures.push(now());
      const failures = recentFailures();
      if (failures > FREE_ATTEMPTS) {
        const seconds = Math.min(2 ** (failures - FREE_ATTEMPTS), 900);
        limiter.blockedUntil = now() + seconds * 1000;
      }
      return Response.json({ success: false, error: 'Invalid password' }, { status: 401 });
    }

    limiter.failures = [];
    limiter.blockedUntil = 0;
    const token = newToken();
    createSession(hashToken(token), ttlMs, req.headers.get('user-agent'));
    return Response.json({ success: true }, {
      headers: { 'Set-Cookie': sessionCookie(token, Math.floor(ttlMs / 1000), secureCookie) },
    });
  }

  function logout(req) {
    const current = sessionFrom(req);
    if (current) deleteSession(current.tokenHash);
    return Response.json({ success: true }, {
      headers: { 'Set-Cookie': sessionCookie('', 0, secureCookie) },
    });
  }

  /**
   * Handle /api/auth/* and gate everything else. Returns a Response to send
   * immediately, or null to continue to the API router.
   */
  async function handle(req, url) {
    const key = `${req.method} ${url.pathname}`;

    if (key === 'GET /api/auth/me') {
      if (!enabled) return Response.json({ authenticated: true, authRequired: false });
      return sessionFrom(req)
        ? Response.json({ authenticated: true, authRequired: true })
        : Response.json({ authenticated: false, authRequired: true }, { status: 401 });
    }

    if (!enabled) {
      if (url.pathname.startsWith('/api/auth/')) {
        return Response.json({ success: false, error: 'Not Found' }, { status: 404 });
      }
      return null;
    }

    if (key === 'POST /api/auth/login') return login(req);
    if (key === 'POST /api/auth/logout') return logout(req);
    if (PUBLIC_API.has(key)) return null;

    const current = sessionFrom(req);
    if (!current) {
      return Response.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    touchSession(current.tokenHash);
    return null;
  }

  return { enabled, handle };
}

let defaultAuth = null;
export function getAuth() {
  if (!defaultAuth) defaultAuth = createAuth();
  return defaultAuth;
}

/** Startup housekeeping: purge expired sessions now and daily. */
export function startSessionHousekeeping() {
  if (!AUTH_ENABLED) {
    console.log('🔓 Auth: off (set AUTH_PASSWORD_HASH to enable)');
    return;
  }
  console.log('🔒 Auth: on (password required)');
  deleteExpiredSessions();
  setInterval(deleteExpiredSessions, 24 * 60 * 60 * 1000).unref?.();
}
