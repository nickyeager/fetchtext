import { defineConfig, devices } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { config as loadEnv } from 'dotenv';

// Load environment variables
loadEnv();
try {
  const e2eEnvCandidates = [
    '.env.e2e.production',
    '.env.e2e',
    path.resolve('.env.e2e.production'),
  ];
  for (const p of e2eEnvCandidates) {
    if (fs.existsSync(p)) {
      loadEnv({ path: p, override: true });
      break;
    }
  }
} catch {
  // noop
}

/**
 * Production Playwright Configuration
 * Points to https://fetchtext.io instead of localhost
 */
export default defineConfig({
  testDir: './tests/e2e',
  // Only run production-designated specs
  testMatch: ['**/production/**/*.pw.spec.ts'],
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 1,
  workers: 1,
  reporter: [
    ['list'],
    ['html', { outputFolder: '/tmp/playwright-report-production', open: 'never' }],
  ],
  outputDir: '/tmp/test-results-production',
  // Skip global setup for production (we'll handle auth in the test)
  globalSetup: undefined,
  use: {
    // Production base URL
    baseURL: 'https://fetchtext.io',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    // Don't use stored auth state for production tests
    storageState: undefined,
    // Extra headers for production
    extraHTTPHeaders: {
      'Accept': 'application/json, text/html',
    },
  },

  projects: [
    {
      name: 'chromium-production',
      use: {
        ...devices['Desktop Chrome'],
        launchOptions: {
          slowMo: 200, // Slower for production to account for network latency
        }
      },
    },
  ],

  // No webServer for production - we're testing against live site
  webServer: undefined,
});
