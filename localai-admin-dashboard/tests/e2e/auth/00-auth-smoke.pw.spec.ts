import { test, expect } from '@playwright/test';

// Minimal authenticated smoke test: relies on storageState (global setup) or prior UI login.
// Fast assertion to ensure protected route is accessible.
test.describe('Auth Smoke', () => {
  test('dashboard protected route renders', async ({ page }) => {
    await page.goto('/_authenticated/dashboard');
    // If not authenticated this will likely redirect to sign-in; detect that early.
    const redirectedToLogin = /(auth)\/sign-in|sign-in/.test(page.url());
    expect(redirectedToLogin).toBeFalsy();

    const childCount = await page.evaluate(() => document.getElementById('root')?.childElementCount || 0);
    expect(childCount).toBeGreaterThan(0);
  });
});
