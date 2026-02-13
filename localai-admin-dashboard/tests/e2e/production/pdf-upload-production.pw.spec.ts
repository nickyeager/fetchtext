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
  type ConsoleEntry,
} from '../helpers/auth';

// ESM-safe resolution of fixture path (handles spaces in filename)
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const stuccoPdfPath = path.resolve(__dirname, '../../fixtures/Stucco Contract V1.pdf');

const log = createLogger('prod-pdf-upload');

/**
 * Production PDF Upload E2E Test
 *
 * Uploads the Stucco Contract V1.pdf through the real UI at fetchtext.io
 * (or localhost when run locally). Validates:
 *   1. Login works
 *   2. Upload page renders (no CORS-blocked JS bundles)
 *   3. PDF file accepted and processing starts
 *   4. No CORS errors in console (the primary regression this catches)
 *   5. No critical RLS/storage/auth errors
 *
 * IMPORTANT: The CORS header test runs FIRST (lightweight API call) so the
 * backend isn't overwhelmed by PDF processing when we check CORS headers.
 *
 * Run against production:
 *   npx playwright test --config=playwright.production.config.ts tests/e2e/production/pdf-upload-production.pw.spec.ts
 *
 * Run against localhost:
 *   E2E_SKIP_GLOBAL_SETUP=1 npx playwright test tests/e2e/production/pdf-upload-production.pw.spec.ts
 */

