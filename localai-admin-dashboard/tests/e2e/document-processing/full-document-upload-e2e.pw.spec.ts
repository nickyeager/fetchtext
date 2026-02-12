import 'dotenv/config';
import { test, expect } from '@playwright/test';
import { preflight } from '../utils/preflight';

// ESM-safe resolution of fixture path
const contractPath = new URL(
  '../../fixtures/real-test-contract.txt',
  import.meta.url
).pathname;

interface ConsoleEntry {
  type: string;
  text: string;
  timestamp: Date;
}

function log(step: string) {
  // eslint-disable-next-line no-console
  console.log(`[full-e2e] ${step}`);
}

/**
 * Perform UI login. Tries /(auth)/sign-in first, then /sign-in as fallback.
 * Returns once the browser is on an authenticated route.
 */
async function uiLogin(
  page: import('@playwright/test').Page,
  email: string,
  password: string
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
      timeout: 20_000,
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
 * Re-navigate to workflowUrl. If the page redirects back to sign-in, retry login once.
 */
async function navigateToWorkflow(
  page: import('@playwright/test').Page,
  workflowUrl: string,
  email: string,
  password: string
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
      timeout: 20_000,
    });
    log('retry login done, reloading workflow');
    await page.goto(workflowUrl, { waitUntil: 'domcontentloaded' });
  }
}

/**
 * Set up console error monitoring. Returns the array that errors are pushed into.
 */
