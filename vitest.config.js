import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    mockReset: true,
    restoreMocks: true,
    environmentMatchGlobs: [
      // Frontend tests use happy-dom
      ['src/client/**', 'happy-dom'],
      // Backend tests use node
      ['src/server/**', 'node']
    ],
    setupFiles: ['./src/client/__tests__/setup.js'],
    exclude: [
      'node_modules/**',
      // Server tests that import bun:sqlite or bun:test must be run with `bun test` instead
      'src/server/__tests__/db.test.js',
      'src/server/__tests__/integration.test.js',
      'src/server/__tests__/routes.test.js',
      'src/server/__tests__/ollama.test.js',
      'src/server/__tests__/executeReadOnlyQuery.test.js'
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'dist/',
        '**/*.test.{js,jsx}',
        '**/__tests__/**',
        'src/client/main.jsx',
        'vite.config.js',
        'vitest.config.js',
        'eslint.config.js'
      ]
    }
  }
});
