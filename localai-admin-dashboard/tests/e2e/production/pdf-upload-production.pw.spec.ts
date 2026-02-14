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
 *   1. CORS works FROM A REAL BROWSER (not Node fetch which bypasses CORS)
 *   2. Login works
 *   3. Upload page renders (no CORS-blocked JS bundles)
 *   4. PDF file accepted and processing starts
 *   5. No CORS errors in console (the primary regression this catches)
 *   6. No critical RLS/storage/auth errors
 *
 * IMPORTANT: Test 1 warms the backend (Azure cold starts return 503 without
 * CORS headers). Test 2 uses a real browser to verify CORS from the frontend
 * origin. Test 3 does the full PDF upload flow.
 *
 * Run against production:
 *   npx playwright test --config=playwright.production.config.ts tests/e2e/production/pdf-upload-production.pw.spec.ts
 *
 * Run against localhost:
 *   E2E_SKIP_GLOBAL_SETUP=1 npx playwright test tests/e2e/production/pdf-upload-production.pw.spec.ts
 */

/**
 * Warm the backend with Node fetch (bypasses CORS, handles Azure cold starts).
 * Returns true if backend responded 200 within retries.
 */
async function warmBackend(backendUrl: string): Promise<boolean> {
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const resp = await fetch(`${backendUrl}/health`, {
        signal: AbortSignal.timeout(60_000),
      });
      if (resp.ok) {
        log(`backend warm (attempt ${attempt})`);
        return true;
      }
      log(`warm attempt ${attempt}/4 returned ${resp.status}`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      log(`warm attempt ${attempt}/4 failed: ${msg}`);
    }
    if (attempt < 4) {
      const waitMs = attempt * 15_000;
      log(`retrying in ${waitMs / 1000}s...`);
      await new Promise((r) => setTimeout(r, waitMs));
    }
  }
  return false;
}

test.describe('Production PDF Upload — Stucco Contract', () => {
  test.setTimeout(240_000); // 4 minutes

  test.beforeAll(() => {
    if (!fs.existsSync(stuccoPdfPath)) {
      throw new Error(`Fixture not found: ${stuccoPdfPath}`);
    }
  });

  // ── TEST 1: Warm backend + verify config (Node fetch, no CORS enforcement) ──
  test('backend is reachable and CORS config includes production origin', async () => {
    const baseURL = test.info().project.use.baseURL || '';
    const resolvedTarget = baseURL.includes('fetchtext.io') ? 'production' as const : 'local' as const;
    const backendUrl = getBackendUrl(resolvedTarget);

    log(`warming backend: ${backendUrl}`);
    const isWarm = await warmBackend(backendUrl);
    expect(isWarm, `Backend unreachable after 4 attempts at ${backendUrl}/health`).toBe(true);

    // Verify /health/cors returns the right origins
    const corsResp = await fetch(`${backendUrl}/health/cors`, {
      signal: AbortSignal.timeout(30_000),
    });
    expect(corsResp.ok, `/health/cors returned ${corsResp.status}`).toBe(true);
    const corsData = await corsResp.json();
    log(`CORS allowed origins: ${JSON.stringify(corsData.allowed_origins)}`);

    if (resolvedTarget === 'production') {
      expect(
        corsData.allowed_origins.some((o: string) => o.includes('fetchtext.io')),
        `Production CORS must include fetchtext.io. Got: ${corsData.allowed_origins}`
      ).toBe(true);
    }

    log('Test PASSED — backend warm, CORS config correct');
  });

  // ── TEST 2: BROWSER-BASED CORS verification ──
  // This is the critical test. Node fetch (Test 1) does NOT enforce CORS.
  // Only a real browser enforces CORS preflight and origin checks.
  // If this test fails, the frontend CANNOT talk to the backend.
  test('browser can fetch backend /health without CORS errors', async ({ page }) => {
    const baseURL = test.info().project.use.baseURL || '';
    const resolvedTarget = baseURL.includes('fetchtext.io') ? 'production' as const : 'local' as const;
    const backendUrl = getBackendUrl(resolvedTarget);
    const frontendUrl = resolvedTarget === 'production'
      ? 'https://fetchtext.io'
      : 'http://localhost:5173';

    log(`browser CORS test: frontend=${frontendUrl} backend=${backendUrl}`);

    // Navigate to the frontend origin so fetch() runs from that origin
    await page.goto(frontendUrl, { waitUntil: 'domcontentloaded', timeout: 30_000 });

    // Execute fetch FROM THE BROWSER — this enforces real CORS policy
    const result = await page.evaluate(async (url: string) => {
      try {
        const resp = await fetch(url, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
          mode: 'cors',
          credentials: 'omit',
        });
        const body = await resp.json().catch(() => null);
        return {
          ok: resp.ok,
          status: resp.status,
          corsHeader: resp.headers.get('access-control-allow-origin'),
          body,
          error: null,
        };
      } catch (err: any) {
        return {
          ok: false,
          status: 0,
          corsHeader: null,
          body: null,
          error: err?.message || String(err),
        };
      }
    }, `${backendUrl}/health`);

    log(`browser fetch result: ${JSON.stringify(result)}`);

    // If the fetch failed with a TypeError, it's a CORS block
    if (result.error) {
      // Take screenshot for debugging
      await page.screenshot({ path: '/tmp/prod-cors-browser-fail.png' });
    }

    expect(
      result.error,
      `Browser fetch to ${backendUrl}/health failed with CORS error: ${result.error}. ` +
      `This means the backend is not returning Access-Control-Allow-Origin for ${frontendUrl}. ` +
      `Node fetch passes but the REAL BROWSER is blocked.`
    ).toBeNull();

    expect(
      result.ok,
      `Browser fetch to ${backendUrl}/health returned ${result.status} (not 200)`
    ).toBe(true);

    log('Test PASSED — browser CORS verification succeeded');
  });

  // ── TEST 3: Full PDF upload flow ──
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
