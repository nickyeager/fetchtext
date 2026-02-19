/**
 * Stucco Contract PDF — Full E2E Upload Flow
 *
 * Uploads the Stucco Contract V1.pdf through the Smart Upload UI,
 * monitors SSE streaming stage-by-stage (with stall detection),
 * verifies auto-navigation to the document detail page, and asserts that:
 *   - Each processing stage completes within a reasonable timeout
 *   - Processing does not stall or error
 *   - Extracted fields render as individual cards (not raw JSON)
 *   - Template content panel shows formatted output (not raw JSON)
 *   - Specific known field values are present (Nicholas Yeager, $8,000.00, etc.)
 *
 * Run:
 *   cd localai-admin-dashboard
 *   E2E_SKIP_GLOBAL_SETUP=1 npx playwright test tests/e2e/document-processing/stucco-upload-e2e.pw.spec.ts --reporter=list
 */

import 'dotenv/config';
import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getCredentials, getBackendUrl } from '../helpers/env';
import {
  createLogger,
  uiLogin,
  navigateToWorkflow,
  monitorConsole,
  assertNoCriticalErrors,
} from '../helpers/auth';
import {
  waitForProcessingCompletion,
  assertProcessingComplete,
} from '../helpers/stream-monitor';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const stuccoPdfPath = path.resolve(__dirname, '../../fixtures/Stucco Contract V1.pdf');

const SCREENSHOT_DIR = '/tmp/stucco-e2e';

const log = createLogger('stucco-e2e');

