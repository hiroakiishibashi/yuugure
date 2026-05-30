/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  test: {
    // The NML engine is framework-agnostic and runs headless, so the
    // default Node environment is enough. UI/PixiJS tests (Phase 2+) can
    // opt into jsdom per-file via the `// @vitest-environment jsdom` pragma.
    environment: 'node',
    globals: true,
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
  },
});
