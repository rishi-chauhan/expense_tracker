import { initializeDatabase, closeDatabase } from './db.js';
import { HOST, PORT, isDev, MAX_UPLOAD_SIZE } from './config.js';
import { createApp } from './app.js';
import { startSessionHousekeeping } from './auth.js';
import { shutdownQueryWorker } from './queryRunner.js';

console.log('🔧 Initializing database...');
initializeDatabase();
startSessionHousekeeping();

const handleRequest = createApp();

const server = Bun.serve({
  port: PORT,
  hostname: HOST,
  // Hard cap so a huge body is rejected before it is buffered (S7).
  maxRequestBodySize: MAX_UPLOAD_SIZE + 64 * 1024,
  fetch: handleRequest,
});

console.log(`🚀 Server running on http://${HOST}:${PORT}`);
console.log('📊 Environment:', isDev ? 'development' : 'production');
if (isDev) {
  console.log('💡 Run Vite dev server: bun run dev:vite');
  console.log('   Frontend: http://localhost:5173');
  console.log(`   Backend:  http://${HOST}:${PORT}`);
}

function shutdown(signal) {
  console.log(`\n⏹  Received ${signal}, shutting down...`);
  try {
    server.stop(true);
  } catch { /* ignore */ }
  shutdownQueryWorker();
  closeDatabase();
  process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
