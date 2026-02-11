import 'dotenv/config';
import { test, expect } from '@playwright/test';

/**
 * Production Document Upload Test
 *
 * Tests document upload flow against the live fetchtext.io site.
 * Monitors for console errors (especially RLS/storage errors).
 *
 * Environment Variables Required:
 * - PROD_TEST_USER_EMAIL: Production test account email
 * - PROD_TEST_USER_PASSWORD: Production test account password
 *
 * Run with:
 *   npx playwright test --config=playwright.production.config.ts
 */

// ESM-safe resolution of fixture path
const contractPath = new URL('../../fixtures/real-test-contract.txt', import.meta.url).pathname;

interface ConsoleError {
  type: string;
  text: string;
  timestamp: Date;
}

test.describe('Production Document Upload', () => {
  test.setTimeout(180_000); // 3 minutes for production tests

  test('uploads document and monitors for RLS/storage errors', async ({ page }) => {
    const consoleErrors: ConsoleError[] = [];
    const consoleWarnings: ConsoleError[] = [];

    // Capture all console messages
    page.on('console', (msg) => {
      const text = msg.text();
      if (msg.type() === 'error') {
        consoleErrors.push({
          type: msg.type(),
          text: text,
          timestamp: new Date(),
        });
        console.log(`[CONSOLE ERROR] ${text}`);
      } else if (msg.type() === 'warning' && (text.includes('RLS') || text.includes('storage') || text.includes('policy'))) {
        consoleWarnings.push({
          type: msg.type(),
          text: text,
          timestamp: new Date(),
        });
        console.log(`[CONSOLE WARNING] ${text}`);
      }
    });

    // Capture page errors
    page.on('pageerror', (error) => {
      console.log(`[PAGE ERROR] ${error.message}`);
      consoleErrors.push({
        type: 'pageerror',
        text: error.message,
        timestamp: new Date(),
      });
    });

    // Get credentials from environment
    const email = process.env.PROD_TEST_USER_EMAIL;
    const password = process.env.PROD_TEST_USER_PASSWORD;

    if (!email || !password) {
      throw new Error('PROD_TEST_USER_EMAIL and PROD_TEST_USER_PASSWORD must be set');
    }

    console.log('[PROD TEST] Starting production document upload test');
    console.log(`[PROD TEST] Using email: ${email}`);

    // Navigate to sign-in page
    console.log('[PROD TEST] Navigating to sign-in page');
    await page.goto('/sign-in', { waitUntil: 'networkidle' });

    // Take screenshot of login page
    await page.screenshot({ path: '/tmp/prod-test-01-login-page.png' });

    // Fill in login form
    const emailInput = page.getByPlaceholder('name@example.com');
    const passwordInput = page.getByPlaceholder('********');
    const loginButton = page.getByRole('button', { name: 'Login' });

    await expect(emailInput).toBeVisible({ timeout: 10000 });
    console.log('[PROD TEST] Filling login form');

    await emailInput.fill(email);
    await passwordInput.fill(password);

    await page.screenshot({ path: '/tmp/prod-test-02-login-filled.png' });

    // Click login
    console.log('[PROD TEST] Clicking login button');
    await loginButton.click();

    // Wait for navigation after login
    try {
      await page.waitForURL(/dashboard|documents/, { timeout: 30000 });
      console.log('[PROD TEST] Login successful, redirected to:', page.url());
    } catch (e) {
      await page.screenshot({ path: '/tmp/prod-test-03-login-failed.png' });
      console.log('[PROD TEST] Login may have failed, current URL:', page.url());

      // Check for error message
      const errorText = await page.locator('text=Invalid login credentials').isVisible().catch(() => false);
      if (errorText) {
        throw new Error('Login failed: Invalid credentials');
      }
    }

    await page.screenshot({ path: '/tmp/prod-test-04-after-login.png' });

    // Navigate to document upload page
    console.log('[PROD TEST] Navigating to document upload page');
    await page.goto('/documents/process-document', { waitUntil: 'networkidle' });

    await page.screenshot({ path: '/tmp/prod-test-05-upload-page.png' });

    // Wait for file input to be visible
    const fileInput = page.locator('[data-testid="document-file-input"]');
    await expect(fileInput).toBeVisible({ timeout: 15000 });
    console.log('[PROD TEST] File input visible');

    // Upload the test file
    console.log('[PROD TEST] Uploading test file:', contractPath);
    await fileInput.setInputFiles(contractPath);

    // Wait for file selection confirmation
    const uploadedIndicator = page.locator('[data-testid="document-uploaded"]');
    await expect(uploadedIndicator).toContainText('Selected:', { timeout: 10000 });
    console.log('[PROD TEST] File selected successfully');

    await page.screenshot({ path: '/tmp/prod-test-06-file-selected.png' });

    // First, select a template if one is suggested
    const selectTemplateButton = page.getByRole('button', { name: 'Select' });
    if (await selectTemplateButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      console.log('[PROD TEST] Selecting suggested template');
      await selectTemplateButton.first().click();
      await page.waitForTimeout(1000);
      await page.screenshot({ path: '/tmp/prod-test-06b-template-selected.png' });
    }

    // Scroll to see all buttons
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(500);

    // Look for the process/extract/submit button and click it
    const processButton = page.getByRole('button', { name: /Process|Extract|Upload|Submit|Start/i });
    if (await processButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      console.log('[PROD TEST] Clicking process button');
      await processButton.click();

      // Wait for processing to complete - this is when storage upload happens
      console.log('[PROD TEST] Waiting for document processing...');
      await page.waitForTimeout(10000);
      await page.screenshot({ path: '/tmp/prod-test-07-after-process.png' });

      // Check for any error toasts or messages
      const errorToast = page.locator('[data-sonner-toast][data-type="error"], .toast-error, [role="alert"]');
      if (await errorToast.isVisible({ timeout: 2000 }).catch(() => false)) {
        const errorText = await errorToast.textContent();
        console.log('[PROD TEST] Error toast detected:', errorText);
        consoleErrors.push({
          type: 'ui-error',
          text: `UI Error Toast: ${errorText}`,
          timestamp: new Date(),
        });
      }
    } else {
      console.log('[PROD TEST] No process button found - looking for other submit options');
      // Log all buttons visible on page
      const allButtons = await page.getByRole('button').all();
      for (const btn of allButtons) {
        const text = await btn.textContent().catch(() => 'unknown');
        console.log(`[PROD TEST] Found button: "${text}"`);
      }
    }

    // Wait a bit more to capture any delayed errors
    await page.waitForTimeout(3000);
    await page.screenshot({ path: '/tmp/prod-test-08-final.png' });

    // Report on console errors
    console.log('\n=== CONSOLE ERROR SUMMARY ===');
    console.log(`Total errors captured: ${consoleErrors.length}`);
    console.log(`Total RLS/storage warnings: ${consoleWarnings.length}`);

    if (consoleErrors.length > 0) {
      console.log('\nErrors:');
      consoleErrors.forEach((err, i) => {
        console.log(`  ${i + 1}. [${err.type}] ${err.text}`);
      });
    }

    if (consoleWarnings.length > 0) {
      console.log('\nWarnings:');
      consoleWarnings.forEach((warn, i) => {
        console.log(`  ${i + 1}. [${warn.type}] ${warn.text}`);
      });
    }

    // Check specifically for RLS policy errors
    const rlsErrors = consoleErrors.filter(e =>
      e.text.includes('row-level security') ||
      e.text.includes('RLS') ||
      e.text.includes('policy') ||
      e.text.includes('storage')
    );

    if (rlsErrors.length > 0) {
      console.log('\n=== RLS/STORAGE ERRORS DETECTED ===');
      rlsErrors.forEach((err, i) => {
        console.log(`  ${i + 1}. ${err.text}`);
      });

      // Fail the test with details about RLS errors
      expect(rlsErrors, 'RLS/Storage policy errors detected').toHaveLength(0);
    }

    console.log('[PROD TEST] Test completed');
  });

  test('checks storage bucket accessibility', async ({ page }) => {
    const email = process.env.PROD_TEST_USER_EMAIL;
    const password = process.env.PROD_TEST_USER_PASSWORD;

    if (!email || !password) {
      throw new Error('PROD_TEST_USER_EMAIL and PROD_TEST_USER_PASSWORD must be set');
    }

    // Login first
    await page.goto('/sign-in', { waitUntil: 'networkidle' });
    await page.getByPlaceholder('name@example.com').fill(email);
    await page.getByPlaceholder('********').fill(password);
    await page.getByRole('button', { name: 'Login' }).click();

    try {
      await page.waitForURL(/dashboard|documents/, { timeout: 30000 });
    } catch {
      console.log('Login may have failed');
    }

    // Try to access storage directly via Supabase client
    const storageCheckResult = await page.evaluate(async () => {
      // @ts-expect-error - Supabase client may be on window
      const supabase = window.supabase || window.__supabase;
      if (!supabase) {
        return { error: 'Supabase client not found on window' };
      }

      try {
        // Try to list files in the documents bucket
        const { data, error } = await supabase.storage.from('documents').list('', { limit: 1 });
        if (error) {
          return { error: error.message, code: error.code };
        }
        return { success: true, fileCount: data?.length || 0 };
      } catch (e: unknown) {
        return { error: e instanceof Error ? e.message : 'Unknown error' };
      }
    });

    console.log('[STORAGE CHECK]', JSON.stringify(storageCheckResult, null, 2));

    if (storageCheckResult.error) {
      console.log('[STORAGE CHECK] Storage access error:', storageCheckResult.error);
    }
  });
});
