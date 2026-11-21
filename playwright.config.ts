import { defineConfig, devices } from '@playwright/test'

// E2E runs against the production build (vite preview), like the deployed site.
const PORT = 4173
const BASE = `http://localhost:${PORT}/calorie-tracker/`

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['list']] : 'list',
  use: {
    baseURL: BASE,
    trace: 'off',
    // The PWA service worker would cache between tests; the app works without it.
    serviceWorkers: 'block',
    timezoneId: 'Asia/Singapore',
    locale: 'en-SG',
  },
  projects: [
    // Phone-first app: iPhone viewport, run on Chromium (the browser installed in CI).
    { name: 'mobile', use: { ...devices['iPhone 13'], browserName: 'chromium' } },
    { name: 'desktop', use: { ...devices['Desktop Chrome'] }, testMatch: /smoke|a11y/ },
  ],
  webServer: {
    command: `npm run build && npx vite preview --port ${PORT} --strictPort`,
    url: BASE,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
