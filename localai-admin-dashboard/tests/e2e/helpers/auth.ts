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
 */
export async function navigateToWorkflow(
  page: Page,
  workflowUrl: string,
  email: string,
  password: string,
  log: (msg: string) => void = () => {},
) {
  log(`navigating to ${workflowUrl}`);
  await page.goto(workflowUrl, { waitUntil: 'domcontentloaded' });

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
    await page.goto(workflowUrl, { waitUntil: 'domcontentloaded' });
  }
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
 * Filters out known benign noise (stale tokens, fetch failures, etc.).
 */
export function assertNoCriticalErrors(errors: ConsoleEntry[]) {
  const ignoredPatterns = [
    'Invalid Refresh Token',
    'Failed to fetch',
    'Authentication failed',
    'authentication expired',
    'Failed to load resource',
    'extended attributes',
    'Supabase storage upload error',
  ];

  const critical = errors.filter(
    (e) =>
      !ignoredPatterns.some((p) => e.text.includes(p)) &&
      (e.text.includes('row-level security') ||
        e.text.includes('RLS') ||
        e.text.includes('policy') ||
        e.text.includes('storage') ||
        e.text.includes('403') ||
        e.text.includes('401'))
  );

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