function monitorConsole(page: import('@playwright/test').Page): ConsoleEntry[] {
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
 * Assert that no critical console errors occurred (RLS, storage, auth failures).
 * Non-critical noise (React dev warnings, favicon 404, etc.) is allowed.
 */
function assertNoCriticalErrors(errors: ConsoleEntry[]) {
  // Filter out known-benign noise: stale refresh tokens from E2E_SKIP_GLOBAL_SETUP,
  // fetch failures during initial auth bootstrap, and generic network retries.
  const ignoredPatterns = [
    'Invalid Refresh Token',
    'Failed to fetch',
    'Authentication failed',
    'authentication expired',
    'Failed to load resource',
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
    log(`\n=== CRITICAL ERRORS ===\n${summary}`);
  }

  expect(
    critical,
    `Critical console errors detected:\n${critical.map((e) => e.text).join('\n')}`
  ).toHaveLength(0);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe('Full E2E Document Upload & Processing', () => {
  test.setTimeout(240_000); // 4 minutes overall

  test('Test 1: Generic document processing (no template)', async ({
    page,
  }) => {
    // ── Preflight ──
    log('starting preflight');
    await preflight({
      log: (...a) => log(`[preflight] ${a.join(' ')}`),
    });
    log('preflight passed');

    const email = process.env.TEST_USER_EMAIL;
    const password = process.env.TEST_USER_PASSWORD;
    if (!email || !password)
      throw new Error('TEST_USER_EMAIL / TEST_USER_PASSWORD not set');

    const consoleErrors = monitorConsole(page);

    // ── Login ──
    await uiLogin(page, email, password);

    // ── Navigate to generic workflow (no templateId) ──
    await navigateToWorkflow(
      page,
      '/documents/process-document',
      email,
      password
    );

    // ── Select file ──
    const fileInput = page.locator('[data-testid="document-file-input"]');
    log('waiting for file input');
    await expect(fileInput).toBeVisible({ timeout: 15_000 });

    log('setting input file');
    await fileInput.setInputFiles(contractPath);

    // ── Assert file selected ──
    const uploaded = page.locator('[data-testid="document-uploaded"]');
    await expect(uploaded).toContainText('Selected:', { timeout: 5_000 });
    await expect(uploaded).toContainText('real-test-contract.txt');
    log('file selected OK');

    // ── Wait for processing to start ──
    const processingInit = page.locator('[data-testid="processing-init"]');
    await expect(processingInit).toBeAttached({ timeout: 10_000 });
    log('processing-init appeared');

    // ── Verify backend is healthy (unhealthy marker should NOT appear) ──
    const unhealthy = page.locator(
      '[data-testid="processing-backend-unhealthy"]'
    );
    // Give a short window to confirm it doesn't appear
    await expect(unhealthy).not.toBeAttached({ timeout: 3_000 });
    log('backend healthy OK');

    // ── Verify generic extraction mode ──
    const extractionMode = page.locator('[data-testid="extraction-mode"]');
    await expect(extractionMode).toBeAttached({ timeout: 15_000 });
    const mode = await extractionMode.getAttribute('data-mode');
    expect(mode).toBe('generic');
    log(`extraction-mode = ${mode}`);

    // ── Wait for generic processing started ──
    const genericStarted = page.locator(
      '[data-testid="processing-generic-started"]'
    );
    await expect(genericStarted).toBeAttached({ timeout: 15_000 });
    log('generic processing started');

    // ── Wait for processing completion (up to 180s for LLM on CPU) ──
    log('waiting for processing completion (up to 180s)...');
    const genericResult = page.locator(
      '[data-testid="generic-processed-document"]'
    );
    const templateResult = page.locator('[data-testid="document-processed"]');
    // Either result container should become visible
    await expect(genericResult.or(templateResult)).toBeVisible({
      timeout: 180_000,
    });
    log('processing complete — result container visible');

    // ── Verify document metadata is displayed ──
    // Generic processing shows format, pages, and template suggestions
    await expect(page.getByText('Format:').first()).toBeVisible({
      timeout: 5_000,
    });
    await expect(page.getByText('Template Suggestions').first()).toBeVisible({
      timeout: 5_000,
    });
    log('document metadata verified on page');

    // ── Take screenshot for evidence ──
    await page.screenshot({
      path: '/tmp/full-e2e-generic-result.png',
      fullPage: true,
    });

    // ── Console error check ──
    assertNoCriticalErrors(consoleErrors);
    log('Test 1 PASSED');
  });

  test('Test 2: Template-guided document processing', async ({ page }) => {
    // ── Preflight ──
    log('starting preflight');
    await preflight({
      log: (...a) => log(`[preflight] ${a.join(' ')}`),
    });
    log('preflight passed');

    const email = process.env.TEST_USER_EMAIL;
    const password = process.env.TEST_USER_PASSWORD;
    const templateId = process.env.TEST_TEMPLATE_ID;
    if (!email || !password)
      throw new Error('TEST_USER_EMAIL / TEST_USER_PASSWORD not set');
    if (!templateId)
      throw new Error(
        'TEST_TEMPLATE_ID not set — required for template-guided test'
      );

    const consoleErrors = monitorConsole(page);

    // ── Login ──
    await uiLogin(page, email, password);

    // ── Navigate with templateId ──
    const workflowUrl = `/documents/process-document?templateId=${encodeURIComponent(templateId)}&templateSource=smart_templates`;
    await navigateToWorkflow(page, workflowUrl, email, password);

    // ── Confirm template info rendered ──
    // Wait for "Extraction Settings" card which always appears when a template is loaded
    log('waiting for template card to load');
    await expect(
      page.getByText('Extraction Settings').first()
    ).toBeVisible({ timeout: 15_000 });
    log('template loaded');

    // ── Select file ──
    const fileInput = page.locator('[data-testid="document-file-input"]');
    await expect(fileInput).toBeVisible({ timeout: 15_000 });
    log('setting input file');
    await fileInput.setInputFiles(contractPath);

    // ── Assert file selected ──
    const uploaded = page.locator('[data-testid="document-uploaded"]');
    await expect(uploaded).toContainText('Selected:', { timeout: 5_000 });
    log('file selected OK');

    // ── Wait for processing to start ──
    const processingInit = page.locator('[data-testid="processing-init"]');
    await expect(processingInit).toBeAttached({ timeout: 10_000 });
    log('processing started');

    // ── Verify template extraction mode ──
    const extractionMode = page.locator('[data-testid="extraction-mode"]');
    await expect(extractionMode).toBeAttached({ timeout: 15_000 });
    const mode = await extractionMode.getAttribute('data-mode');
    expect(
      mode === 'template-progressive' || mode === 'template-standard'
    ).toBe(true);
    log(`extraction-mode = ${mode}`);

    // ── Wait for processing completion (up to 180s) ──
    log('waiting for template extraction to complete (up to 180s)...');

    // Wait for any single completion signal (check individually to avoid strict mode)
    const completionLocators = [
      page.locator('[data-testid="extracted-fields"]'),
      page.locator('[data-testid="progressive-complete"]'),
      page.locator('[data-testid="document-processed"]'),
      page.locator('[data-testid="document-evaluation"]'),
    ];

    // Poll until at least one completion element is attached
    await expect(async () => {
      const counts = await Promise.all(
        completionLocators.map((l) => l.count())
      );
      expect(counts.some((c) => c > 0)).toBe(true);
    }).toPass({ timeout: 180_000, intervals: [500, 1_000, 2_000] });
    log('extraction complete');

    // ── Verify extracted fields exist ──
    // If progressive mode was used, extracted-fields may be inside document-evaluation
    // If standard mode, it's inside document-processed
    const fieldElements = page.locator('[data-testid="extracted-field"]');
    const fieldCount = await fieldElements.count();
    log(`found ${fieldCount} extracted field(s)`);

    if (fieldCount > 0) {
      // Verify at least one field has content
      const firstField = fieldElements.first();
      await expect(firstField).toBeVisible({ timeout: 5_000 });
      const fieldText = await firstField.textContent();
      expect(fieldText?.length).toBeGreaterThan(0);
      log(`first extracted field content: ${fieldText?.substring(0, 100)}`);
    } else {
      // Even without extracted-field elements, the result containers should be visible
      // (progressive extraction shows ProgressiveExtractionDisplay instead)
      const anyResult = await page.locator('[data-testid="document-evaluation"]')
        .or(page.locator('[data-testid="document-processed"]'))
        .isVisible();
      expect(
        anyResult,
        'Expected either extracted fields or a result container to be visible'
      ).toBe(true);
      log('no extracted-field elements but result container is visible');
    }

    // ── Take screenshot for evidence ──
    await page.screenshot({
      path: '/tmp/full-e2e-template-result.png',
      fullPage: true,
    });

    // ── Console error check ──
    assertNoCriticalErrors(consoleErrors);
    log('Test 2 PASSED');
  });
});
