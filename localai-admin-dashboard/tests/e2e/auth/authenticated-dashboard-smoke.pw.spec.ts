import 'dotenv/config';
import { test, expect } from '@playwright/test';

test.describe('Authenticated Dashboard', () => {
  test('renders after login', async ({ page }) => {
    const email = process.env.TEST_USER_EMAIL;
    const password = process.env.TEST_USER_PASSWORD;
    if (!email || !password) test.skip(true, 'Missing test credentials');

    // Login via UI
    await page.goto('/(auth)/sign-in');
    const emailInput = page.getByLabel('Email');
    if (!(await emailInput.isVisible({ timeout: 2000 }).catch(() => false))) {
      await page.goto('/sign-in');
    }
    await page.getByLabel('Email').fill(email!);
    await page.getByLabel('Password').fill(password!);
    await page.getByRole('button', { name: 'Login' }).click();

    // Expect redirect to an authenticated route (dashboard)
    await page.waitForURL(/_authenticated|dashboard/, { timeout: 20000 });
    await page.goto('/_authenticated/dashboard');

    // Assert some generic UI content is visible (adjust as needed)
    await expect(page.locator('body')).toBeVisible();
  });
});
