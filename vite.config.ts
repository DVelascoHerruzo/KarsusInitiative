/// <reference types="vitest/config" />
import { fileURLToPath, URL } from 'node:url'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

/**
 * The browser only finds fonts and the backdrop after it has downloaded the CSS
 * (and, for the landing image, the JavaScript). Listing them in the page's head
 * starts those downloads at once instead of a second or more later.
 */
function preloadFirstPaint(): Plugin {
  const FONTS = [/cinzel-latin-400-normal-.*.woff2$/, /cinzel-decorative-latin-400-normal-.*.woff2$/, /im-fell-english-latin-400-(normal|italic)-.*.woff2$/]
  const BACKDROP = /backdrop-(640|1280|1920)-.*.avif$/
  return {
    name: 'preload-first-paint',
    apply: 'build',
    transformIndexHtml: {
      order: 'post',
      handler(_html, ctx) {
        const files = Object.keys(ctx.bundle ?? {})
        const fonts = files.filter((f) => FONTS.some((re) => re.test(f)))
        const backdrop = files
          .filter((f) => BACKDROP.test(f))
          .map((f) => `/${f} ${BACKDROP.exec(f)![1]}w`)
          .join(', ')
        return [
          ...fonts.map((f) => ({ tag: 'link', attrs: { rel: 'preload', as: 'font', type: 'font/woff2', href: `/${f}`, crossorigin: '' }, injectTo: 'head' as const })),
          // Same sizes and srcset as the landing picture, so the browser reuses this download.
          ...(backdrop
            ? [{ tag: 'link', attrs: { rel: 'preload', as: 'image', type: 'image/avif', imagesrcset: backdrop, imagesizes: '100vw', fetchpriority: 'high' }, injectTo: 'head' as const }]
            : []),
        ]
      },
    },
  }
}

export default defineConfig({
  plugins: [react(), tailwindcss(), preloadFirstPaint()],
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
