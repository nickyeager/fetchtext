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
 *
 * Points to https://fetchtext.io instead of localhost.
 *
 * Runs two categories of tests:
 *   1. Production-specific tests  — tests/e2e/production/**
 *   2. Production-safe local tests — auth smoke, upload validation, UI smoke
 *
 * Tests detect the target via `baseURL` and use the shared env helper
 * (tests/e2e/helpers/env.ts) to resolve credentials and backend URLs.
 *
 * Usage:
 *   pnpm test:production                    # headless
 *   pnpm test:production:headed             # visible browser
 *   pnpm test:production -- --grep "PDF"    # filter by name
 */
export default defineConfig({
  testDir: './tests/e2e',
  // Run production-designated specs + production-safe local tests
  testMatch: [
    '**/production/**/*.pw.spec.ts',
    '**/auth/00-auth-smoke.pw.spec.ts',
    '**/ui-smoke/02-basic-app-shell.pw.spec.ts',
    '**/document-processing/stucco-upload-e2e.pw.spec.ts',
  ],
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 1,
  workers: 1,
  reporter: [
    ['list'],
    ['html', { outputFolder: '/tmp/playwright-report-production', open: 'never' }],
  ],
  outputDir: '/tmp/test-results-production',
  // Skip global setup for production (each test handles its own auth)
  globalSetup: undefined,
  use: {
    // Production base URL — tests use helpers/env.ts to detect this
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
