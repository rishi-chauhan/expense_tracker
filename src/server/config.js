import path from 'path';

export const isDev = process.env.NODE_ENV !== 'production';

/** Max CSV upload size in bytes (default 5 MB) */
export const MAX_UPLOAD_SIZE = Number(process.env.MAX_UPLOAD_SIZE) || 5_242_880;

/**
 * Bind address — localhost in every mode. Production sits behind Caddy /
 * `tailscale serve`; in dev use `HOST=0.0.0.0` only if you really mean it.
 */
export const HOST = process.env.HOST || '127.0.0.1';

/** HTTP listen port */
export const PORT = Number(process.env.PORT) || 3000;

/** SQLite database path (absolute or relative to cwd) */
export const DB_PATH = process.env.DB_PATH
  ? path.resolve(process.env.DB_PATH)
  : path.join(process.cwd(), 'data', 'expenses.db');

/**
 * Host header allow-list (DNS-rebinding defence). Comma separated hostnames,
 * no ports. Unset = no check in production; dev defaults to localhost only.
 */
export const ALLOWED_HOSTS = process.env.ALLOWED_HOSTS
  ?? (isDev ? 'localhost,127.0.0.1' : '');

/** Optional app password (S1). Auth is on only when a hash is configured. */
export const AUTH_PASSWORD_HASH = process.env.AUTH_PASSWORD_HASH || '';
export const AUTH_ENABLED = AUTH_PASSWORD_HASH.length > 0;
export const SESSION_TTL_DAYS = Number(process.env.SESSION_TTL_DAYS) || 30;

/** Set OLLAMA_SUMMARIZE=0 to skip the second LLM call (halves latency on a Pi). */
export const OLLAMA_SUMMARIZE = process.env.OLLAMA_SUMMARIZE !== '0';

export const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  "connect-src 'self'",
  "manifest-src 'self'",
  "worker-src 'self'",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join('; ');

/** Security headers for every Bun response (CSP only in production — Vite HMR needs inline/eval). */
export const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'no-referrer',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Resource-Policy': 'same-origin',
  ...(isDev ? {} : { 'Content-Security-Policy': CONTENT_SECURITY_POLICY }),
};
