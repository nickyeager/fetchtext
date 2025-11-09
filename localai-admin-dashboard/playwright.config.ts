import { defineConfig, devices } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { config as loadEnv } from 'dotenv';

// Preload environment for all workers: base .env then override with .env.e2e if present
loadEnv();
try {
  const e2eEnvCandidates = [
    '.env.e2e',
    path.resolve('.env.e2e'),
    path.resolve(process.cwd(), '.env.e2e'),
  ];
  for (const p of e2eEnvCandidates) {
    if (fs.existsSync(p)) {
      loadEnv({ path: p, override: true });
      break;
    }
  }
} catch {
  // noop – tests can still run without e2e env
}

/**
 * @see https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  testDir: './tests/e2e',
  // Only run Playwright-designated specs to avoid picking up Vitest-style tests
  testMatch: ['**/*.pw.spec.ts'],
  /* Run tests in files in parallel */
  fullyParallel: false, // Sequential for document processing tests
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,
  /* Opt out of parallel tests on CI. */
  workers: 1, // Single worker to avoid conflicts
  /* Reporters: human-readable CLI + persisted HTML (do not auto-open) */
  reporter: [
    ['list'],
    ['html', { outputFolder: '/tmp/playwright-report', open: 'never' }],
  ],
  outputDir: '/tmp/test-results',
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  // Allow skipping global setup (Supabase auth seeding) when E2E_SKIP_GLOBAL_SETUP=1
  globalSetup: process.env.E2E_SKIP_GLOBAL_SETUP === '1' ? undefined : './tests/auth/global-setup.ts',
  use: {
    /* Base URL to use in actions like `await page.goto('/')`. */
    baseURL: 'http://localhost:5174',
    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: 'on-first-retry',
    /* Screenshots */
    screenshot: 'only-on-failure',
    /* Video */
  video: 'retain-on-failure',
  storageState: fs.existsSync('playwright/.auth/user.json') ? 'playwright/.auth/user.json' : undefined,
  },

  /* Configure projects for major browsers */
  projects: [
    {
      name: 'chromium',
      use: { 
        ...devices['Desktop Chrome'],
        // Slow down for document processing
        launchOptions: {
          slowMo: 100,
        }
      },
    },

    // Uncomment to test on other browsers
    // {
    //   name: 'firefox',
    //   use: { ...devices['Desktop Firefox'] },
    // },

    // {
    //   name: 'webkit',
    //   use: { ...devices['Desktop Safari'] },
    // },
  ],

  /* Run your local dev server before starting the tests */
  webServer: [
    {
  command: 'pnpm build && pnpm preview --host localhost --port 5174 --strictPort',
  port: 5174,
      reuseExistingServer: true, // Always reuse existing server
  timeout: 60000,
    },
  ],
});