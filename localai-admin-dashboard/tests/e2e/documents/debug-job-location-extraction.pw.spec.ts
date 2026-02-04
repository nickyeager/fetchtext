/**
 * DEBUG TEST: Investigate why job_location field doesn't appear in extracted fields list
 *
 * User reported: "I added a 'job_location' template, and then it didn't appear in the list of extracted fields"
 * URL: http://localhost:5173/documents/150?debug=false
 *
 * This test will:
 * 1. Navigate to the exact URL
 * 2. Monitor console for errors
 * 3. Monitor network requests
 * 4. Add {{job_location}} variable
 * 5. Check if it triggers extraction
 * 6. Check if it appears in the fields list
 * 7. Report exactly what's happening
 */

import { test, expect } from '@playwright/test';

const BACKEND_URL = 'http://localhost:8090';
const FRONTEND_URL = 'http://localhost:5173';

test.describe('Debug: job_location field extraction', () => {
  let consoleMessages: Array<{ type: string; text: string }> = [];
  let networkRequests: Array<{ url: string; method: string; status?: number }> = [];

  test.beforeEach(async ({ page }) => {
    // Monitor console
    consoleMessages = [];
    page.on('console', (msg) => {
      consoleMessages.push({
        type: msg.type(),
        text: msg.text(),
      });
    });

    // Monitor network requests
    networkRequests = [];
    page.on('request', (request) => {
      networkRequests.push({
        url: request.url(),
        method: request.method(),
      });
    });

    page.on('response', (response) => {
      const req = networkRequests.find(
        (r) => r.url === response.url() && !('status' in r)
      );
      if (req) {
        req.status = response.status();
      }
    });

    // Verify backend is available
    const backendHealth = await fetch(`${BACKEND_URL}/health`).catch(() => null);
    if (!backendHealth || !backendHealth.ok) {
      throw new Error(`Backend not available at ${BACKEND_URL}`);
    }
  });

  test('should show job_location in extracted fields list after adding variable', async ({
    page,
  }) => {
    console.log('[DEBUG] Step 1: Navigate to document 150');
    await page.goto(`${FRONTEND_URL}/documents/150?debug=false`);
    await page.waitForLoadState('networkidle');

    // Take initial screenshot
    await page.screenshot({ path: '/tmp/debug-1-initial.png' });

    console.log('[DEBUG] Step 2: Wait for page to fully load');
    await page.waitForTimeout(2000);

    // Log all console messages so far
    console.log('[DEBUG] Console messages on load:');
    consoleMessages
      .filter((m) => m.type === 'log')
      .forEach((m) => console.log(`  ${m.text}`));

    // Check for any console errors
    const consoleErrors = consoleMessages.filter((m) => m.type === 'error');
    if (consoleErrors.length > 0) {
      console.log('[DEBUG] ⚠️ Console errors detected:');
      consoleErrors.forEach((e) => console.log(`  ${e.text}`));
    }

    console.log('[DEBUG] Step 3: Look for template editor');
    const editor = page.locator('[contenteditable="true"]').first();
    const editorVisible = await editor.isVisible({ timeout: 5000 }).catch(() => false);

    if (!editorVisible) {
      console.log('[DEBUG] ❌ Template editor not visible - cannot continue test');
      throw new Error('Template editor not found');
    }

    console.log('[DEBUG] Step 4: Click editor to focus');
    await editor.click();

    console.log('[DEBUG] Step 5: Type {{job_location}} variable');
    await page.keyboard.type('{{job_location}}');

    // Take screenshot after typing
    await page.screenshot({ path: '/tmp/debug-2-after-typing.png' });

    console.log('[DEBUG] Step 6: Wait for extraction to start (5 seconds)');
    await page.waitForTimeout(5000);

    // Check network requests for smart-extract call
    const extractionRequest = networkRequests.find(
      (r) =>
        r.url.includes('/api/enhanced-documents/smart-extract') ||
        r.url.includes('/smart-extract')
    );

    if (extractionRequest) {
      console.log('[DEBUG] ✅ Extraction API called:', extractionRequest);
    } else {
      console.log('[DEBUG] ❌ Extraction API NOT called');
      console.log('[DEBUG] All network requests:');
      networkRequests.forEach((r) => console.log(`  ${r.method} ${r.url} - ${r.status}`));
    }

    // Check console for extraction logs
    const extractionLogs = consoleMessages.filter(
      (m) => m.text.includes('job_location') || m.text.includes('Extracting')
    );
    if (extractionLogs.length > 0) {
      console.log('[DEBUG] Extraction-related console logs:');
      extractionLogs.forEach((l) => console.log(`  [${l.type}] ${l.text}`));
    } else {
      console.log('[DEBUG] ⚠️ No extraction logs found in console');
    }

    console.log('[DEBUG] Step 7: Look for extracted fields list');

    // Try to find the extracted fields panel/list
    // This might be in an ExtractedFieldsEditor component or similar
    const possibleSelectors = [
      'text=Extracted Fields',
      'text=Fields',
      'text=Variables',
      '[data-testid="extracted-fields"]',
      '[aria-label*="field"]',
    ];

    let fieldListFound = false;
    for (const selector of possibleSelectors) {
      const element = page.locator(selector).first();
      const visible = await element.isVisible({ timeout: 1000 }).catch(() => false);
      if (visible) {
        console.log(`[DEBUG] Found field list with selector: ${selector}`);
        fieldListFound = true;

        // Try to find job_location in this section
        const jobLocationField = page.locator('text=/job.*location/i');
        const jobLocationVisible = await jobLocationField
          .isVisible({ timeout: 1000 })
          .catch(() => false);

        if (jobLocationVisible) {
          console.log('[DEBUG] ✅ job_location field FOUND in list!');
        } else {
          console.log('[DEBUG] ❌ job_location field NOT FOUND in list');
        }

        break;
      }
    }

    if (!fieldListFound) {
      console.log('[DEBUG] ⚠️ Could not locate extracted fields list');
    }

    // Take final screenshot
    await page.screenshot({ path: '/tmp/debug-3-final.png' });

    console.log('[DEBUG] Step 8: Check normalizedFields log');
    const normalizedFieldsLog = consoleMessages.find((m) =>
      m.text.includes('normalizedFields')
    );
    if (normalizedFieldsLog) {
      console.log('[DEBUG] normalizedFields log found:');
      console.log(`  ${normalizedFieldsLog.text}`);
    } else {
      console.log('[DEBUG] ⚠️ No normalizedFields log found');
    }

    console.log('[DEBUG] Step 9: Summary of findings');
    console.log('═══════════════════════════════════════════════════════');
    console.log(`Extraction API Called: ${!!extractionRequest}`);
    console.log(`Extraction Logs Found: ${extractionLogs.length > 0}`);
    console.log(`Field List Found: ${fieldListFound}`);
    console.log(`Console Errors: ${consoleErrors.length}`);
    console.log('═══════════════════════════════════════════════════════');

    // Final assertion - this test is for debugging, so we just report findings
    // We don't fail the test, we just document what happened
    console.log('[DEBUG] Test complete - check logs above for diagnostic info');
  });
});
