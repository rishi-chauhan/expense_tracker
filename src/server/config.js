import path from 'path';

const isProd = process.env.NODE_ENV === 'production';

/** Max CSV upload size in bytes (default 5 MB) */
export const MAX_UPLOAD_SIZE = Number(process.env.MAX_UPLOAD_SIZE) || 5_242_880;

/** Bind address — production defaults to localhost behind a reverse proxy */
export const HOST = process.env.HOST || (isProd ? '127.0.0.1' : '0.0.0.0');

/** HTTP listen port */
export const PORT = Number(process.env.PORT) || 3000;

/** SQLite database path (absolute or relative to cwd) */
export const DB_PATH = process.env.DB_PATH
  ? path.resolve(process.env.DB_PATH)
  : path.join(process.cwd(), 'data', 'expenses.db');

export const isDev = process.env.NODE_ENV !== 'production';

/** Basic security headers for Bun responses */
export const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'no-referrer',
};