test.describe('Production PDF Upload — Stucco Contract', () => {
  test.setTimeout(240_000); // 4 minutes

  test.beforeAll(() => {
    if (!fs.existsSync(stuccoPdfPath)) {
      throw new Error(`Fixture not found: ${stuccoPdfPath}`);
    }
  });

  // ── CORS header test runs FIRST (lightweight, no PDF processing load) ──
  test('verifies CORS headers returned for production origin', async () => {
    const baseURL = test.info().project.use.baseURL || '';
    const resolvedTarget = baseURL.includes('fetchtext.io') ? 'production' as const : 'local' as const;
    const backendUrl = getBackendUrl(resolvedTarget);
    const testOrigin =
      resolvedTarget === 'production'
        ? 'https://fetchtext.io'
        : 'http://localhost:5173';

    log(`testing CORS headers: origin=${testOrigin} backend=${backendUrl}`);

    // Use Node's native fetch (not page.request) to avoid inheriting
    // browser page state which can cause timeouts or stale connections.
    // Retry up to 3 times since Azure Container Apps can return 502/503
    // on cold-start.
    let response: Response | null = null;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        response = await fetch(`${backendUrl}/health`, {
          headers: { Origin: testOrigin },
          signal: AbortSignal.timeout(60_000),
        });
        if (response.ok) break;
        log(`attempt ${attempt}/3 returned ${response.status} ${response.statusText}`);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        log(`attempt ${attempt}/3 failed: ${msg}`);
      }
      if (attempt < 3) {
        const waitMs = attempt * 10_000;
        log(`retrying in ${waitMs / 1000}s...`);
        await new Promise((r) => setTimeout(r, waitMs));
      }
    }

    expect(response, 'All 3 fetch attempts to backend health failed').not.toBeNull();
    log(`response status: ${response!.status}`);
    expect(
      response!.ok,
      `Backend health returned ${response!.status} ${response!.statusText} at ${backendUrl}/health`
    ).toBe(true);

    const acaoHeader = response!.headers.get('access-control-allow-origin');
    log(`access-control-allow-origin: ${acaoHeader}`);

    expect(
      acaoHeader,
      `Expected Access-Control-Allow-Origin header for ${testOrigin}`
    ).toBe(testOrigin);

    log('Test PASSED — CORS headers correct');
  });

  // ── PDF upload test runs SECOND (triggers heavy backend processing) ──
  test('uploads Stucco Contract V1.pdf and processes without CORS errors', async ({
    page,
  }) => {
    // Use baseURL from the Playwright project config to detect target
    const baseURL = test.info().project.use.baseURL || '';
    const resolvedTarget = baseURL.includes('fetchtext.io') ? 'production' as const : 'local' as const;
    const { email, password } = getCredentials(resolvedTarget);
    const backendUrl = getBackendUrl(resolvedTarget);

    log(`target=${resolvedTarget}, baseURL=${baseURL}, backend=${backendUrl}`);

    // ── CORS-specific error tracking ──
    const corsErrors: ConsoleEntry[] = [];
    const consoleErrors = monitorConsole(page, log);

    page.on('console', (msg) => {
      const text = msg.text();
      if (
        text.includes('CORS') ||
        text.includes('cors') ||
        text.includes('Access-Control-Allow-Origin') ||
        text.includes('blocked by CORS') ||
        text.includes('cross-origin')
      ) {
        corsErrors.push({
          type: 'cors',
          text,
          timestamp: new Date(),
        });
        log(`[CORS ERROR] ${text}`);
      }
    });

    // Also track failed network requests (CORS blocks show as network failures)
    const networkFailures: string[] = [];
    page.on('requestfailed', (req) => {
      const failure = req.failure();
      if (failure) {
        networkFailures.push(`${req.method()} ${req.url()} → ${failure.errorText}`);
        log(`[NETWORK FAIL] ${req.method()} ${req.url()} → ${failure.errorText}`);
      }
    });

    // ── Backend health check ──
    log('checking backend health');
    const healthResp = await page.request.get(`${backendUrl}/health`, {
      timeout: 15_000,
    });
    expect(healthResp.ok(), `Backend unhealthy at ${backendUrl}/health`).toBe(true);

    // ── CORS config check ──
    log('checking CORS config endpoint');
    const corsResp = await page.request.get(`${backendUrl}/health/cors`, {
      timeout: 15_000,
    });
    expect(corsResp.ok()).toBe(true);
    const corsData = await corsResp.json();
    log(`CORS allowed origins: ${JSON.stringify(corsData.allowed_origins)}`);

    if (resolvedTarget === 'production') {
      expect(
        corsData.allowed_origins.some((o: string) => o.includes('fetchtext.io')),
        `Production backend CORS must include fetchtext.io. Got: ${corsData.allowed_origins}`
      ).toBe(true);
    }

    // ── Login ──
    await uiLogin(page, email, password, log);
    await page.screenshot({ path: '/tmp/prod-pdf-01-after-login.png' });

    // ── Navigate to upload page ──
    await navigateToWorkflow(page, '/documents/upload', email, password, log);
    await page.screenshot({ path: '/tmp/prod-pdf-02-upload-page.png' });

    // ── Wait for drop zone to be ready ──
    const dropZone = page.locator('[data-testid="drop-zone"]');
    await expect(dropZone).toBeVisible({ timeout: 15_000 });
    await expect(dropZone).not.toHaveClass(/opacity-50/, { timeout: 15_000 });
    log('drop zone ready');

    // ── Upload the Stucco Contract PDF ──
    const fileInput = page.locator('input[type="file"]');
    log(`uploading ${stuccoPdfPath}`);
    await fileInput.setInputFiles(stuccoPdfPath);

    // ── Verify file is accepted (not rejected by validation) ──
    // Error state should NOT appear
    const uploadError = page.getByText('Upload Error');
    const hasError = await uploadError.isVisible({ timeout: 3_000 }).catch(() => false);
    if (hasError) {
      const errorText = await page.locator('[data-testid="drop-zone"]').textContent();
      throw new Error(`PDF upload rejected: ${errorText}`);
    }

    // ── Verify processing starts ──
    // Look for analyzing/processing indicators
    log('waiting for processing to start');
    await expect(
      page
        .getByText('Analyzing Document')
        .or(page.getByText('Analyzing document...'))
        .or(page.getByText('Processing'))
        .first()
    ).toBeVisible({ timeout: 30_000 });
    log('processing started');

    await page.screenshot({ path: '/tmp/prod-pdf-03-processing.png' });

    // ── Wait for processing to progress (don't need full completion) ──
    // Just verify the backend call succeeded (no CORS block)
    await page.waitForTimeout(10_000);
    await page.screenshot({ path: '/tmp/prod-pdf-04-after-wait.png' });

    // ── CORS assertions ──
    if (corsErrors.length > 0) {
      log('\n=== CORS ERRORS DETECTED ===');
      corsErrors.forEach((e, i) => log(`  ${i + 1}. ${e.text}`));
    }
    expect(
      corsErrors,
      `CORS errors detected during PDF upload:\n${corsErrors.map((e) => e.text).join('\n')}`
    ).toHaveLength(0);

    // ── Network failure assertions ──
    // Filter for backend API failures only (CORS blocks manifest as network errors).
    // Use the actual backend URL and port — NOT substring 'document-processor' which
    // also matches frontend JS bundles like document-processor-enhanced-B2geOlv6.js.
    const backendFailures = networkFailures.filter(
      (f) =>
        f.includes(backendUrl) ||
        f.includes(':8090/')
    );
    if (backendFailures.length > 0) {
      log('\n=== BACKEND NETWORK FAILURES ===');
      backendFailures.forEach((f) => log(`  ${f}`));
    }
    expect(
      backendFailures,
      `Backend network failures (likely CORS):\n${backendFailures.join('\n')}`
    ).toHaveLength(0);

    // ── General console error check ──
    assertNoCriticalErrors(consoleErrors);

    log('Test PASSED — PDF uploaded without CORS errors');
  });
});
