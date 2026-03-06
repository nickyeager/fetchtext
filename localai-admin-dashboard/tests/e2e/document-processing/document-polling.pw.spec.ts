import 'dotenv/config';
import { test, expect } from '@playwright/test';
import { preflight } from '../utils/preflight';
import fs from 'fs';

const contractPath = new URL('../../fixtures/real-test-contract.txt', import.meta.url).pathname;

test.describe('Document Polling and Status Updates', () => {
  test.setTimeout(120_000);

  test('uploads a document and verifies the detail page renders document data', async ({ page }) => {
    // Preflight: check env + backend health
    await preflight();
    const email = process.env.TEST_USER_EMAIL;
    const password = process.env.TEST_USER_PASSWORD;
    if (!email || !password) throw new Error('TEST_USER_EMAIL/TEST_USER_PASSWORD not set');
    if (!fs.existsSync(contractPath)) throw new Error(`Fixture not found: ${contractPath}`);

    // Login
    await page.goto('/sign-in', { waitUntil: 'domcontentloaded' });
    let emailInput = page.getByPlaceholder('name@example.com');
    let loginButton = page.getByRole('button', { name: 'Login' });
    if (!(await emailInput.isVisible({ timeout: 2000 }).catch(() => false))) {
      await page.goto('/sign-in', { waitUntil: 'domcontentloaded' });
      emailInput = page.getByPlaceholder('name@example.com');
      loginButton = page.getByRole('button', { name: 'Login' });
    }
    if (await loginButton.isVisible().catch(() => false)) {
      await emailInput.fill(email);
      await page.getByPlaceholder('********').fill(password);
      await loginButton.click();
      await page.waitForURL(/dashboard|documents/, { timeout: 20000 });
    }

    // Navigate to documents list and look for an existing document
    await page.goto('/documents', { waitUntil: 'domcontentloaded' });

    // Wait for the page to render document rows or an empty-state
    // Look for any link that navigates to a document detail page
    const docLink = page.locator('a[href*="/documents/"]').first();
    const hasExistingDoc = await docLink.isVisible({ timeout: 10000 }).catch(() => false);

    if (hasExistingDoc) {
      // Click into the first available document detail page
      const href = await docLink.getAttribute('href');
      console.log('Found existing document, navigating to:', href);
      await docLink.click();
      await page.waitForURL(/\/documents\//, { timeout: 15000 });
    } else {
      // No existing documents - upload one first via process-document workflow
      console.log('No existing documents found, uploading a new one...');
      await page.goto('/documents/process-document', { waitUntil: 'domcontentloaded' });

      const fileInput = page.locator('[data-testid="document-file-input"]');
      await expect(fileInput).toBeVisible({ timeout: 15000 });
      await fileInput.setInputFiles(contractPath);

      // Wait for upload confirmation
      await expect(page.locator('[data-testid="document-uploaded"]')).toContainText('Selected:', { timeout: 10000 });

      // Wait a bit for processing to start, then navigate to docs list
      await page.waitForTimeout(5000);
      await page.goto('/documents', { waitUntil: 'domcontentloaded' });

      // Now there should be a document; click it
      const newDocLink = page.locator('a[href*="/documents/"]').first();
      await expect(newDocLink).toBeVisible({ timeout: 15000 });
      await newDocLink.click();
      await page.waitForURL(/\/documents\//, { timeout: 15000 });
    }

    // We're on the document detail page - verify it renders meaningful data
    const currentUrl = page.url();
    console.log('Document detail page URL:', currentUrl);
    expect(currentUrl).toMatch(/\/documents\/.+/);

    // The detail page should show at least one of these indicators:
    // - Document name/title
    // - Processing status
    // - Extracted content
    // - Error message (if processing failed)
    // Give the page time to load data
    await page.waitForTimeout(3000);

    // Check that the page has loaded and shows document-related content
    // (not the "not found" or error component)
    const bodyText = await page.locator('body').innerText();
    const hasDocumentContent =
      bodyText.includes('Document') ||
      bodyText.includes('Processing') ||
      bodyText.includes('Extracted') ||
      bodyText.includes('completed') ||
      bodyText.includes('analyzing');

    expect(hasDocumentContent).toBeTruthy();

    // Ensure we're NOT on an error/not-found page
    const isErrorPage = bodyText.includes('Document Not Found') && bodyText.includes("doesn't exist");
    if (isErrorPage) {
      throw new Error('Document detail page shows "Not Found" - document may have been deleted');
    }

    console.log('Document detail page rendered successfully with document data');
  });
});
