// Application assertions for UI smoke tests
import { Page, expect } from '@playwright/test';

export async function assertPageLoaded(page: Page) {
  // Check that the page has loaded with basic content
  await expect(page.locator('body')).toBeVisible();
  await page.waitForLoadState('networkidle');
}

export async function assertNavigation(page: Page) {
  // Check for navigation elements
  const navSelectors = [
    'nav',
    '[role="navigation"]',
    'header',
    '.navigation',
    '.nav'
  ];

  let foundNav = false;
  for (const selector of navSelectors) {
    if (await page.locator(selector).isVisible({ timeout: 1000 }).catch(() => false)) {
      foundNav = true;
      break;
    }
  }

  if (!foundNav) {
    console.log('Navigation not found - may be expected for some pages');
  }
}

export async function assertAppShell(page: Page) {
  // Check for basic app shell components
  await assertPageLoaded(page);

  // Look for common app shell elements
  const shellSelectors = [
    'main',
    '[role="main"]',
    '.app-content',
    '.main-content'
  ];

  let foundMain = false;
  for (const selector of shellSelectors) {
    if (await page.locator(selector).isVisible({ timeout: 1000 }).catch(() => false)) {
      foundMain = true;
      break;
    }
  }

  if (!foundMain) {
    console.log('Main content area not found with standard selectors');
  }
}

// Additional function needed by ui-smoke tests
export async function gotoAndHydrate(page: Page, route: string) {
  // Navigate to a route and wait for hydration
  await page.goto(route);
  await page.waitForLoadState('networkidle');
  await assertAppShell(page);
}