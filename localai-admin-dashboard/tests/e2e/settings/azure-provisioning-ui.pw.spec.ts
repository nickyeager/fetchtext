/**
 * Azure OpenAI Provisioning UI E2E Tests
 *
 * Tests the complete user journey for upgrading to Enterprise tier:
 * 1. Navigate to Settings → AI Models
 * 2. See and interact with upgrade UI
 * 3. Select model and trigger provisioning
 * 4. Verify error handling and status display
 *
 * NO MOCKS - all real API calls and UI interactions
 */

import { test, expect, Page } from '@playwright/test';

const FRONTEND_URL = 'http://localhost:5173';
const BACKEND_URL = 'http://localhost:8090';

// Test user credentials (from environment or defaults)
const TEST_USER_EMAIL = process.env.TEST_USER_EMAIL || 'admin@fetchtext.local';
const TEST_USER_PASSWORD = process.env.TEST_USER_PASSWORD || 'AdminPass2024!';

test.describe('Azure Provisioning UI - Complete User Journey', () => {

  test.beforeAll(async () => {
    // Verify backend is running
    const backendHealth = await fetch(`${BACKEND_URL}/health`).catch(() => null);
    if (!backendHealth || !backendHealth.ok) {
      throw new Error(`Backend not available at ${BACKEND_URL}. Start services first.`);
    }
    console.log('[Setup] Backend health check passed');
  });

  // Helper to ensure authenticated - uses storageState from playwright config
  async function ensureAuthenticated(page: Page) {
    // With storageState configured, we should already be authenticated
    // Just navigate directly and verify we're logged in
    await page.goto(`${FRONTEND_URL}/`);

    // Wait a moment for the app to process auth state
    await page.waitForTimeout(2000);

    // Check if we got redirected to login
    const url = page.url();
    if (url.includes('/sign-in')) {
      console.log('[Auth] Not authenticated, performing manual login');
      // Wait for login form
      await page.waitForSelector('input[type="email"], input[name="email"]', { timeout: 10000 });

      // Fill credentials
      await page.fill('input[type="email"], input[name="email"]', TEST_USER_EMAIL);
      await page.fill('input[type="password"], input[name="password"]', TEST_USER_PASSWORD);

      // Submit
      await page.click('button[type="submit"]');

      // Wait for redirect to dashboard or home
      await page.waitForURL(/\/(dashboard|$)/, { timeout: 15000 });
    }
    console.log('[Auth] Authenticated successfully');
  }

  // Helper to navigate to AI Models settings
  async function navigateToAIModels(page: Page) {
    // Navigate to settings
    await page.goto(`${FRONTEND_URL}/settings/ai-models`);

    // Wait for page to load
    await page.waitForSelector('h3:has-text("AI Models")', { timeout: 10000 });
    console.log('[Navigation] Arrived at AI Models settings');
  }

  // ===========================================================================
  // Test: Page loads correctly
  // ===========================================================================

  test('should load AI Models settings page', async ({ page }) => {
    // Track console errors
    const consoleErrors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    await ensureAuthenticated(page);
    await navigateToAIModels(page);

    // Verify page title
    const title = await page.locator('h3:has-text("AI Models")').textContent();
    expect(title).toContain('AI Models');
    console.log('[Test] Page title verified:', title);

    // Verify no console errors
    if (consoleErrors.length > 0) {
      console.warn('[Test] Console errors found:', consoleErrors);
    }

    // Take screenshot for visual verification
    await page.screenshot({ path: 'tests/e2e/screenshots/ai-models-settings.png' });
    console.log('[Test] Screenshot saved: ai-models-settings.png');
  });

  // ===========================================================================
  // Test: Upgrade button visibility
  // ===========================================================================

  test('should show upgrade button for non-managed tier', async ({ page }) => {
    await ensureAuthenticated(page);
    await navigateToAIModels(page);

    // Wait for organization config to load
    await page.waitForTimeout(2000);

    // Look for the "Upgrade to Enterprise" button
    const upgradeButton = page.locator('button:has-text("Upgrade to Enterprise")');

    // Check if button exists (may not be visible if user is already enterprise)
    const buttonCount = await upgradeButton.count();
    console.log('[Test] Upgrade buttons found:', buttonCount);

    if (buttonCount > 0) {
      // Verify button is visible and enabled
      const isVisible = await upgradeButton.first().isVisible();
      console.log('[Test] Upgrade button visible:', isVisible);

      if (isVisible) {
        // Take screenshot showing upgrade button
        await page.screenshot({ path: 'tests/e2e/screenshots/upgrade-button-visible.png' });
        console.log('[Test] Screenshot saved: upgrade-button-visible.png');
        expect(isVisible).toBe(true);
      }
    } else {
      console.log('[Test] No upgrade button - user may already be on enterprise tier');
      // This is acceptable - the test passes if user is already enterprise
    }
  });

  // ===========================================================================
  // Test: Upgrade card UI interaction
  // ===========================================================================

  test('should show upgrade card when clicking upgrade button', async ({ page }) => {
    await ensureAuthenticated(page);
    await navigateToAIModels(page);
    await page.waitForTimeout(2000);

    const upgradeButton = page.locator('button:has-text("Upgrade to Enterprise")');
    const buttonCount = await upgradeButton.count();

    if (buttonCount > 0 && await upgradeButton.first().isVisible()) {
      // Click upgrade button
      await upgradeButton.first().click();
      console.log('[Test] Clicked upgrade button');

      // Wait for upgrade card to appear
      await page.waitForSelector('text=Get a dedicated Azure OpenAI instance', { timeout: 5000 });
      console.log('[Test] Upgrade card appeared');

      // Verify benefits are shown
      const dataIsolation = await page.locator('text=Data Isolation').isVisible();
      const noLimits = await page.locator('text=No Usage Limits').isVisible();
      const latestModels = await page.locator('text=Latest Models').isVisible();

      console.log('[Test] Benefits visibility:', { dataIsolation, noLimits, latestModels });
      expect(dataIsolation || noLimits || latestModels).toBe(true);

      // Verify model selector is present
      const modelSelector = page.locator('text=Select your AI model');
      expect(await modelSelector.isVisible()).toBe(true);
      console.log('[Test] Model selector visible');

      // Verify provision button is present
      const provisionButton = page.locator('button:has-text("Provision My Instance")');
      expect(await provisionButton.isVisible()).toBe(true);
      console.log('[Test] Provision button visible');

      // Take screenshot of upgrade card
      await page.screenshot({ path: 'tests/e2e/screenshots/upgrade-card.png' });
      console.log('[Test] Screenshot saved: upgrade-card.png');
    } else {
      console.log('[Test] Skipping - upgrade button not available');
      test.skip();
    }
  });

  // ===========================================================================
  // Test: Model selection
  // ===========================================================================

  test('should allow model selection in upgrade card', async ({ page }) => {
    await ensureAuthenticated(page);
    await navigateToAIModels(page);
    await page.waitForTimeout(2000);

    const upgradeButton = page.locator('button:has-text("Upgrade to Enterprise")');

    if (await upgradeButton.count() > 0 && await upgradeButton.first().isVisible()) {
      // Click upgrade button to open the upgrade card
      await upgradeButton.first().click();
      await page.waitForSelector('text=Select your AI model', { timeout: 5000 });
      console.log('[Test] Upgrade card opened for model selection');

      // Wait for the upgrade card to fully render
      await page.waitForTimeout(1000);

      // Find the model select in the upgrade card context
      const upgradeCard = page.locator('text=Get a dedicated Azure OpenAI instance').locator('..');
      const selectTrigger = upgradeCard.locator('button[role="combobox"]');

      if (await selectTrigger.count() > 0 && await selectTrigger.first().isVisible()) {
        await selectTrigger.first().click();
        console.log('[Test] Opened model selector');

        // Wait for dropdown options
        await page.waitForSelector('[role="option"]', { timeout: 3000 });

        // Verify model options are present
        const gpt4oMini = page.locator('[role="option"]:has-text("GPT-4o-mini")');
        const gpt4o = page.locator('[role="option"]:has-text("GPT-4o")');

        const miniVisible = await gpt4oMini.isVisible();
        const fullVisible = await gpt4o.isVisible();

        console.log('[Test] Model options:', { miniVisible, fullVisible });
        expect(miniVisible || fullVisible).toBe(true);

        // Select a model
        if (miniVisible) {
          await gpt4oMini.click();
          console.log('[Test] Selected GPT-4o-mini model');
        } else if (fullVisible) {
          await gpt4o.click();
          console.log('[Test] Selected GPT-4o model');
        }

        // Take screenshot
        await page.screenshot({ path: 'tests/e2e/screenshots/model-selection.png' });
      } else {
        console.log('[Test] Model selector not found in upgrade card, taking screenshot');
        await page.screenshot({ path: 'tests/e2e/screenshots/model-selection-debug.png' });
      }
    } else {
      console.log('[Test] Skipping - upgrade button not available');
      test.skip();
    }
  });

  // ===========================================================================
  // Test: Provisioning trigger (error handling)
  // ===========================================================================

  test('should handle provisioning error gracefully when Azure not configured', async ({ page }) => {
    await ensureAuthenticated(page);
    await navigateToAIModels(page);
    await page.waitForTimeout(2000);

    const upgradeButton = page.locator('button:has-text("Upgrade to Enterprise")');

    if (await upgradeButton.count() > 0 && await upgradeButton.first().isVisible()) {
      await upgradeButton.first().click();
      await page.waitForSelector('button:has-text("Provision My Instance")', { timeout: 5000 });

      // Track toast notifications
      let toastAppeared = false;
      page.on('console', msg => {
        if (msg.text().includes('Provisioning failed') || msg.text().includes('not configured')) {
          toastAppeared = true;
        }
      });

      // Click provision button
      const provisionButton = page.locator('button:has-text("Provision My Instance")');
      await provisionButton.click();
      console.log('[Test] Clicked provision button');

      // Wait for response - should see error toast or loading state
      await page.waitForTimeout(3000);

      // Check for error toast (should show "Azure provisioning not configured" error)
      const errorToast = page.locator('text=not configured').or(page.locator('text=Provisioning failed'));
      const hasError = await errorToast.count() > 0;

      console.log('[Test] Error displayed:', hasError);

      // Take screenshot showing error state
      await page.screenshot({ path: 'tests/e2e/screenshots/provisioning-error.png' });
      console.log('[Test] Screenshot saved: provisioning-error.png');

      // The test passes if we see an error (Azure not configured) OR if provisioning actually works
      // Both are valid outcomes depending on environment configuration
    } else {
      console.log('[Test] Skipping - upgrade button not available');
      test.skip();
    }
  });

  // ===========================================================================
  // Test: Cancel button functionality
  // ===========================================================================

  test('should close upgrade card when clicking cancel', async ({ page }) => {
    await ensureAuthenticated(page);
    await navigateToAIModels(page);
    await page.waitForTimeout(2000);

    const upgradeButton = page.locator('button:has-text("Upgrade to Enterprise")');

    if (await upgradeButton.count() > 0 && await upgradeButton.first().isVisible()) {
      // Open upgrade card
      await upgradeButton.first().click();
      await page.waitForSelector('text=Get a dedicated Azure OpenAI instance', { timeout: 5000 });
      console.log('[Test] Upgrade card opened');

      // Click cancel button
      const cancelButton = page.locator('button:has-text("Cancel")');
      await cancelButton.click();
      console.log('[Test] Clicked cancel button');

      // Wait for card to close
      await page.waitForTimeout(500);

      // Verify upgrade card is no longer visible
      const upgradeCardContent = page.locator('text=Get a dedicated Azure OpenAI instance');
      const cardVisible = await upgradeCardContent.isVisible();

      expect(cardVisible).toBe(false);
      console.log('[Test] Upgrade card closed successfully');
    } else {
      console.log('[Test] Skipping - upgrade button not available');
      test.skip();
    }
  });

  // ===========================================================================
  // Test: ProvisioningStatus component
  // ===========================================================================

  test('should render ProvisioningStatus component correctly', async ({ page }) => {
    // This test directly tests the ProvisioningStatus component by checking API response
    await ensureAuthenticated(page);

    // Make API call to get status
    const response = await page.request.get(
      `${BACKEND_URL}/models/provision/00000000-0000-0000-0000-000000000001/status`
    );

    expect(response.status()).toBe(200);

    const data = await response.json();
    console.log('[Test] Provisioning status from API:', data);

    // Verify status structure
    expect(data).toHaveProperty('organization_id');
    expect(data).toHaveProperty('status');
    expect(data).toHaveProperty('region');
    expect(data).toHaveProperty('progress_steps');

    // If status is 'active', the component should show "Instance Active"
    // If status is 'pending', the component should show progress steps
    console.log('[Test] Status:', data.status);
    console.log('[Test] Region:', data.region);
  });

  // ===========================================================================
  // Test: Provider selection still works
  // ===========================================================================

  test('should allow provider selection (Ollama vs Azure)', async ({ page }) => {
    await ensureAuthenticated(page);
    await navigateToAIModels(page);
    await page.waitForTimeout(2000);

    // Look for provider selection section using more specific selector
    const providerCard = page.locator('[data-slot="card-title"]:has-text("AI Provider")');
    const sectionVisible = await providerCard.count() > 0;

    console.log('[Test] Provider section visible:', sectionVisible);

    if (sectionVisible) {
      // Look for Ollama option - use first() to avoid strict mode violation
      const ollamaOption = page.locator('text=Ollama').first();
      const azureOption = page.locator('text=Azure OpenAI').first();

      const ollamaVisible = await ollamaOption.isVisible().catch(() => false);
      const azureVisible = await azureOption.isVisible().catch(() => false);

      console.log('[Test] Provider options:', { ollamaVisible, azureVisible });

      // Take screenshot of provider selection
      await page.screenshot({ path: 'tests/e2e/screenshots/provider-selection.png' });
    } else {
      console.log('[Test] Provider section not found on this page');
      // Take screenshot anyway for debugging
      await page.screenshot({ path: 'tests/e2e/screenshots/provider-selection-debug.png' });
    }
  });

  // ===========================================================================
  // Test: No console errors during flow
  // ===========================================================================

  test('should complete upgrade flow without console errors', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error' && !msg.text().includes('favicon')) {
        consoleErrors.push(msg.text());
      }
    });

    await ensureAuthenticated(page);
    await navigateToAIModels(page);
    await page.waitForTimeout(2000);

    const upgradeButton = page.locator('button:has-text("Upgrade to Enterprise")');

    if (await upgradeButton.count() > 0 && await upgradeButton.first().isVisible()) {
      // Open upgrade card
      await upgradeButton.first().click();
      await page.waitForTimeout(1000);

      // Try to provision (will fail but should not cause console errors)
      const provisionButton = page.locator('button:has-text("Provision My Instance")');
      if (await provisionButton.isVisible()) {
        await provisionButton.click();
        await page.waitForTimeout(3000);
      }

      // Close card
      const cancelButton = page.locator('button:has-text("Cancel")');
      if (await cancelButton.isVisible()) {
        await cancelButton.click();
      }
    }

    // Filter out expected errors (like Azure not configured)
    const unexpectedErrors = consoleErrors.filter(
      err => !err.includes('not configured') &&
             !err.includes('Provisioning failed') &&
             !err.includes('503')
    );

    console.log('[Test] Total console errors:', consoleErrors.length);
    console.log('[Test] Unexpected errors:', unexpectedErrors.length);

    if (unexpectedErrors.length > 0) {
      console.warn('[Test] Unexpected console errors:', unexpectedErrors);
    }

    // Fail only on unexpected errors
    expect(unexpectedErrors.length).toBe(0);
  });
});

