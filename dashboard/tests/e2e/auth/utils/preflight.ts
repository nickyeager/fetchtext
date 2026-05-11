// Preflight utilities for authentication tests
import { Page } from '@playwright/test';

export async function checkAuthenticationStatus(page: Page) {
  // Check if user is authenticated by looking for auth indicators
  const authIndicators = [
    '[data-testid="user-menu"]',
    '[data-testid="logout-button"]',
    'text="Sign out"',
    'text="Profile"'
  ];

  for (const indicator of authIndicators) {
    if (await page.locator(indicator).isVisible({ timeout: 1000 }).catch(() => false)) {
      return true;
    }
  }
  return false;
}

export async function waitForPageLoad(page: Page, timeout = 10000) {
  await page.waitForLoadState('networkidle', { timeout });
}

export async function ensureAuthenticated(page: Page) {
  const isAuthenticated = await checkAuthenticationStatus(page);
  if (!isAuthenticated) {
    // Navigate to login or handle authentication
    console.log('User not authenticated, may need manual login');
    return false;
  }
  return true;
}

// Default export for compatibility
export const preflight = {
  checkAuthenticationStatus,
  waitForPageLoad,
  ensureAuthenticated
};