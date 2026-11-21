import { defineConfig, devices } from '@playwright/test'

// E2E runs against the production build (vite preview), like the deployed site.
// The browser runs in Singapore time (timezoneId below). Run the test process in
// the same zone so fixtures' day() agrees with the app around midnight UTC.
process.env.TZ = 'Asia/Singapore'

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
    // Built into its own folder with a fake Supabase project (mocked in e2e/fixtures.ts),
    // so it never overwrites the real `dist` that CI deploys.
    command: `npx vite build --outDir dist-e2e && npx vite preview --outDir dist-e2e --port ${PORT} --strictPort`,
    env: { VITE_SUPABASE_URL: 'https://e2e-project.supabase.co', VITE_SUPABASE_ANON_KEY: 'e2e-anon-key' },
    url: BASE,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
