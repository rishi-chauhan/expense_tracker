import { initializeDatabase } from './db.js';
import { handleApiRequest } from './routes.js';

const isDev = process.env.NODE_ENV !== 'production';
const PORT = process.env.PORT || 3000;

// Initialize database on startup
console.log('🔧 Initializing database...');
initializeDatabase();

const server = Bun.serve({
  port: PORT,

  async fetch(req) {
    const url = new URL(req.url);

    // Add CORS headers for development
    const corsHeaders = isDev ? {
      'Access-Control-Allow-Origin': 'http://localhost:5173',
      'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    } : {};

    // Handle OPTIONS preflight requests
    if (req.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: corsHeaders
      });
    }

    // API routes
    if (url.pathname.startsWith('/api')) {
      const response = await handleApiRequest(req, url);

      // Add CORS headers to API responses
      if (isDev) {
        const headers = new Headers(response.headers);
        Object.entries(corsHeaders).forEach(([key, value]) => {
          headers.set(key, value);
        });
        return new Response(response.body, {
          status: response.status,
          statusText: response.statusText,
          headers
        });
      }

      return response;
    }

    // Production: Serve static files from dist/
    if (!isDev) {
      try {
        const filePath = url.pathname === '/' ? '/index.html' : url.pathname;
        const file = Bun.file(`./dist${filePath}`);

        if (await file.exists()) {
          return new Response(file);
        }

        // SPA fallback - serve index.html for client-side routing
        return new Response(Bun.file('./dist/index.html'));
      } catch (error) {
        console.error('Error serving static file:', error);
        return new Response('Internal Server Error', { status: 500 });
      }
    }

    // Development: Return 404 (Vite dev server handles frontend)
    return new Response(
      'Development mode: Frontend is served by Vite at http://localhost:5173\n' +
      'API is available at http://localhost:3000/api',
      { status: 404 }
    );
  }
});

console.log('🚀 Server running on http://localhost:' + PORT);
console.log('📊 Environment:', isDev ? 'development' : 'production');
if (isDev) {
  console.log('💡 Run Vite dev server: bun run dev:vite');
  console.log('   Frontend: http://localhost:5173');
  console.log('   Backend:  http://localhost:3000');
}
