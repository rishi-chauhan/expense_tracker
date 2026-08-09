import path from 'path';
import { initializeDatabase, closeDatabase, checkDbHealthy } from './db.js';
import { handleApiRequest } from './routes.js';
import { HOST, PORT, isDev, SECURITY_HEADERS } from './config.js';

const startedAt = Date.now();

console.log('🔧 Initializing database...');
initializeDatabase();

function resolveDistPath(urlPathname) {
  const distRoot = path.resolve('./dist');
  const relative = urlPathname === '/' ? 'index.html' : urlPathname.replace(/^\//, '');
  const resolved = path.resolve(distRoot, relative);
  if (!resolved.startsWith(distRoot + path.sep) && resolved !== distRoot) {
    return null;
  }
  return resolved;
}

function withSecurityHeaders(response) {
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

const server = Bun.serve({
  port: PORT,
  hostname: HOST,

  async fetch(req) {
    const url = new URL(req.url);

    const corsHeaders = isDev ? {
      'Access-Control-Allow-Origin': 'http://localhost:5173',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    } : {};

    if (req.method === 'OPTIONS') {
      return withSecurityHeaders(new Response(null, {
        status: 204,
        headers: corsHeaders
      }));
    }

    if (url.pathname.startsWith('/api')) {
      // Attach uptime helper for health route via request context is awkward;
      // health handler reads process uptime itself. Pass startedAt via global.
      globalThis.__serverStartedAt = startedAt;
      globalThis.__checkDbHealthy = checkDbHealthy;

      const response = await handleApiRequest(req, url);

      if (isDev) {
        const newHeaders = new Headers(response.headers);
        Object.entries(corsHeaders).forEach(([key, value]) => {
          newHeaders.set(key, value);
        });
        Object.entries(SECURITY_HEADERS).forEach(([key, value]) => {
          if (!newHeaders.has(key)) newHeaders.set(key, value);
        });
        return new Response(response.body, {
          status: response.status,
          statusText: response.statusText,
          headers: newHeaders
        });
      }

      return withSecurityHeaders(response);
    }

    if (!isDev) {
      try {
        const filePath = resolveDistPath(url.pathname);
        if (!filePath) {
          return withSecurityHeaders(new Response('Forbidden', { status: 403 }));
        }

        const file = Bun.file(filePath);
        if (await file.exists()) {
          return withSecurityHeaders(new Response(file));
        }

        return withSecurityHeaders(new Response(Bun.file('./dist/index.html')));
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
  }
});

console.log(`🚀 Server running on http://${HOST}:${PORT}`);
console.log('📊 Environment:', isDev ? 'development' : 'production');
if (isDev) {
  console.log('💡 Run Vite dev server: bun run dev:vite');
  console.log('   Frontend: http://localhost:5173');
  console.log(`   Backend:  http://${HOST === '0.0.0.0' ? 'localhost' : HOST}:${PORT}`);
}

function shutdown(signal) {
  console.log(`\n⏹  Received ${signal}, shutting down...`);
  try {
    server.stop(true);
  } catch { /* ignore */ }
  closeDatabase();
  process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
