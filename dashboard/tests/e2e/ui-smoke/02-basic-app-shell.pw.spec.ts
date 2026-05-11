import { test, expect } from '@playwright/test';
import { gotoAndHydrate } from './utils/appAssertions';

// Verifies that the app root loads and main script hydrates without mocking external data.
test.describe('App Shell', () => {
  test('loads root index and displays title', async ({ page }) => {
    await test.step('navigate & hydrate', async () => {
      await gotoAndHydrate(page, '/');
    });

    await test.step('assert title', async () => {
      await expect(page).toHaveTitle(/FetchText Admin/);
    });

    await test.step('assert root populated', async () => {
      const hasChildren = await page.evaluate(() => {
        const root = document.getElementById('root');
        return !!root && root.childElementCount > 0;
      });
      expect(hasChildren).toBe(true);
    });
  });
});