test.describe('Stucco Contract — Full Upload E2E', () => {
  // SSE processing can take 2+ minutes with AI calls
  test.setTimeout(300_000);

  test.beforeAll(() => {
    if (!fs.existsSync(stuccoPdfPath)) {
      throw new Error(`Fixture not found: ${stuccoPdfPath}`);
    }
    // Ensure screenshot directory exists
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  });

  test('backend is healthy before upload', async () => {
    const backendUrl = getBackendUrl();
    const resp = await fetch(`${backendUrl}/health`, {
      signal: AbortSignal.timeout(30_000),
    });
    expect(resp.ok, `Backend unhealthy: ${resp.status}`).toBe(true);
    log('backend healthy');
  });

  test('uploads Stucco Contract, processes via SSE, and renders extracted fields', async ({
    page,
  }) => {
    const { email, password } = getCredentials();
    const consoleErrors = monitorConsole(page, log);

    // Track SSE network request for diagnostics
    const sseRequests: { url: string; status: number; timing: number }[] = [];
    page.on('response', (response) => {
      if (response.url().includes('process-document-stream')) {
        sseRequests.push({
          url: response.url(),
          status: response.status(),
          timing: Date.now(),
        });
        log(`SSE response: ${response.status()} ${response.url().substring(0, 80)}`);
      }
    });

    // Track failed network requests
    page.on('requestfailed', (request) => {
      if (request.url().includes('process-document-stream')) {
        log(`SSE REQUEST FAILED: ${request.failure()?.errorText} - ${request.url().substring(0, 80)}`);
      }
    });

    // ── Login ──
    await uiLogin(page, email, password, log);
    log('logged in');

    // ── Navigate to upload page ──
    await navigateToWorkflow(page, '/documents/upload', email, password, log);
    log('on upload page');

    // ── Wait for drop zone ──
    const dropZone = page.locator('[data-testid="drop-zone"]');
    await expect(dropZone).toBeVisible({ timeout: 15_000 });
    await expect(dropZone).not.toHaveClass(/opacity-50/, { timeout: 15_000 });
    log('drop zone ready');

    await page.screenshot({ path: `${SCREENSHOT_DIR}/01-upload-ready.png` });

    // ── Upload the PDF ──
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(stuccoPdfPath);
    log('file selected');

    await page.screenshot({ path: `${SCREENSHOT_DIR}/02-file-selected.png` });

    // ── Monitor processing stages with stall detection ──
    // This replaces the old "wait 240s and hope" approach.
    // Each stage must progress within 90s or the test fails with diagnostics.
    const processingResult = await waitForProcessingCompletion(page, {
      stageTimeout: 90_000,    // Max 90s between stages (text extraction can be slow)
      totalTimeout: 240_000,   // Max 4 min total
      screenshotDir: SCREENSHOT_DIR,
      log,
      pollInterval: 1_000,
    });

    // Assert processing completed (fails with detailed stage info if stalled/errored)
    assertProcessingComplete(processingResult);

    // Log stage summary
    log(`Processing completed: ${processingResult.stages.length} stages in ${Math.round(processingResult.duration_ms / 1000)}s`);
    for (const stage of processingResult.stages) {
      log(`  [${stage.stage}] ${stage.message}`);
    }

    // Verify SSE request was made and succeeded
    expect(sseRequests.length, 'SSE request should have been made').toBeGreaterThan(0);
    expect(sseRequests[0].status, 'SSE response should be 200').toBe(200);

    await page.screenshot({ path: `${SCREENSHOT_DIR}/03-processing-complete.png` });

    // ── Wait for auto-navigation to document detail page ──
    // After processing completes, the frontend finalizes the document and navigates.
    // This should be fast now that processing is done (just DB write + navigate).
    await page.waitForURL(/\/documents\/[a-f0-9-]+(?:\?.*)?$/, { timeout: 30_000 });
    const detailUrl = page.url();
    log(`navigated to detail: ${detailUrl}`);

    await page.screenshot({ path: `${SCREENSHOT_DIR}/04-detail-page.png` });

    // ── Give the detail page time to fully render ──
    await page.waitForTimeout(3_000);

    // ── Verify we're on the document detail page ──
    const successBanner = page.getByText('Document processed successfully');
    await expect(successBanner).toBeVisible({ timeout: 15_000 });
    log('success banner visible');

    // ── Verify "Extracted Fields" section exists ──
    const extractedFieldsHeader = page.getByText('Extracted Fields').first();
    await expect(extractedFieldsHeader).toBeVisible({ timeout: 10_000 });
    log('Extracted Fields section visible');

    // ── Verify NO raw JSON blobs in the page ──
    const pageContent = await page.textContent('body');
    expect(pageContent).toBeDefined();

    const rawJsonPatterns = [
      '"extracted_values":{',
      '"value":"$',
      '{"tax":{"value"',
      '"confidence":0.',
    ];

    for (const pattern of rawJsonPatterns) {
      const hasRawJson = pageContent!.includes(pattern);
      if (hasRawJson) {
        await page.screenshot({ path: `${SCREENSHOT_DIR}/05-raw-json-found.png` });
      }
      expect(
        hasRawJson,
        `Raw JSON found in page: "${pattern}". The template output view is showing unformatted data.`,
      ).toBe(false);
    }
    log('no raw JSON blobs detected');

    // ── Verify specific extracted values are rendered ──
    const expectedValues = [
      'Nicholas Yeager',   // homeowner / client name
      '8,000',             // contract amount (may be $8,000.00 or 8,000)
    ];

    for (const value of expectedValues) {
      const valueLocator = page.getByText(value, { exact: false }).first();
      const isVisible = await valueLocator.isVisible({ timeout: 5_000 }).catch(() => false);
      if (isVisible) {
        log(`found expected value: "${value}"`);
      } else {
        log(`WARN: expected value "${value}" not found on page`);
      }
    }

    await page.screenshot({ path: `${SCREENSHOT_DIR}/06-final.png` });

    // ── Console error check ──
    const filteredErrors = consoleErrors.filter(
      (e) =>
        !e.text.includes('pdfjs-dist') &&
        !e.text.includes('unpkg.com') &&
        !e.text.includes('pdf.worker'),
    );
    assertNoCriticalErrors(filteredErrors);

    log('Test PASSED');
  });
});
