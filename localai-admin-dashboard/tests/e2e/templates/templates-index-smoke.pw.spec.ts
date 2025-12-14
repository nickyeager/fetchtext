import 'dotenv/config';
import { test, expect } from '@playwright/test';

test.describe('Templates Index - Authenticated Smoke', () => {
  test('navigates to Templates and renders core UI', async ({ page }) => {
    const email = process.env.TEST_USER_EMAIL;
    const password = process.env.TEST_USER_PASSWORD;
    if (!email || !password) test.skip(true, 'TEST_USER_EMAIL/TEST_USER_PASSWORD not set');

    // UI login (preferred and deterministic)
    await page.goto('/(auth)/sign-in');
    let emailInput = page.getByLabel('Email');
    let loginButton = page.getByRole('button', { name: 'Login' });
    if (!(await emailInput.isVisible({ timeout: 2000 }).catch(() => false))) {
      await page.goto('/sign-in');
      emailInput = page.getByLabel('Email');
      loginButton = page.getByRole('button', { name: 'Login' });
    }
    await expect(loginButton).toBeVisible();
    await emailInput.fill(email!);
    await page.getByLabel('Password').fill(password!);
    await loginButton.click();
    await page.waitForURL(/dashboard|_authenticated/, { timeout: 20000 });

    // Navigate to Templates index (child of authenticated layout)
    await page.goto('/templates');

    // Assert page heading and primary action exist
    await expect(page.getByRole('heading', { name: 'Templates' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Create Template' })).toBeVisible();

    // Handle either empty or populated states
    const emptyState = page.getByText('No templates yet');
    const anyTemplateCard = page.locator('[data-template-card]').first();
    await Promise.race([
      emptyState.waitFor({ state: 'visible', timeout: 3000 }).catch(() => {}),
      anyTemplateCard.waitFor({ state: 'attached', timeout: 3000 }).catch(() => {}),
    ]);
  });
});
