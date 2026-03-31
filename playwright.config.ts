import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright E2E test configuration for ShiftSwap
 * Video recording enabled for all tests
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false, // Run sequentially for the full loop test
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: 'html',
  
  use: {
    baseURL: process.env.TEST_BASE_URL || 'http://localhost:3000',
    trace: 'on-first-retry',
    video: 'on', // Record video for ALL tests
    screenshot: 'on',
  },

  outputDir: './e2e/test-results',

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
  },
});
