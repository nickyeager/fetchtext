import { test, expect } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test.describe('PDF Text Extraction', () => {
  test.beforeEach(async ({ page }) => {
    // First login
    await page.goto('http://localhost:5173/login');

    // Fill in login credentials (using test account)
    await page.fill('input[type="email"]', 'test@example.com');
    await page.fill('input[type="password"]', 'password123');
    await page.click('button[type="submit"], button:has-text("Login")');

    // Wait for login to complete and redirect
    await page.waitForLoadState('networkidle');

    // Navigate to the documents page
    await page.goto('http://localhost:5173/documents');

    // Wait for page to load
    await page.waitForLoadState('networkidle');
  });

  test('should extract actual text from PDF instead of hardcoded message', async ({ page }) => {
    // Upload the Receipt PDF file
    const pdfPath = path.join(__dirname, '../../../test-documents/edge-cases/alu, deck for nick yeager.pdf');

    // Find the file input and upload the PDF
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(pdfPath);

    // Wait for upload to complete
    await page.waitForTimeout(2000);

    // Look for the document in the gallery (it should appear after upload)
    const documentCard = page.locator('[data-testid="document-card"]').first();
    await expect(documentCard).toBeVisible({ timeout: 10000 });

    // Click on the document to view details
    await documentCard.click();

    // Wait for document detail view to load
    await page.waitForLoadState('networkidle');

    // Check that the extracted text is displayed
    const textContent = page.locator('[data-testid="extracted-text"], .document-content, .text-content');
    await expect(textContent).toBeVisible({ timeout: 15000 });

    // Get the actual text content
    const extractedText = await textContent.textContent();

    // Verify it's NOT the hardcoded fallback message
    expect(extractedText).not.toContain('Text extraction completed');
    expect(extractedText).not.toContain('requires backend processing for full text extraction');

    // Verify it contains actual receipt data from the PDF
    expect(extractedText).toContain('TTKRPHII0001'); // Invoice number
    expect(extractedText).toContain('$2,025.00'); // Amount
    expect(extractedText).toContain('Koenig Solutions Limited'); // Company name
    expect(extractedText).toContain('Nicholas Yeager'); // Customer name
    expect(extractedText).toContain('July 23, 2025'); // Date

    console.log('✅ PDF text extraction working - extracted:', extractedText?.substring(0, 200) + '...');
  });

  test('should handle PDF upload and show processing status', async ({ page }) => {
    const pdfPath = path.join(__dirname, '../../../test-documents/edge-cases/alu, deck for nick yeager.pdf');

    // Upload PDF
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(pdfPath);

    // Should show processing status initially
    const processingIndicator = page.locator('[data-testid="processing-status"], .processing, [aria-label*="processing"]');
    await expect(processingIndicator).toBeVisible({ timeout: 5000 });

    // Wait for processing to complete
    await page.waitForTimeout(8000); // PDF processing takes time

    // Processing indicator should disappear or show completion
    await expect(processingIndicator).not.toBeVisible({ timeout: 10000 });

    // Document should be visible in gallery
    const documentCard = page.locator('[data-testid="document-card"]').first();
    await expect(documentCard).toBeVisible();
  });

  test('should extract text from different file types correctly', async ({ page }) => {
    const testFiles = [
      {
        path: path.join(__dirname, '../../../../data/sample_invoice.txt'),
        expectedContent: ['invoice', 'amount'], // Expected content indicators
        fileType: 'text'
      },
      {
        path: path.join(__dirname, '../../../../data/Receipt-2975-4330.pdf'),
        expectedContent: ['TTKRPHII0001', '$2,025.00', 'Koenig Solutions'],
        fileType: 'pdf'
      }
    ];

    for (const testFile of testFiles) {
      console.log(`Testing ${testFile.fileType} file extraction...`);

      // Upload file
      const fileInput = page.locator('input[type="file"]');
      await fileInput.setInputFiles(testFile.path);

      // Wait for upload and processing
      await page.waitForTimeout(testFile.fileType === 'pdf' ? 8000 : 2000);

      // Click on the document
      const documentCard = page.locator('[data-testid="document-card"]').first();
      await expect(documentCard).toBeVisible({ timeout: 10000 });
      await documentCard.click();

      // Check extracted text
      const textContent = page.locator('[data-testid="extracted-text"], .document-content, .text-content');
      await expect(textContent).toBeVisible({ timeout: 15000 });

      const extractedText = await textContent.textContent();

      // Verify expected content is present
      for (const expectedText of testFile.expectedContent) {
        expect(extractedText?.toLowerCase()).toContain(expectedText.toLowerCase());
      }

      // Navigate back to documents list for next iteration
      await page.goto('http://localhost:5173/documents');
      await page.waitForLoadState('networkidle');
    }
  });

  test('should show error handling when backend is unavailable', async ({ page }) => {
    // Mock network failure for backend calls
    await page.route('**/api/enhanced-documents/**', route => route.abort());

    const pdfPath = path.join(__dirname, '../../../test-documents/edge-cases/alu, deck for nick yeager.pdf');

    // Upload PDF
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(pdfPath);

    // Wait for processing attempt
    await page.waitForTimeout(5000);

    // Should show error or fallback message
    const errorMessage = page.locator('[data-testid="error-message"], .error, .fallback-message');
    await expect(errorMessage).toBeVisible({ timeout: 10000 });

    // Or document should show fallback text extraction
    const documentCard = page.locator('[data-testid="document-card"]').first();
    if (await documentCard.isVisible()) {
      await documentCard.click();
      const textContent = page.locator('[data-testid="extracted-text"], .document-content');
      await expect(textContent).toBeVisible();

      const extractedText = await textContent.textContent();
      // Should show fallback message when backend is unavailable
      expect(extractedText).toContain('requires backend processing');
    }
  });

  test('should verify document processor backend is running', async ({ page }) => {
    // Test that the backend is actually available
    const response = await page.request.get('http://localhost:8090/health');
    expect(response.ok()).toBeTruthy();

    const healthData = await response.json();
    expect(healthData.status).toBe('healthy');
    expect(healthData.service).toBe('document-processor');

    console.log('✅ Document processor backend is running and healthy');
  });

  test('should verify PDF processing endpoint works', async ({ page }) => {
    // Test the actual backend endpoint that should be called
    const pdfPath = path.join(__dirname, '../../../test-documents/edge-cases/alu, deck for nick yeager.pdf');

    // Call the backend endpoint using multipart form data
    const response = await page.request.post('http://localhost:8090/api/enhanced-documents/process-with-ai', {
      multipart: {
        file: {
          name: 'Receipt-2975-4330.pdf',
          mimeType: 'application/pdf',
          buffer: fs.readFileSync(pdfPath)
        }
      }
    });

    console.log('Response status:', response.status());
    if (!response.ok()) {
      const errorText = await response.text();
      console.log('Error response:', errorText);
    }

    expect(response.ok()).toBeTruthy();

    const responseData = await response.json();
    expect(responseData.status).toBe('completed');
    expect(responseData.content.text).toContain('TTKRPHII0001');
    expect(responseData.content.text).toContain('$2,025.00');

    console.log('✅ Backend PDF processing endpoint working correctly');
  });
});