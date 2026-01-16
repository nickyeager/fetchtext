import { test } from '@playwright/test';

test('debug: screenshot documents page', async ({ page }) => {
  await page.goto('http://localhost:5173/documents');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000);

  // Log page info
  console.log('Page URL:', page.url());
  console.log('Total buttons:', await page.locator('button').count());

  // List buttons
  const buttons = await page.locator('button').all();
  for (let i = 0; i < Math.min(buttons.length, 15); i++) {
    const text = await buttons[i].textContent();
    console.log('Button ' + (i + 1) + ':', text?.trim().substring(0, 60));
  }

  // Check file inputs
  console.log('File inputs:', await page.locator('input[type="file"]').count());

  // Check for dropzone
  console.log('Dropzones:', await page.locator('[class*="dropzone"], [class*="Dropzone"], [data-testid*="drop"]').count());

  // Check links
  const links = await page.locator('a').all();
  for (let i = 0; i < Math.min(links.length, 10); i++) {
    const href = await links[i].getAttribute('href');
    const text = await links[i].textContent();
    console.log('Link ' + (i + 1) + ':', href, '-', text?.trim().substring(0, 30));
  }

  // Take screenshot
  await page.screenshot({ path: 'test-results/debug-documents.png', fullPage: true });
  console.log('Screenshot saved to test-results/debug-documents.png');
});
