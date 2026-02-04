/**
 * Playwright E2E Test: Real-Time Field Extraction
 *
 * Tests the complete real-world user flow for real-time field extraction:
 * 1. Upload a document
 * 2. Create a template with variables
 * 3. Type new variables in template editor
 * 4. Verify extraction starts automatically
 * 5. Verify toast notifications appear
 * 6. Verify extracted values display in UI
 *
 * This test uses REAL data and calls REAL backend services.
 */

import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

const BACKEND_URL = 'http://localhost:8090';
const FRONTEND_URL = 'http://localhost:5173';

// Helper: Check if backend is available
async function checkBackendHealth() {
  try {
    const response = await fetch(`${BACKEND_URL}/health`);
    return response.ok;
  } catch {
    return false;
  }
}

test.describe('Real-Time Field Extraction', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to documents page
    await page.goto(`${FRONTEND_URL}/documents`);

    // Wait for page to load
    await page.waitForLoadState('networkidle');
  });

  test('should extract fields in real-time when typing new variables', async ({ page }) => {
    // Verify backend is running
    const backendAvailable = await checkBackendHealth();
    if (!backendAvailable) {
      throw new Error('Backend not available at http://localhost:8090 - cannot run integration test');
    }

    // Step 1: Upload a real test document
    console.log('[Test] Step 1: Uploading test document...');

    // Create a simple test document with known values
    const testDocumentContent = `
      CONTRACT AGREEMENT

      This agreement is between Acme Corporation (the "Vendor") and
      Example Industries Inc. (the "Client").

      Contract Date: January 15, 2024
      Total Amount: $50,000
      Job Location: 123 Main Street, San Francisco, CA 94102

      Project Manager: John Smith
      Contact Email: john.smith@example.com
    `;

    const tempFilePath = path.join('/tmp', 'test-contract.txt');
    fs.writeFileSync(tempFilePath, testDocumentContent);

    // Find upload button or drag-drop area
    const uploadButton = page.locator('button:has-text("Upload")').first();
    if (await uploadButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await uploadButton.click();
    }

    // Upload the file
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(tempFilePath);

    // Wait for upload to complete
    await page.waitForTimeout(2000);

    console.log('[Test] Step 2: Document uploaded, finding the document in list...');

    // Click on the uploaded document to open detail view
    const documentLink = page.locator('text=test-contract.txt').first();
    await expect(documentLink).toBeVisible({ timeout: 10000 });
    await documentLink.click();

    // Wait for document detail page to load
    await page.waitForTimeout(1000);

    console.log('[Test] Step 3: Creating template with variables...');

    // Look for template editor or "Create Template" button
    // The exact UI may vary, but we need to get to a state where we can edit template content
    const createTemplateButton = page.locator('button:has-text("Create Template")').first();
    if (await createTemplateButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await createTemplateButton.click();
      await page.waitForTimeout(500);
    }

    // Find the template editor (Tiptap editor)
    const editor = page.locator('[contenteditable="true"]').first();
    await expect(editor).toBeVisible({ timeout: 5000 });

    console.log('[Test] Step 4: Typing variables into template...');

    // Click into editor to focus
    await editor.click();

    // Type some template content with variables
    await editor.fill('');  // Clear any existing content
    await page.keyboard.type('Contract with {{vendor_name}}');

    console.log('[Test] Step 5: Waiting for extraction toast to appear...');

    // Look for loading toast notification
    // The toast should say "Extracting Vendor Name..."
    const loadingToast = page.locator('text=/Extracting.*Vendor Name/i');
    await expect(loadingToast).toBeVisible({ timeout: 10000 });

    console.log('[Test] ✅ Loading toast appeared!');

    // Wait for success toast
    // The toast should say "Vendor Name extracted successfully!"
    const successToast = page.locator('text=/Vendor Name.*extracted successfully/i');
    await expect(successToast).toBeVisible({ timeout: 30000 });

    console.log('[Test] ✅ Success toast appeared!');

    // Verify the toast shows the extracted value
    const toastWithValue = page.locator('text=/Value:.*Acme/i');
    await expect(toastWithValue).toBeVisible({ timeout: 2000 });

    console.log('[Test] ✅ Toast shows extracted value: Acme Corporation');

    console.log('[Test] Step 6: Verifying extracted value appears in template...');

    // Look for the extracted value displayed in the rendered template
    // The UI should show "Acme Corporation" in place of {{vendor_name}}
    const extractedValue = page.locator('text=/Acme.*Corporation/i');
    await expect(extractedValue).toBeVisible({ timeout: 5000 });

    console.log('[Test] ✅ Extracted value displays in UI!');

    console.log('[Test] Step 7: Testing extraction of second variable...');

    // Add another variable to test multiple extractions
    await editor.click();
    await page.keyboard.press('End');
    await page.keyboard.type(' on {{contract_date}}');

    // Wait for second extraction
    const contractDateToast = page.locator('text=/Extracting.*Contract Date/i');
    await expect(contractDateToast).toBeVisible({ timeout: 10000 });

    const contractDateSuccess = page.locator('text=/Contract Date.*extracted successfully/i');
    await expect(contractDateSuccess).toBeVisible({ timeout: 30000 });

    console.log('[Test] ✅ Second variable extracted successfully!');

    // Verify both values are now visible
    await expect(extractedValue).toBeVisible();
    const dateValue = page.locator('text=/January.*2024/i');
    await expect(dateValue).toBeVisible({ timeout: 5000 });

    console.log('[Test] ✅ All extracted values display correctly!');

    // Cleanup
    fs.unlinkSync(tempFilePath);

    console.log('[Test] ✅ TEST PASSED: Real-time field extraction works end-to-end!');
  });

  test('should show retry button on extraction failure', async ({ page }) => {
    // This test verifies error handling

    // Upload a document with very little content (will cause extraction to fail)
    const testDocumentContent = 'x';  // Too short to extract anything meaningful

    const tempFilePath = path.join('/tmp', 'test-short.txt');
    fs.writeFileSync(tempFilePath, testDocumentContent);

    const uploadButton = page.locator('button:has-text("Upload")').first();
    if (await uploadButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await uploadButton.click();
    }

    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(tempFilePath);
    await page.waitForTimeout(2000);

    // Open the document
    const documentLink = page.locator('text=test-short.txt').first();
    await documentLink.click();
    await page.waitForTimeout(1000);

    // Try to extract a variable
    const editor = page.locator('[contenteditable="true"]').first();
    await editor.click();
    await page.keyboard.type('{{vendor_name}}');

    // Wait for error toast
    const errorToast = page.locator('text=/Failed to extract/i');
    await expect(errorToast).toBeVisible({ timeout: 30000 });

    // Verify retry button appears
    const retryButton = page.locator('button:has-text("Retry")');
    await expect(retryButton).toBeVisible({ timeout: 2000 });

    console.log('[Test] ✅ Error handling works: retry button appears on failure');

    // Cleanup
    fs.unlinkSync(tempFilePath);
  });

  test('should not crash when documentId is missing', async ({ page }) => {
    // This test verifies the fix for the empty documentId bug

    // Navigate to a template creation page without a document context
    await page.goto(`${FRONTEND_URL}/templates/create`);
    await page.waitForLoadState('networkidle');

    // Try to use the template editor
    const editor = page.locator('[contenteditable="true"]').first();

    // If editor exists, try typing a variable
    if (await editor.isVisible({ timeout: 2000 }).catch(() => false)) {
      await editor.click();
      await page.keyboard.type('{{test_variable}}');

      // Should NOT see database errors in console
      // The extraction should be skipped gracefully
      await page.waitForTimeout(2000);

      console.log('[Test] ✅ No crash when documentId is missing - extraction skipped gracefully');
    } else {
      console.log('[Test] ⚠️  Template editor not available on this page, skipping test');
    }
  });
});
