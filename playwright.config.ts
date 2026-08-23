import { defineConfig, devices } from '@playwright/test'

const baseURL = process.env.E2E_BASE_URL

if (!baseURL) {
  throw new Error('E2E_BASE_URL is required and must be provided by the isolated runner.')
}

const parsedBaseURL = new URL(baseURL)
if (!['127.0.0.1', 'localhost', '::1'].includes(parsedBaseURL.hostname)) {
  throw new Error('E2E_BASE_URL must use loopback.')
}

export default defineConfig({
  testDir: './e2e',
  timeout: 120_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: [['line']],
  use: {
    ...devices['Desktop Chrome'],
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
  },
})
