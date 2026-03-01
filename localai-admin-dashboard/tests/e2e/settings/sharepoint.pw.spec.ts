/**
 * E2E Test: SharePoint Integration Settings
 * Tests navigation to integrations page and SharePoint card visibility.
 * Full OAuth flow requires Microsoft 365 dev tenant.
 */
import { test, expect } from '@playwright/test';
import { uiLogin, monitorConsole, assertNoCriticalErrors, createLogger } from '../helpers/auth';
import { getCredentials, detectTarget } from '../helpers/env';

const log = createLogger('SharePoint');

test.describe('SharePoint Integration Settings', () => {
  test('integrations page shows SharePoint card', async ({ page }) => {
    const target = detectTarget(page.url());
    const { email, password } = getCredentials(target);
    await uiLogin(page, email, password, log);
    const errors = monitorConsole(page, log);

    await page.goto('/settings/integrations', { waitUntil: 'networkidle' });
    await expect(page.getByRole('heading', { name: 'Integrations' })).toBeVisible({ timeout: 10_000 });

    // SharePoint card should be visible
    await expect(page.getByText('SharePoint & OneDrive')).toBeVisible({ timeout: 5_000 });

    log('SharePoint integration card visible');
    assertNoCriticalErrors(errors);
  });
});
