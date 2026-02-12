#!/usr/bin/env bun

// Start both backend and frontend dev servers
console.log('🚀 Starting development servers...\n');

// Start backend server
const backend = Bun.spawn(['bun', 'run', '--watch', 'src/server/index.js'], {
  stdout: 'inherit',
  stderr: 'inherit',
  stdin: 'inherit'
});

// Start Vite dev server
const frontend = Bun.spawn(['bun', 'run', 'dev:vite'], {
  stdout: 'inherit',
  stderr: 'inherit',
  stdin: 'inherit'
});

// Handle Ctrl+C to stop both servers
process.on('SIGINT', () => {
  console.log('\n\n👋 Shutting down servers...');
  backend.kill();
  frontend.kill();
  process.exit(0);
});

// Wait for both processes
await Promise.all([backend.exited, frontend.exited]);
