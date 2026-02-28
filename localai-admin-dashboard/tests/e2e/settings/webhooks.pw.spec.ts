/**
 * E2E Test: Webhook Subscriptions Settings Page
 *
 * Tests the full webhook management UI flow:
 * 1. Navigate to /settings/webhooks
 * 2. Create a webhook subscription
 * 3. Verify it appears in the list
 * 4. Toggle it off/on
 * 5. Test the webhook (expects success or failure depending on endpoint)
 * 6. Delete the webhook
 *
 * NO MOCKS - all real API calls to document-processor backend.
 *
 * Requires:
 * - Frontend running (localhost:5173)
 * - Document processor running (localhost:8090)
 * - Supabase running with webhook_subscriptions table
 * - TEST_USER_EMAIL and TEST_USER_PASSWORD in .env.e2e
 */

import { test, expect } from '@playwright/test';
import { uiLogin, monitorConsole, assertNoCriticalErrors, createLogger } from '../helpers/auth';
import { getCredentials, getBackendUrl, detectTarget } from '../helpers/env';

const log = createLogger('Webhooks');

test.describe('Webhook Subscriptions Settings', () => {
  // Use serial mode — tests build on each other (create → toggle → test → delete)
  test.describe.configure({ mode: 'serial' });

  // Stable name across all tests in this describe block
  const TEST_WEBHOOK_NAME = `E2E Test Hook ${Date.now()}`;
  const TEST_WEBHOOK_URL = `https://httpbin.org/post`;

  test('backend webhook endpoints are accessible', async ({ page }) => {
    const target = detectTarget(page.url());
    const { email, password } = getCredentials(target);
    await uiLogin(page, email, password, log);

    const backendUrl = getBackendUrl();

    // Health check
    const health = await fetch(`${backendUrl}/health`);
    expect(health.status).toBe(200);

    // Webhook events endpoint (requires auth, so 401 is expected)
    const events = await fetch(`${backendUrl}/api/webhooks/events`);
    expect([200, 401, 403]).toContain(events.status);

    log(`Backend healthy, webhook endpoints registered`);
  });

  test('navigate to webhooks settings page', async ({ page }) => {
    const target = detectTarget(page.url());
    const { email, password } = getCredentials(target);
    await uiLogin(page, email, password, log);
    const errors = monitorConsole(page, log);

    await page.goto('/settings/webhooks', { waitUntil: 'networkidle' });

    // Use the heading specifically to avoid matching sidebar nav items
    await expect(page.getByRole('heading', { name: 'Webhooks' })).toBeVisible({ timeout: 10_000 });
    await expect(
      page.getByText('Send document events to external systems')
    ).toBeVisible();

    // "Add Webhook" button should exist
    await expect(
      page.getByRole('button', { name: 'Add Webhook' })
    ).toBeVisible();

    log('Webhooks settings page rendered correctly');
    assertNoCriticalErrors(errors);
  });

  test('create a webhook subscription', async ({ page }) => {
    const target = detectTarget(page.url());
    const { email, password } = getCredentials(target);
    await uiLogin(page, email, password, log);
    const errors = monitorConsole(page, log);

    await page.goto('/settings/webhooks', { waitUntil: 'networkidle' });
    await expect(page.getByRole('heading', { name: 'Webhooks' })).toBeVisible({ timeout: 10_000 });

    // Click "Add Webhook"
    await page.getByRole('button', { name: 'Add Webhook' }).click();

    // Dialog should appear
    await expect(
      page.getByText('Add Webhook Subscription')
    ).toBeVisible({ timeout: 5_000 });

    // Fill the form
    await page.getByLabel('Name').fill(TEST_WEBHOOK_NAME);
    await page.getByLabel('Endpoint URL').fill(TEST_WEBHOOK_URL);

    // Click "Create Webhook"
    await page.getByRole('button', { name: 'Create Webhook' }).click();

    // Wait for success toast
    await expect(page.getByText('Webhook created')).toBeVisible({
      timeout: 10_000,
    });

    // Verify the webhook appears in the list
    await expect(page.getByText(TEST_WEBHOOK_NAME)).toBeVisible({
      timeout: 5_000,
    });
    await expect(page.getByText(TEST_WEBHOOK_URL)).toBeVisible();

    // Should show "Active" badge
    await expect(page.getByText('Active').first()).toBeVisible();

    log('Webhook created and visible in list');
    assertNoCriticalErrors(errors);
  });

  test('toggle webhook off and on', async ({ page }) => {
    const target = detectTarget(page.url());
    const { email, password } = getCredentials(target);
    await uiLogin(page, email, password, log);
    const errors = monitorConsole(page, log);

    await page.goto('/settings/webhooks', { waitUntil: 'networkidle' });
    await expect(page.getByText(TEST_WEBHOOK_NAME)).toBeVisible({
      timeout: 10_000,
    });

    // Find the card containing our webhook and its toggle switch
    const webhookCard = page
      .locator('[data-slot="card"]', { has: page.getByText(TEST_WEBHOOK_NAME) })
      .or(page.locator('.rounded-xl.border', { has: page.getByText(TEST_WEBHOOK_NAME) }));
    const toggle = webhookCard.getByRole('switch');
    await toggle.click();

    // Wait for "Webhook paused" toast
    await expect(page.getByText('Webhook paused')).toBeVisible({
      timeout: 10_000,
    });

    // Should now show "Paused" badge
    await expect(webhookCard.getByText('Paused')).toBeVisible({
      timeout: 5_000,
    });

    // Toggle back on
    await toggle.click();
    await expect(page.getByText('Webhook activated')).toBeVisible({
      timeout: 10_000,
    });

    log('Webhook toggled off and back on');
    assertNoCriticalErrors(errors);
  });

  test('test webhook delivery', async ({ page }) => {
    const target = detectTarget(page.url());
    const { email, password } = getCredentials(target);
    await uiLogin(page, email, password, log);
    const errors = monitorConsole(page, log);

    await page.goto('/settings/webhooks', { waitUntil: 'networkidle' });
    await expect(page.getByText(TEST_WEBHOOK_NAME)).toBeVisible({
      timeout: 10_000,
    });

    // Click the "Test" button on our webhook
    const webhookCard = page
      .locator('[data-slot="card"]', { has: page.getByText(TEST_WEBHOOK_NAME) })
      .or(page.locator('.rounded-xl.border', { has: page.getByText(TEST_WEBHOOK_NAME) }));
    await webhookCard.getByRole('button', { name: 'Test' }).click();

    // Wait for result toast (success or failure depending on endpoint)
    const successToast = page.getByText('Test event delivered successfully');
    const failureToast = page.getByText('Test failed');

    await expect(successToast.or(failureToast)).toBeVisible({
      timeout: 15_000,
    });

    log('Test webhook delivery attempted');
    assertNoCriticalErrors(errors);
  });

  test('delete webhook subscription', async ({ page }) => {
    const target = detectTarget(page.url());
    const { email, password } = getCredentials(target);
    await uiLogin(page, email, password, log);
    const errors = monitorConsole(page, log);

    await page.goto('/settings/webhooks', { waitUntil: 'networkidle' });
    await expect(page.getByText(TEST_WEBHOOK_NAME)).toBeVisible({
      timeout: 10_000,
    });

    // Click the delete button (trash icon) on our webhook
    const webhookCard = page
      .locator('[data-slot="card"]', { has: page.getByText(TEST_WEBHOOK_NAME) })
      .or(page.locator('.rounded-xl.border', { has: page.getByText(TEST_WEBHOOK_NAME) }));
    // The delete button has text-destructive class and contains the Trash2 svg
    await webhookCard.locator('button:has(svg.lucide-trash-2)').click();

    // Wait for "Webhook deleted" toast
    await expect(page.getByText('Webhook deleted')).toBeVisible({
      timeout: 10_000,
    });

    // Webhook should no longer appear
    await expect(page.getByText(TEST_WEBHOOK_NAME)).not.toBeVisible({
      timeout: 5_000,
    });

    log('Webhook deleted successfully');
    assertNoCriticalErrors(errors);
  });
});
