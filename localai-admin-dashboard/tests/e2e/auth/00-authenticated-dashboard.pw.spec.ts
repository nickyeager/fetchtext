import 'dotenv/config';
import { test, expect } from '@playwright/test';

// Runs first due to filename. Performs a real UI login and verifies dashboard renders.
test.describe('Top Authenticated Dashboard', () => {
  test('logs in via UI and shows dashboard', async ({ page }) => {
    const email = process.env.TEST_USER_EMAIL;
    const password = process.env.TEST_USER_PASSWORD;
    if (!email || !password) {
      test.skip(true, 'Missing TEST_USER_EMAIL/TEST_USER_PASSWORD');
    }

    // Warm SPA to avoid initial race conditions (script/bootstrap loads)
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    // Attempt up to 3 tries (handles early client-side redirects / aborted nav)
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        await page.goto('/(auth)/sign-in', { waitUntil: 'domcontentloaded' });
      } catch (err) {
        if (attempt === 3) throw err;
        // Small backoff then retry navigation
        await page.waitForTimeout(400 * attempt);
        continue;
      }
      let emailInput = page.getByPlaceholder('name@example.com');
      let passwordInput = page.getByPlaceholder('********');
      let loginButton = page.getByRole('button', { name: 'Login' });
      if (!(await emailInput.isVisible({ timeout: 1500 }).catch(() => false))) {
        await page.goto('/sign-in', { waitUntil: 'domcontentloaded' });
        emailInput = page.getByPlaceholder('name@example.com');
        passwordInput = page.getByPlaceholder('********');
        loginButton = page.getByRole('button', { name: 'Login' });
      }

      const alreadyRedirected = /_authenticated|dashboard/.test(page.url());
      if (!alreadyRedirected) {
        // Make sure form inputs are there before filling
        await expect(emailInput).toBeVisible({ timeout: 5000 });
        await expect(passwordInput).toBeVisible({ timeout: 5000 });
        await emailInput.fill(email!);
        await passwordInput.fill(password!);
        await loginButton.click();
      }

      try {
        await page.waitForURL(/_authenticated|dashboard/, { timeout: 20000 });
        break; // success
      } catch (err) {
        if (attempt === 3) throw err;
      }
    }

    // Navigate explicitly to dashboard (SSR fallback may differ)
    await page.goto('/_authenticated/dashboard', { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/_authenticated\/dashboard/);
    // Basic visible body + ensure root element hydrated
    await expect(page.locator('#root')).toBeVisible();
    const childCount = await page.evaluate(() => document.getElementById('root')?.childElementCount || 0);
    expect(childCount).toBeGreaterThan(0);
  });
});
