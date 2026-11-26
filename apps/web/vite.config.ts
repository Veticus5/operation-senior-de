/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

// Treść edukacyjna leży poza aplikacją, w /content. Alias @content pozwala ją importować
// bez mieszania z kodem interfejsu.
export default defineConfig({
  plugins: [react()],
  base: './',
  resolve: { alias: { '@content': fileURLToPath(new URL('../../content', import.meta.url)) } },
  server: { fs: { allow: ['../..'] } },
  test: { environment: 'node', include: ['src/**/*.test.ts'] }
});
