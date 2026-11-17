import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  root: 'src/client',
  build: {
    outDir: '../../dist',
    emptyOutDir: true
  },
  // Dev binds to localhost only. For phone testing on the LAN run
  // `bun run dev:vite -- --host` (and HOST/ALLOWED_HOSTS for the backend).
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        // Keep the browser's Host so the backend's Origin == Host CSRF check passes.
        changeOrigin: false,
        secure: false
      }
    }
  }
})
