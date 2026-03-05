/**
 * E2E Test: SSO Settings Page
 * Tests navigation and SSO configuration UI.
 */
import { test, expect } from '@playwright/test';
import { uiLogin, monitorConsole, assertNoCriticalErrors, createLogger } from '../helpers/auth';
import { getCredentials, detectTarget } from '../helpers/env';

const log = createLogger('SSO');

test.describe('SSO Settings', () => {
  test('navigate to SSO settings page', async ({ page }) => {
    const target = detectTarget(page.url());
    const { email, password } = getCredentials(target);
    await uiLogin(page, email, password, log);
    const errors = monitorConsole(page, log);

    await page.goto('/settings/organization', { waitUntil: 'networkidle' });

    // SSO settings should render
    await expect(page.getByRole('heading', { name: 'Single Sign-On' })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('ACS URL')).toBeVisible();

    log('SSO settings page rendered');
    assertNoCriticalErrors(errors);
  });
});
