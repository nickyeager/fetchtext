// Application assertions for document processing tests
import { Page, expect } from '@playwright/test';

export async function assertPageLoaded(page: Page) {
  // Check that the page has loaded with basic content
  await expect(page.locator('body')).toBeVisible();
  await page.waitForLoadState('networkidle');
}

export async function assertNoErrorMessages(page: Page) {
  // Check for common error indicators
  const errorSelectors = [
    'text="Error"',
    'text="Failed"',
    'text="Something went wrong"',
    '[role="alert"]',
    '.error',
    '.alert-error'
  ];

  for (const selector of errorSelectors) {
    const errorElement = page.locator(selector);
    if (await errorElement.isVisible({ timeout: 1000 }).catch(() => false)) {
      const errorText = await errorElement.textContent();
      throw new Error(`Found error message: ${errorText}`);
    }
  }
}

export async function assertElementVisible(page: Page, selector: string, timeout = 5000) {
  await expect(page.locator(selector)).toBeVisible({ timeout });
}

export async function assertElementNotVisible(page: Page, selector: string, timeout = 2000) {
  await expect(page.locator(selector)).not.toBeVisible({ timeout });
}

export async function assertTextContent(page: Page, selector: string, expectedText: string) {
  await expect(page.locator(selector)).toContainText(expectedText);
}

// Additional functions needed by tests
export async function findHydratableRoute(page: Page) {
  // Find a route that can be hydrated
  await page.waitForLoadState('networkidle');
  return '/documents'; // Default route
}

export async function attachDiagnostics(page: Page) {
  // Attach diagnostics for debugging
  console.log('Page URL:', page.url());
  console.log('Page title:', await page.title());
}