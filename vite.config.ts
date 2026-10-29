/// <reference types="vitest/config" />
import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  server: {
    // `npm run dev:api` serves the Azure Functions on 7071; the browser sees one origin, as in production.
    proxy: { '/api': 'http://localhost:7071' },
  },
  build: {
    target: 'es2022',
    sourcemap: true,
  },
  test: {
    css: false,
    globals: true,
    projects: [
      {
        extends: true,
        test: { name: 'web', include: ['src/**/*.test.{ts,tsx}'], environment: 'jsdom', setupFiles: ['./src/test/setup.ts'] },
      },
      {
        extends: true,
        test: { name: 'api', include: ['api/src/**/*.test.ts'], environment: 'node' },
      },
    ],
  },
})