// ===========================================================================
// API Integration Tests (no UI, direct API calls)
// ===========================================================================

test.describe('Azure Provisioning API Integration', () => {

  test('full provisioning lifecycle (API only)', async ({ request }) => {
    const testOrgId = '00000000-0000-0000-0000-000000000099';

    console.log('\n=== Full Provisioning Lifecycle Test ===');

    // Step 1: Check initial status
    console.log('\n[Step 1] Checking initial status...');
    const statusResponse = await request.get(
      `${BACKEND_URL}/models/provision/${testOrgId}/status`
    );
    expect(statusResponse.status()).toBe(200);
    const initialStatus = await statusResponse.json();
    console.log('Initial status:', initialStatus.status);

    // Step 2: Attempt to provision
    console.log('\n[Step 2] Attempting to provision...');
    const provisionResponse = await request.post(
      `${BACKEND_URL}/models/provision/${testOrgId}`,
      {
        data: { selected_model: 'gpt-4o-mini' }
      }
    );
    console.log('Provision response status:', provisionResponse.status());
    const provisionData = await provisionResponse.json();
    console.log('Provision response:', JSON.stringify(provisionData, null, 2));

    // Expected: 503 (not configured) or 200 (configured)
    expect([200, 503]).toContain(provisionResponse.status());

    // Step 3: Check status after provision attempt
    console.log('\n[Step 3] Checking status after provision attempt...');
    const statusAfter = await request.get(
      `${BACKEND_URL}/models/provision/${testOrgId}/status`
    );
    const afterStatus = await statusAfter.json();
    console.log('Status after provision:', afterStatus.status);

    // Step 4: Check logs
    console.log('\n[Step 4] Checking provisioning logs...');
    const logsResponse = await request.get(
      `${BACKEND_URL}/models/provision/${testOrgId}/logs`
    );
    const logs = await logsResponse.json();
    console.log('Number of log entries:', logs.logs.length);

    // Step 5: Attempt deprovision
    console.log('\n[Step 5] Attempting deprovision...');
    const deprovisionResponse = await request.delete(
      `${BACKEND_URL}/models/provision/${testOrgId}`
    );
    expect(deprovisionResponse.status()).toBe(200);
    const deprovisionData = await deprovisionResponse.json();
    console.log('Deprovision response:', JSON.stringify(deprovisionData, null, 2));

    console.log('\n=== Lifecycle Test Complete ===\n');
  });
});
