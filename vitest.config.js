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
