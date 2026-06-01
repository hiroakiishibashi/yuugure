/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * Inject the portal's shared site header into the built index.html.
 *
 * We do this here rather than writing `<script src="/js/common-header.js">`
 * straight into index.html, because Vite would try to resolve/bundle that path
 * at build time — but the file only exists on the portal site, not in this
 * repo. Injecting it as a raw tag keeps the build clean while making the output
 * dist/index.html self-contained with the header, so it survives the portal's
 * `rsync --delete dist/ → games/yuugure/` sync (see games/yuugure/HANDOFF.md in
 * the hiroakiishibashi-web repo). On a standalone/local serve the script simply
 * 404s and the game runs headerless — harmless.
 */
const portalHeader = {
  name: 'yuugure-portal-header',
  transformIndexHtml() {
    return [
      { tag: 'script', attrs: { type: 'module', src: '/js/common-header.js' }, injectTo: 'body' as const },
    ];
  },
};

// https://vitejs.dev/config/
export default defineConfig({
  // Root locally ('/') so tests + a local static preview resolve assets from the
  // root. `npm run build` sets YUUGURE_BASE=/games/yuugure/ for the portal (see
  // package.json); `npm run build:local` builds at the root base for previewing.
  base: process.env.YUUGURE_BASE ?? '/',
  plugins: [react(), portalHeader],
  test: {
    // The NML engine is framework-agnostic and runs headless, so the
    // default Node environment is enough. UI/PixiJS tests (Phase 2+) can
    // opt into jsdom per-file via the `// @vitest-environment jsdom` pragma.
    environment: 'node',
    globals: true,
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
  },
});
