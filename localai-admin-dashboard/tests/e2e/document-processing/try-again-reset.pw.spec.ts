/**
 * Try Again Button — E2E Reset Flow
 *
 * Verifies that clicking "Try Again" after a processing error fully resets
 * the upload UI: the processing log disappears, the drop zone returns to
 * its ready state, and the user can upload a new document.
 *
 * Approach: upload a real fixture file but abort the SSE network request
 * via Playwright route interception to simulate a connection failure. This
 * triggers the same error state a user would see with a network drop.
 *
 * Run:
 *   cd localai-admin-dashboard
 *   E2E_SKIP_GLOBAL_SETUP=1 npx playwright test tests/e2e/document-processing/try-again-reset.pw.spec.ts --reporter=list
 */

import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test, expect } from '@playwright/test';
import { getCredentials, getBackendUrl } from '../helpers/env';
import {
  createLogger,
  uiLogin,
  navigateToWorkflow,
  monitorConsole,
} from '../helpers/auth';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixturePath = path.resolve(__dirname, '../../fixtures/real-test-contract.txt');

const SCREENSHOT_DIR = '/tmp/try-again-e2e';
const log = createLogger('try-again');

test.describe('Try Again Button — Reset Flow', () => {
  test.setTimeout(120_000);

  test.beforeAll(() => {
    if (!fs.existsSync(fixturePath)) {
      throw new Error(`Fixture not found: ${fixturePath}`);
    }
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  });

  test('backend is healthy before test', async () => {
    const backendUrl = getBackendUrl();
    const resp = await fetch(`${backendUrl}/health`, {
      signal: AbortSignal.timeout(30_000),
    });
    expect(resp.ok, `Backend unhealthy: ${resp.status}`).toBe(true);
    log('backend healthy');
  });

  test('clicking Try Again after error resets UI to clean upload state', async ({
    page,
  }) => {
    const { email, password } = getCredentials();
    const consoleErrors = monitorConsole(page, log);

    // ── Intercept the SSE endpoint to simulate a network failure ──
    // This is NOT a service mock — it simulates a real connection drop
    // that users experience in production (e.g., Azure Container Apps
    // recycling, network timeout, etc.)
    await page.route('**/process-document-stream**', (route) => {
      log('aborting SSE request to trigger error state');
      route.abort('connectionfailed');
    });

    // ── Login ──
    await uiLogin(page, email, password, log);
    log('logged in');

    // ── Navigate to upload page ──
    await navigateToWorkflow(page, '/documents/upload', email, password, log);
    log('on upload page');

    // ── Verify initial state: drop zone visible, no processing log ──
    const dropZone = page.locator('[data-testid="drop-zone"]');
    await expect(dropZone).toBeVisible({ timeout: 15_000 });
    await expect(dropZone).not.toHaveClass(/opacity-50/, { timeout: 5_000 });

    const processingLogHeader = page.locator('[data-testid="processing-log-header"]');
    await expect(processingLogHeader).not.toBeVisible({ timeout: 3_000 });

    // Verify the "Smart Document Processing" help text is visible
    const helpText = page.getByText('Smart Document Processing');
    await expect(helpText).toBeVisible({ timeout: 5_000 });

    await page.screenshot({ path: `${SCREENSHOT_DIR}/01-initial-state.png` });
    log('initial state verified: drop zone ready, no processing log');

    // ── Upload file to trigger SSE (which will be aborted) ──
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(fixturePath);
    log('file selected — SSE will be aborted');

    // ── Wait for processing log to appear with error state ──
    // The aborted SSE request should cause the processing hook to enter
    // the 'error' status, which renders the ProcessingLog with "Processing Error"
    await expect(processingLogHeader).toBeVisible({ timeout: 30_000 });
    log('processing log appeared');

    // Wait for the error state to settle
    await expect(async () => {
      const headerText = await processingLogHeader.textContent();
      expect(headerText).toContain('Error');
    }).toPass({ timeout: 15_000, intervals: [500, 1_000] });
    log('processing log shows error state');

    await page.screenshot({ path: `${SCREENSHOT_DIR}/02-error-state.png` });

    // ── Verify the "Try Again" button is visible ──
    const tryAgainButton = page.getByRole('button', { name: 'Try Again' });
    await expect(tryAgainButton).toBeVisible({ timeout: 5_000 });
    log('Try Again button visible');

    // ── Click "Try Again" ──
    await tryAgainButton.click();
    log('clicked Try Again');

    // ── Verify UI has fully reset ──

    // 1. Processing log should be gone
    await expect(processingLogHeader).not.toBeVisible({ timeout: 5_000 });
    log('processing log gone');

    // 2. Drop zone should be visible and enabled (not disabled/dimmed)
    await expect(dropZone).toBeVisible({ timeout: 5_000 });
    await expect(dropZone).not.toHaveClass(/opacity-50/, { timeout: 5_000 });
    log('drop zone visible and enabled');

    // 3. The help text ("Smart Document Processing") should be back
    await expect(helpText).toBeVisible({ timeout: 5_000 });
    log('help text visible again');

    // 4. The "Try Again" button should be gone
    await expect(tryAgainButton).not.toBeVisible({ timeout: 3_000 });
    log('Try Again button gone');

    // 5. No error alert should be visible
    const errorBanner = page.locator('[data-testid="processing-error-banner"]');
    await expect(errorBanner).not.toBeVisible({ timeout: 3_000 });
    log('no error banner visible');

    await page.screenshot({ path: `${SCREENSHOT_DIR}/03-reset-state.png` });

    // ── Verify user can upload again ──
    // Remove the route interception so the second upload can proceed normally
    await page.unroute('**/process-document-stream**');
    log('SSE interception removed — next upload will hit real backend');

    // The drop zone should accept a new file (not be disabled)
    const isDisabled = await dropZone.evaluate(
      (el) => el.classList.contains('cursor-not-allowed') || el.classList.contains('opacity-50')
    );
    expect(isDisabled, 'Drop zone should not be disabled after reset').toBe(false);
    log('drop zone accepts input — user can upload again');

    await page.screenshot({ path: `${SCREENSHOT_DIR}/04-ready-for-reupload.png` });

    // ── Filter console errors ──
    // Expected noise from this test:
    //   - SSE abort: net::ERR_CONNECTION_FAILED, Failed to fetch, SSE error, fetch failed
    //   - Login:     Invalid Refresh Token (stale token), 400 Bad Request (browser resource error)
    //   - Both:      "Failed to load resource" browser-level messages
    const filteredErrors = consoleErrors.filter(
      (e) =>
        !e.text.includes('connectionfailed') &&
        !e.text.includes('net::ERR_FAILED') &&
        !e.text.includes('net::ERR_CONNECTION_FAILED') &&
        !e.text.includes('Failed to fetch') &&
        !e.text.includes('Failed to load resource') &&
        !e.text.includes('SSE error') &&
        !e.text.includes('fetch failed') &&
        !e.text.includes('Connection lost') &&
        !e.text.includes('AuthRetryableFetchError') &&
        !e.text.includes('Invalid Refresh Token'),
    );

    expect(
      filteredErrors,
      `Unexpected console errors:\n${filteredErrors.map((e) => `  [${e.type}] ${e.text}`).join('\n')}`,
    ).toHaveLength(0);

    log('Test PASSED');
  });
});
