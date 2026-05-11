import { defineConfig } from '@playwright/test';
import baseConfig from './playwright.config';

/**
 * Configuration for integration tests
 * @see https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  ...baseConfig,
  testDir: './tests/integration',
  /* Run integration tests sequentially */
  fullyParallel: false,
  workers: 1,
  /* Different output for integration tests */
  reporter: [['html', { outputFolder: 'playwright-integration-report' }]],
  use: {
    ...baseConfig.use,
    /* Longer timeouts for integration tests */
    actionTimeout: 30000,
    navigationTimeout: 30000,
  },
});