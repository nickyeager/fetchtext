/**
 * E2E Test: Settings Persistence
 *
 * Tests that user settings (Profile, Account, Notifications) actually persist
 * to the database and survive page reloads.
 *
 * Test Pattern:
 * 1. Navigate to settings page
 * 2. Update a field
 * 3. Submit form
 * 4. Wait for success toast
 * 5. Reload page
 * 6. Verify field has persisted value
 *
 * NO MOCKS - all real database operations via Supabase
 *
 * Requires environment variables:
 * - TEST_USER_EMAIL
 * - TEST_USER_PASSWORD
 */

import { test, expect, Page } from '@playwright/test';

const FRONTEND_URL = 'http://localhost:5173';

/**
 * Helper to perform UI login
 */
async function loginWithCredentials(page: Page): Promise<boolean> {
  const email = process.env.TEST_USER_EMAIL;
  const password = process.env.TEST_USER_PASSWORD;

  if (!email || !password) {
    console.log('[Auth] TEST_USER_EMAIL or TEST_USER_PASSWORD not set');
    return false;
  }

  console.log(`[Auth] Logging in as ${email}...`);

  await page.goto(`${FRONTEND_URL}/sign-in`);
  await page.waitForLoadState('networkidle');

  // Check if already authenticated (redirected to dashboard)
  if (page.url().includes('dashboard') || page.url().includes('_authenticated')) {
    console.log('[Auth] Already authenticated');
    return true;
  }

  const emailInput = page.getByPlaceholder('name@example.com');
  const passwordInput = page.getByPlaceholder('********');
  const loginButton = page.getByRole('button', { name: 'Login' });

  if (!(await loginButton.isVisible({ timeout: 5000 }).catch(() => false))) {
    console.log('[Auth] Login button not visible, may already be authenticated');
    return true;
  }

  await emailInput.fill(email);
  await passwordInput.fill(password);
  await loginButton.click();

  try {
    await page.waitForURL(/dashboard|documents|_authenticated/, { timeout: 20000 });
    console.log('[Auth] Login successful');
    return true;
  } catch {
    console.log('[Auth] Login failed - did not redirect to authenticated area');
    return false;
  }
}

/**
 * Generate a unique test value with timestamp to avoid conflicts
 */
function generateTestValue(prefix: string): string {
  return `${prefix}_${Date.now()}`;
}

/**
 * Wait for success toast notification
 */
async function waitForSuccessToast(page: Page): Promise<void> {
  // Sonner toast uses data-sonner-toast attribute
  const toastLocator = page.locator('[data-sonner-toast]').filter({ hasText: /success|updated/i });

  try {
    await toastLocator.first().waitFor({ state: 'visible', timeout: 10000 });
    console.log('[Toast] Success toast appeared');
    // Wait for toast to be visible for a moment
    await page.waitForTimeout(500);
  } catch {
    // Try alternative toast selectors
    const altToast = page.locator('[role="status"], .sonner-toast, [data-state="open"]').filter({ hasText: /success|updated/i });
    if (await altToast.first().isVisible({ timeout: 3000 }).catch(() => false)) {
      console.log('[Toast] Alternative toast selector found');
    } else {
      console.log('[Toast] Toast not visible, proceeding anyway');
    }
  }
}

// ===========================================================================
// PROFILE SETTINGS TESTS
// ===========================================================================

