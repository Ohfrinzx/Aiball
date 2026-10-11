import { defineConfig, devices } from '@playwright/test';

const PORT = 4173;
const isCI = !!process.env.CI;

// Allows running against a pre-installed Chromium whose revision differs from
// the one bundled with this Playwright version (e.g. sandboxed dev containers).
const executablePath = process.env.PW_CHROMIUM_PATH;
const launchOptions = executablePath ? { executablePath } : {};

export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 1 : 0,
  reporter: isCI ? [['github'], ['list']] : 'list',
  use: {
    baseURL: `http://localhost:${PORT}/Aiball/`,
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'mobile-portrait',
      use: {
        ...devices['Pixel 7'],
        viewport: { width: 390, height: 844 },
        launchOptions,
      },
    },
    {
      name: 'desktop-landscape',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1440, height: 900 },
        launchOptions,
      },
    },
  ],
  webServer: {
    command: `npm run build && npx vite preview --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}/Aiball/`,
    reuseExistingServer: !isCI,
    timeout: 120_000,
  },
});
