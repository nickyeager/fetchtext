import { test, expect } from '@playwright/test';

test.describe('Capture UI State', () => {
  test('capture current application state and find upload interface', async ({ page }) => {
    console.log('🔍 Capturing application state...');

    // Navigate to the application
    await page.goto('http://localhost:5174');
    await page.waitForLoadState('networkidle');

    // Capture basic information
    const url = page.url();
    const title = await page.title();

    console.log('📍 URL:', url);
    console.log('📄 Title:', title);

    // Take screenshot
    await page.screenshot({ path: 'current-ui-state.png', fullPage: true });
    console.log('📸 Screenshot saved as current-ui-state.png');

    // Check for login elements
    const emailCount = await page.locator('input[type="email"]').count();
    const passwordCount = await page.locator('input[type="password"]').count();
    const loginTextCount = await page.locator('text=/sign in|login/i').count();
    const hasLogin = emailCount > 0 || passwordCount > 0 || loginTextCount > 0;
    if (hasLogin) {
      console.log('🔐 Login page detected');

      // Check if we can find test credentials
      const emailInput = page.locator('input[type="email"]').first();
      const passwordInput = page.locator('input[type="password"]').first();
      const submitButton = page.locator('button[type="submit"], button:has-text("Sign in"), button:has-text("Login")').first();

      if (await emailInput.count() > 0 && await passwordInput.count() > 0 && await submitButton.count() > 0) {
        console.log('✅ Found login form elements');

        // You could add test credentials here if available
        // await emailInput.fill('test@example.com');
        // await passwordInput.fill('testpassword');
        // await submitButton.click();
        // await page.waitForNavigation();
      }
    }

    // Try to find any file upload elements even on login page
    console.log('\n🔍 Searching for upload elements...');

    const uploadSelectors = [
      'input[type="file"]',
      '[data-testid*="upload"]',
      '[data-testid*="file"]',
      '[data-testid="drop-zone"]',
      '.drop-zone',
      '.upload-zone',
      'text=/upload|drop.*file|choose.*file/i'
    ];

    let foundAny = false;
    for (const selector of uploadSelectors) {
      const count = await page.locator(selector).count();
      if (count > 0) {
        console.log(`✅ Found: ${selector} (${count} elements)`);
        foundAny = true;

        // If it's a file input, check its accept attribute
        if (selector === 'input[type="file"]') {
          const fileInput = page.locator(selector).first();
          const acceptAttr = await fileInput.getAttribute('accept');
          console.log(`   Accept attribute: ${acceptAttr || 'not set'}`);
        }
      }
    }

    if (!foundAny) {
      console.log('❌ No upload elements found on current page');
    }

    // List all visible text that might indicate where to navigate
    console.log('\n📝 Visible navigation/action text:');
    const navigationTexts = await page.locator('a, button, [role="button"]').allTextContents();
    const uniqueTexts = [...new Set(navigationTexts.filter(text => text.trim().length > 0))];
    uniqueTexts.slice(0, 20).forEach(text => {
      if (text.length < 50) {
        console.log(`   - "${text.trim()}"`);
      }
    });

    // Get page content preview
    console.log('\n📄 Page content preview:');
    const bodyText = await page.locator('body').textContent();
    console.log(bodyText?.substring(0, 500).replace(/\s+/g, ' ').trim());

    // Save page HTML for debugging
    const html = await page.content();
    require('fs').writeFileSync('current-page.html', html);
    console.log('\n💾 Full page HTML saved as current-page.html');
  });
});