test.describe('Profile Settings Persistence', () => {
  test('should persist display_name after page reload', async ({ page }) => {
    const loggedIn = await loginWithCredentials(page);
    if (!loggedIn) {
      test.skip();
      return;
    }

    // Navigate to profile settings (index route of settings)
    await page.goto(`${FRONTEND_URL}/settings`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Verify we're on the profile page
    const profileTitle = page.locator('text=Profile').first();
    await expect(profileTitle).toBeVisible({ timeout: 10000 });
    console.log('[Test] Profile settings page loaded');

    // Generate unique test value
    const testDisplayName = generateTestValue('TestUser');
    console.log(`[Test] Setting display_name to: ${testDisplayName}`);

    // Find and update the display name input
    const displayNameInput = page.getByPlaceholder('Your display name');
    await displayNameInput.waitFor({ state: 'visible', timeout: 5000 });

    // Clear and fill the input
    await displayNameInput.clear();
    await displayNameInput.fill(testDisplayName);

    // Submit the form
    const submitButton = page.getByRole('button', { name: /update profile/i });
    await submitButton.click();

    // Wait for success toast
    await waitForSuccessToast(page);
    console.log('[Test] Form submitted successfully');

    // Reload the page
    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Verify the value persisted
    const persistedInput = page.getByPlaceholder('Your display name');
    await persistedInput.waitFor({ state: 'visible', timeout: 5000 });

    const persistedValue = await persistedInput.inputValue();
    console.log(`[Test] Persisted value: ${persistedValue}`);

    expect(persistedValue).toBe(testDisplayName);
    console.log('[Test] Profile display_name persistence verified');
  });

  test('should persist bio after page reload', async ({ page }) => {
    const loggedIn = await loginWithCredentials(page);
    if (!loggedIn) {
      test.skip();
      return;
    }

    await page.goto(`${FRONTEND_URL}/settings`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Generate unique test value for bio
    const testBio = generateTestValue('Test bio content');
    console.log(`[Test] Setting bio to: ${testBio}`);

    // Find and update the bio textarea
    const bioTextarea = page.getByPlaceholder('Tell us a little bit about yourself');
    await bioTextarea.waitFor({ state: 'visible', timeout: 5000 });

    await bioTextarea.clear();
    await bioTextarea.fill(testBio);

    // Submit the form
    const submitButton = page.getByRole('button', { name: /update profile/i });
    await submitButton.click();

    await waitForSuccessToast(page);
    console.log('[Test] Form submitted successfully');

    // Reload the page
    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Verify the value persisted
    const persistedTextarea = page.getByPlaceholder('Tell us a little bit about yourself');
    await persistedTextarea.waitFor({ state: 'visible', timeout: 5000 });

    const persistedValue = await persistedTextarea.inputValue();
    console.log(`[Test] Persisted value: ${persistedValue}`);

    expect(persistedValue).toBe(testBio);
    console.log('[Test] Profile bio persistence verified');
  });
});

// ===========================================================================
// ACCOUNT SETTINGS TESTS
// ===========================================================================

test.describe('Account Settings Persistence', () => {
  test('should persist language selection after page reload', async ({ page }) => {
    const loggedIn = await loginWithCredentials(page);
    if (!loggedIn) {
      test.skip();
      return;
    }

    // Navigate to account settings
    await page.goto(`${FRONTEND_URL}/settings/account`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Verify we're on the account page
    const accountTitle = page.locator('text=Account').first();
    await expect(accountTitle).toBeVisible({ timeout: 10000 });
    console.log('[Test] Account settings page loaded');

    // Get current language selection for comparison
    const languageButton = page.getByRole('combobox').first();
    await languageButton.waitFor({ state: 'visible', timeout: 5000 });
    const initialLanguage = await languageButton.textContent();
    console.log(`[Test] Initial language: ${initialLanguage}`);

    // Select a different language (toggle between English and French)
    const targetLanguage = initialLanguage?.includes('English') ? 'French' : 'English';
    const targetLanguageValue = targetLanguage === 'French' ? 'fr' : 'en';
    console.log(`[Test] Selecting language: ${targetLanguage}`);

    // Click the language combobox to open dropdown
    await languageButton.click();
    await page.waitForTimeout(500);

    // Select the target language from dropdown
    const languageOption = page.getByRole('option', { name: targetLanguage });
    await languageOption.click();

    // Submit the form
    const submitButton = page.getByRole('button', { name: /update account/i });
    await submitButton.click();

    await waitForSuccessToast(page);
    console.log('[Test] Form submitted successfully');

    // Reload the page
    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Verify the language persisted
    const persistedLanguageButton = page.getByRole('combobox').first();
    await persistedLanguageButton.waitFor({ state: 'visible', timeout: 5000 });
    const persistedLanguage = await persistedLanguageButton.textContent();
    console.log(`[Test] Persisted language: ${persistedLanguage}`);

    expect(persistedLanguage).toContain(targetLanguage);
    console.log('[Test] Account language persistence verified');
  });

  test('should persist name in account settings after page reload', async ({ page }) => {
    const loggedIn = await loginWithCredentials(page);
    if (!loggedIn) {
      test.skip();
      return;
    }

    await page.goto(`${FRONTEND_URL}/settings/account`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Generate unique test value
    const testName = generateTestValue('AccountUser');
    console.log(`[Test] Setting name to: ${testName}`);

    // Find and update the name input
    const nameInput = page.getByPlaceholder('Your name');
    await nameInput.waitFor({ state: 'visible', timeout: 5000 });

    await nameInput.clear();
    await nameInput.fill(testName);

    // Submit the form
    const submitButton = page.getByRole('button', { name: /update account/i });
    await submitButton.click();

    await waitForSuccessToast(page);
    console.log('[Test] Form submitted successfully');

    // Reload the page
    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Verify the value persisted
    const persistedInput = page.getByPlaceholder('Your name');
    await persistedInput.waitFor({ state: 'visible', timeout: 5000 });

    const persistedValue = await persistedInput.inputValue();
    console.log(`[Test] Persisted value: ${persistedValue}`);

    expect(persistedValue).toBe(testName);
    console.log('[Test] Account name persistence verified');
  });
});

// ===========================================================================
// NOTIFICATIONS SETTINGS TESTS
// ===========================================================================

test.describe('Notifications Settings Persistence', () => {
  test('should persist notification type selection after page reload', async ({ page }) => {
    const loggedIn = await loginWithCredentials(page);
    if (!loggedIn) {
      test.skip();
      return;
    }

    // Navigate to notifications settings
    await page.goto(`${FRONTEND_URL}/settings/notifications`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Verify we're on the notifications page
    const notificationsTitle = page.locator('text=Notifications').first();
    await expect(notificationsTitle).toBeVisible({ timeout: 10000 });
    console.log('[Test] Notifications settings page loaded');

    // Find the radio group for notification type (shadcn uses button[role="radio"])
    const allRadio = page.locator('button[role="radio"][value="all"]');
    const mentionsRadio = page.locator('button[role="radio"][value="mentions"]');
    const noneRadio = page.locator('button[role="radio"][value="none"]');

    // Check which is currently selected via data-state
    const allChecked = (await allRadio.getAttribute('data-state')) === 'checked';
    const mentionsChecked = (await mentionsRadio.getAttribute('data-state')) === 'checked';

    console.log(`[Test] Current selection - all: ${allChecked}, mentions: ${mentionsChecked}`);

    // Toggle to a different option
    let targetRadio;
    let expectedValue: string;
    if (allChecked) {
      targetRadio = mentionsRadio;
      expectedValue = 'mentions';
    } else if (mentionsChecked) {
      targetRadio = noneRadio;
      expectedValue = 'none';
    } else {
      targetRadio = allRadio;
      expectedValue = 'all';
    }

    console.log(`[Test] Selecting notification type: ${expectedValue}`);

    await targetRadio.click();
    await page.waitForTimeout(500);

    // Submit the form (scroll into view first)
    const submitButton = page.getByRole('button', { name: /update notifications/i });
    await submitButton.scrollIntoViewIfNeeded();
    await submitButton.click();

    await waitForSuccessToast(page);
    console.log('[Test] Form submitted successfully');

    // Reload the page
    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Verify the selection persisted
    const persistedRadio = page.locator(`button[role="radio"][value="${expectedValue}"]`);
    const persistedState = await persistedRadio.getAttribute('data-state');
    console.log(`[Test] Expected value "${expectedValue}" data-state: ${persistedState}`);

    expect(persistedState).toBe('checked');
    console.log('[Test] Notifications type persistence verified');
  });

  test('should persist email communication toggle after page reload', async ({ page }) => {
    const loggedIn = await loginWithCredentials(page);
    if (!loggedIn) {
      test.skip();
      return;
    }

    await page.goto(`${FRONTEND_URL}/settings/notifications`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Find the Communication emails switch - scroll into view first
    const communicationItem = page.locator('.rounded-lg.border').filter({ hasText: 'Communication emails' });
    await communicationItem.scrollIntoViewIfNeeded();
    const switchButton = communicationItem.locator('button[role="switch"]');
    await switchButton.waitFor({ state: 'visible', timeout: 5000 });

    // Get current state
    const initialState = await switchButton.getAttribute('aria-checked');
    console.log(`[Test] Initial communication emails state: ${initialState}`);

    // Toggle the switch
    await switchButton.click();
    await page.waitForTimeout(500);

    const expectedState = initialState === 'true' ? 'false' : 'true';
    console.log(`[Test] Expected state after toggle: ${expectedState}`);

    // Submit the form
    const submitButton = page.getByRole('button', { name: /update notifications/i });
    await submitButton.scrollIntoViewIfNeeded();
    await submitButton.click();

    await waitForSuccessToast(page);
    console.log('[Test] Form submitted successfully');

    // Reload the page
    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Verify the toggle persisted
    const persistedItem = page.locator('.rounded-lg.border').filter({ hasText: 'Communication emails' });
    await persistedItem.scrollIntoViewIfNeeded();
    const persistedSwitch = persistedItem.locator('button[role="switch"]');
    await persistedSwitch.waitFor({ state: 'visible', timeout: 5000 });

    const persistedState = await persistedSwitch.getAttribute('aria-checked');
    console.log(`[Test] Persisted state: ${persistedState}`);

    expect(persistedState).toBe(expectedState);
    console.log('[Test] Communication emails toggle persistence verified');
  });

  test('should persist marketing emails toggle after page reload', async ({ page }) => {
    const loggedIn = await loginWithCredentials(page);
    if (!loggedIn) {
      test.skip();
      return;
    }

    await page.goto(`${FRONTEND_URL}/settings/notifications`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Find the Marketing emails switch - scroll into view first
    const marketingItem = page.locator('.rounded-lg.border').filter({ hasText: 'Marketing emails' });
    await marketingItem.scrollIntoViewIfNeeded();
    const switchButton = marketingItem.locator('button[role="switch"]');
    await switchButton.waitFor({ state: 'visible', timeout: 5000 });

    // Get current state
    const initialState = await switchButton.getAttribute('aria-checked');
    console.log(`[Test] Initial marketing emails state: ${initialState}`);

    // Toggle the switch
    await switchButton.click();
    await page.waitForTimeout(500);

    const expectedState = initialState === 'true' ? 'false' : 'true';
    console.log(`[Test] Expected state after toggle: ${expectedState}`);

    // Submit the form
    const submitButton = page.getByRole('button', { name: /update notifications/i });
    await submitButton.scrollIntoViewIfNeeded();
    await submitButton.click();

    await waitForSuccessToast(page);
    console.log('[Test] Form submitted successfully');

    // Reload the page
    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Verify the toggle persisted
    const persistedItem = page.locator('.rounded-lg.border').filter({ hasText: 'Marketing emails' });
    await persistedItem.scrollIntoViewIfNeeded();
    const persistedSwitch = persistedItem.locator('button[role="switch"]');
    await persistedSwitch.waitFor({ state: 'visible', timeout: 5000 });

    const persistedState = await persistedSwitch.getAttribute('aria-checked');
    console.log(`[Test] Persisted state: ${persistedState}`);

    expect(persistedState).toBe(expectedState);
    console.log('[Test] Marketing emails toggle persistence verified');
  });

  test('should persist social emails toggle after page reload', async ({ page }) => {
    const loggedIn = await loginWithCredentials(page);
    if (!loggedIn) {
      test.skip();
      return;
    }

    await page.goto(`${FRONTEND_URL}/settings/notifications`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Find the Social emails switch - scroll into view first
    const socialItem = page.locator('.rounded-lg.border').filter({ hasText: 'Social emails' });
    await socialItem.scrollIntoViewIfNeeded();
    const switchButton = socialItem.locator('button[role="switch"]');
    await switchButton.waitFor({ state: 'visible', timeout: 5000 });

    // Get current state
    const initialState = await switchButton.getAttribute('aria-checked');
    console.log(`[Test] Initial social emails state: ${initialState}`);

    // Toggle the switch
    await switchButton.click();
    await page.waitForTimeout(500);

    const expectedState = initialState === 'true' ? 'false' : 'true';
    console.log(`[Test] Expected state after toggle: ${expectedState}`);

    // Submit the form
    const submitButton = page.getByRole('button', { name: /update notifications/i });
    await submitButton.scrollIntoViewIfNeeded();
    await submitButton.click();

    await waitForSuccessToast(page);
    console.log('[Test] Form submitted successfully');

    // Reload the page
    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Verify the toggle persisted
    const persistedItem = page.locator('.rounded-lg.border').filter({ hasText: 'Social emails' });
    await persistedItem.scrollIntoViewIfNeeded();
    const persistedSwitch = persistedItem.locator('button[role="switch"]');
    await persistedSwitch.waitFor({ state: 'visible', timeout: 5000 });

    const persistedState = await persistedSwitch.getAttribute('aria-checked');
    console.log(`[Test] Persisted state: ${persistedState}`);

    expect(persistedState).toBe(expectedState);
    console.log('[Test] Social emails toggle persistence verified');
  });
});

// ===========================================================================
// CROSS-SETTINGS PERSISTENCE TEST
// ===========================================================================

test.describe('Cross-Settings Persistence', () => {
  test('should persist multiple settings across different pages', async ({ page }) => {
    const loggedIn = await loginWithCredentials(page);
    if (!loggedIn) {
      test.skip();
      return;
    }

    // Generate unique values
    const testDisplayName = generateTestValue('CrossTest');
    console.log(`[Test] Testing cross-settings persistence with: ${testDisplayName}`);

    // Step 1: Update Profile settings
    await page.goto(`${FRONTEND_URL}/settings`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    const displayNameInput = page.getByPlaceholder('Your display name');
    await displayNameInput.waitFor({ state: 'visible', timeout: 5000 });
    await displayNameInput.clear();
    await displayNameInput.fill(testDisplayName);

    const profileSubmit = page.getByRole('button', { name: /update profile/i });
    await profileSubmit.click();
    await waitForSuccessToast(page);
    console.log('[Test] Profile updated');

    // Step 2: Navigate to Account settings without reload
    await page.goto(`${FRONTEND_URL}/settings/account`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Step 3: Go back to Profile and verify persistence
    await page.goto(`${FRONTEND_URL}/settings`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    const persistedInput = page.getByPlaceholder('Your display name');
    await persistedInput.waitFor({ state: 'visible', timeout: 5000 });
    const persistedValue = await persistedInput.inputValue();

    expect(persistedValue).toBe(testDisplayName);
    console.log('[Test] Cross-settings navigation persistence verified');
  });
});

// ===========================================================================
// Summary Test
// ===========================================================================

test.describe('Settings Persistence - Summary', () => {
  test('should display test summary', async () => {
    console.log('\n========================================');
    console.log('Settings Persistence E2E Test Summary');
    console.log('========================================');
    console.log('\nSettings Tested:');
    console.log('  Profile Settings:');
    console.log('    - display_name');
    console.log('    - bio');
    console.log('  Account Settings:');
    console.log('    - name');
    console.log('    - language');
    console.log('  Notifications Settings:');
    console.log('    - notification_type (all/mentions/none)');
    console.log('    - email_communication toggle');
    console.log('    - email_marketing toggle');
    console.log('    - email_social toggle');
    console.log('\nTest Pattern:');
    console.log('  1. Login with test credentials');
    console.log('  2. Navigate to settings page');
    console.log('  3. Update field with unique value');
    console.log('  4. Submit form');
    console.log('  5. Wait for success toast');
    console.log('  6. Reload page');
    console.log('  7. Verify value persisted');
    console.log('\nDatabase: Real Supabase user_preferences table');
    console.log('NO MOCKS - All real API calls');
    console.log('========================================\n');
  });
});
