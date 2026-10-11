import { defineConfig } from 'vitest/config';

// GitHub Pages serves the site from https://<user>.github.io/<repo>/,
// so production builds need the repo name as the base path.
const PAGES_BASE = '/Aiball/';

export default defineConfig(({ command, isPreview }) => ({
  base: command === 'build' || isPreview ? PAGES_BASE : '/',
  build: {
    target: 'es2022',
  },
  test: {
    include: ['tests/unit/**/*.test.ts'],
    environment: 'node',
  },
}));
