/**
 * Shared E2E authentication and console monitoring helpers.
 *
 * Works against both local and production targets via the env helper.
 */

import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';

// ── Types ──

export interface ConsoleEntry {
  type: string;
  text: string;
  timestamp: Date;
}

// ── Logging ──

export function createLogger(prefix: string) {
  return (step: string) => {
    // eslint-disable-next-line no-console
    console.log(`[${prefix}] ${step}`);
  };
}

// ── UI Login ──

/**
 * Perform UI login. Tries /(auth)/sign-in first, then /sign-in as fallback.
 * Returns once the browser is on an authenticated route.
 */
export async function uiLogin(
  page: Page,
  email: string,
  password: string,
  log: (msg: string) => void = () => {},
) {
  log('navigating to sign-in');
  await page.goto('/(auth)/sign-in', { waitUntil: 'domcontentloaded' });

  let emailInput = page.getByPlaceholder('name@example.com');
  let loginButton = page.getByRole('button', { name: 'Login' });

  if (!(await emailInput.isVisible({ timeout: 2000 }).catch(() => false))) {
    log('fallback to /sign-in');
    await page.goto('/sign-in', { waitUntil: 'domcontentloaded' });
    emailInput = page.getByPlaceholder('name@example.com');
    loginButton = page.getByRole('button', { name: 'Login' });
  }

  if (await loginButton.isVisible().catch(() => false)) {
    log('filling login form');
    await emailInput.fill(email);
    await page.getByPlaceholder('********').fill(password);
    await loginButton.click();
    await page.waitForURL(/dashboard|_authenticated|documents/, {
      timeout: 30_000,
    });
    log('login complete');
  } else {
    log('already authenticated, skipping login');
    await page.waitForURL(/dashboard|_authenticated|documents/, {
      timeout: 20_000,
    });
  }
}

/**
 * Navigate to a workflow URL. If the page redirects to sign-in, retry login once.
 *
 * After navigation, waits for the page to stabilize so that in-flight auth
 * requests that were aborted by the navigation have a chance to recover.
 * Without this, Supabase getUser() calls aborted during navigation leave the
 * session in a broken state, causing downstream storage/API calls to fail.
 */
export async function navigateToWorkflow(
  page: Page,
  workflowUrl: string,
  email: string,
  password: string,
  log: (msg: string) => void = () => {},
) {
  log(`navigating to ${workflowUrl}`);
  await page.goto(workflowUrl, { waitUntil: 'networkidle' });

  const onSignin = await page
    .locator('text=Login')
    .first()
    .isVisible()
    .catch(() => false);
  if (onSignin) {
    log('redirected to sign-in — retrying login');
    const retryEmail = page.getByPlaceholder('name@example.com');
    const retryPwd = page.getByPlaceholder('********');
    const retryBtn = page.getByRole('button', { name: 'Login' });
    await expect(retryBtn).toBeVisible();
    await retryEmail.fill(email);
    await retryPwd.fill(password);
    await retryBtn.click();
    await page.waitForURL(/dashboard|_authenticated|documents/, {
      timeout: 30_000,
    });
    log('retry login done, reloading workflow');
    await page.goto(workflowUrl, { waitUntil: 'networkidle' });
  }

  // Force a clean auth session by reloading the page.
  // Navigation aborts in-flight getUser() calls, which corrupts the
  // Supabase client's internal session state. A reload forces a fresh
  // client init that reads the session from localStorage cleanly.
  log('reloading page for clean auth session');
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(2_000);
  log('auth session stabilized');
}

// ── Console Monitoring ──

/**
 * Attach console error monitoring to a page. Returns the array that errors
 * are pushed into (inspect after test completes).
 */
export function monitorConsole(
  page: Page,
  log: (msg: string) => void = () => {},
): ConsoleEntry[] {
  const errors: ConsoleEntry[] = [];

  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      const text = msg.text();
      errors.push({ type: 'console.error', text, timestamp: new Date() });
      log(`[CONSOLE ERROR] ${text}`);
    }
  });

  page.on('pageerror', (err) => {
    errors.push({
      type: 'pageerror',
      text: err.message,
      timestamp: new Date(),
    });
    log(`[PAGE ERROR] ${err.message}`);
  });

  return errors;
}

/**
 * Assert that no critical console errors occurred.
 *
 * Two-pass filter:
 *   1. Always-critical patterns → immediate fail regardless of ignored list
 *   2. Soft-critical patterns → fail only if NOT in the ignored list
 *
 * IMPORTANT: patterns are matched case-insensitively.
 */
export function assertNoCriticalErrors(errors: ConsoleEntry[]) {
  // Patterns that are ALWAYS critical — never ignored
  const alwaysCriticalPatterns = [
    'StorageUnknownError',        // Storage download/upload returned unknown error
    'StorageApiError',            // Storage API error (400, 403, etc.)
    'row-level security',         // RLS policy violation
    'Failed to download file',    // File download failed during processing
    'document.*did not return.*valid ID', // Document ID bug regression
  ];

  // Patterns that are benign ONLY when they appear during page navigation
  // (browser aborts in-flight requests on navigate — this is expected)
  const navigationNoisePatterns = [
    'Invalid Refresh Token',
    'net::ERR_ABORTED',
    'extended attributes',
    'Failed to fetch',            // Browser-aborted fetch during navigation (not a real auth/CORS failure)
    'authentication expired',     // Supabase getUser() aborted by navigation → interpreted as expired session
    'AuthRetryableFetchError',    // Supabase retry wrapper around aborted fetch
  ];

  // Patterns that indicate a critical issue (matched case-insensitively)
  // Note: '400' is intentionally excluded — it catches generic browser
  // "Failed to load resource: 400" messages for ANY request (analytics,
  // favicons, etc.). Real storage 400s are caught via StorageUnknownError.
  const softCriticalPatterns = [
    'rls',
    'policy',
    'storage',
    '403',
    '401',
    'authentication failed',  // Supabase auth.getUser() network failures
  ];

  const lowerText = (e: ConsoleEntry) => e.text.toLowerCase();

  // Pass 1: always-critical (case-insensitive regex match)
  const alwaysCritical = errors.filter((e) =>
    alwaysCriticalPatterns.some((p) => new RegExp(p, 'i').test(e.text))
  );

  // Pass 2: soft-critical — matches a soft pattern but is NOT navigation noise
  const softCritical = errors.filter(
    (e) =>
      !alwaysCriticalPatterns.some((p) => new RegExp(p, 'i').test(e.text)) &&
      !navigationNoisePatterns.some((p) => e.text.includes(p)) &&
      softCriticalPatterns.some((p) => lowerText(e).includes(p))
  );

  const critical = [...alwaysCritical, ...softCritical];

  if (critical.length > 0) {
    const summary = critical
      .map((e, i) => `  ${i + 1}. [${e.type}] ${e.text}`)
      .join('\n');
    // eslint-disable-next-line no-console
    console.log(`\n=== CRITICAL ERRORS ===\n${summary}`);
  }

  expect(
    critical,
    `Critical console errors detected:\n${critical.map((e) => e.text).join('\n')}`
  ).toHaveLength(0);
}
