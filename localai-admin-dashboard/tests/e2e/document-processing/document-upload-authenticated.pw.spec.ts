import 'dotenv/config';
import { test, expect } from '@playwright/test';
import { preflight } from '../utils/preflight';

function logStep(step: string) {
  if (process.env.E2E_DEBUG || process.env.E2E_DEBUG_UPLOAD) {
    /* eslint-disable no-console */
    console.log(`[upload-auth] ${step}`);
    /* eslint-enable no-console */
  }
}

// ESM-safe resolution of fixture path (fixtures are at tests/fixtures/*)
// From tests/e2e/*, the correct relative path to fixtures is ../fixtures/*
const contractPath = new URL('../../fixtures/real-test-contract.txt', import.meta.url).pathname;

// Requires: successful globalSetup generating storageState with an authenticated session
// Env vars: TEST_USER_EMAIL / TEST_USER_PASSWORD / SUPABASE_URL / SUPABASE_ANON_KEY
// Purpose: Verify that an authenticated user can reach the process-document workflow shell
//          and select a file (local client-side confirmation only).

test.describe('Authenticated Document Upload', () => {
  test.setTimeout(120_000); // Allow extra time for auth + navigation
  test('selects a file (optionally with template) and reveals selection metadata', async ({ page }) => {
  // Preflight validations (env + health)
  logStep('starting preflight');
  await preflight({ log: (...a) => { if (process.env.E2E_DEBUG || process.env.E2E_DEBUG_UPLOAD) { /* eslint-disable no-console */ console.log('[upload-auth][preflight]', ...a); /* eslint-enable no-console */ } } });
  logStep('preflight complete');
  const email = process.env.TEST_USER_EMAIL;
  const password = process.env.TEST_USER_PASSWORD;
  if (!email || !password) throw new Error('TEST_USER_EMAIL/TEST_USER_PASSWORD not set');

  // Always perform UI login to ensure deterministic session
  // Try preferred route, then fallback
  logStep('navigating to sign-in');
  await page.goto('/sign-in', { waitUntil: 'domcontentloaded' });
  let emailInput = page.getByPlaceholder('name@example.com');
  let loginButton = page.getByRole('button', { name: 'Login' });
  if (!(await emailInput.isVisible({ timeout: 2000 }).catch(() => false))) {
    logStep('fallback to /sign-in route');
    await page.goto('/sign-in', { waitUntil: 'domcontentloaded' });
    emailInput = page.getByPlaceholder('name@example.com');
    loginButton = page.getByRole('button', { name: 'Login' });
  }
  // If the login form is visible, perform login; otherwise, assume already authenticated
  if (await loginButton.isVisible().catch(() => false)) {
    logStep('performing UI login');
    await emailInput.fill(email);
    await page.getByPlaceholder('********').fill(password);
    await loginButton.click();
    // Wait for post-login routing; allow any authenticated path
    await page.waitForURL(/dashboard|documents/, { timeout: 20000 });
    logStep('login navigation complete');
  } else {
    logStep('login form not visible; assuming session already authenticated');
    // Ensure we're on an authenticated route
    await page.waitForURL(/dashboard|documents/, { timeout: 20000 });
  }

  // Navigate to workflow (optionally with templateId + smart_templates source)
  // RouteTree shows this route is accessible at '/documents/process-document'
  const templateId = process.env.TEST_TEMPLATE_ID;
  const workflowUrl = templateId
    ? `/documents/process-document?templateId=${encodeURIComponent(templateId)}&templateSource=smart_templates`
    : '/documents/process-document';
  logStep(`navigating to workflow: ${workflowUrl}`);
  await page.goto(workflowUrl, { waitUntil: 'domcontentloaded' });
  // If redirected back to sign-in, retry login once and navigate again
  const onSignin = await page.locator('text=Login').first().isVisible().catch(() => false);
  if (onSignin) {
    logStep('redirected back to sign-in, retrying login');
    const retryEmail = page.getByPlaceholder('name@example.com');
    const retryPwd = page.getByPlaceholder('********');
    const retryBtn = page.getByRole('button', { name: 'Login' });
    await expect(retryBtn).toBeVisible();
    await retryEmail.fill(email);
    await retryPwd.fill(password);
    await retryBtn.click();
    await page.waitForURL(/dashboard|documents/, { timeout: 20000 });
    logStep('retry login complete, reloading workflow');
    await page.goto(workflowUrl, { waitUntil: 'domcontentloaded' });
  }
  
  // If a templateId was provided, confirm the UI reflects it
  if (templateId) {
    await expect(page.getByText(new RegExp(`Template ID:\\s*${templateId}`))).toBeVisible();
    await expect(page.getByText(/Source:\s*smart_templates/)).toBeVisible();
  }
  const fileInput = page.locator('[data-testid="document-file-input"]');
  logStep('waiting for file input visible');
  await expect(fileInput).toBeVisible({ timeout: 15000 });

  // Use real text contract fixture
  logStep('setting file input with contract fixture');
  await fileInput.setInputFiles(contractPath);

  // Expect selection confirmation element (client-side only)
  const uploadedIndicator = page.locator('[data-testid="document-uploaded"]');
  logStep('asserting uploaded indicator text');
  await expect(uploadedIndicator).toContainText('Selected:', { timeout: 5000 });
  await expect(uploadedIndicator).toContainText('real-test-contract.txt');
  logStep('test complete (selection assertions passed)');
  });
});
