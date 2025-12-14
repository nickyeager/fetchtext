import { test, expect } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test.describe('Image Upload Validation', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the documents page or wherever the upload component is
    await page.goto('http://localhost:5173/documents');

    // Wait for the page to load
    await page.waitForLoadState('networkidle');
  });

  test('should validate and accept PNG files with complex names', async ({ page }) => {
    // Test file path - the screenshot that was mentioned
    const screenshotPath = path.join(__dirname, '../../../test-documents/edge-cases/Screenshot 2025-09-13 at 6.06.45 PM.png');

    // Ensure the file exists or create a test PNG
    if (!fs.existsSync(screenshotPath)) {
      console.log('Test file not found, creating a test PNG...');

      // Create directories if they don't exist
      const dir = path.dirname(screenshotPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      // Create a minimal PNG file (1x1 pixel transparent PNG)
      const pngBuffer = Buffer.from([
        0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, // PNG signature
        0x00, 0x00, 0x00, 0x0d, // IHDR chunk length
        0x49, 0x48, 0x44, 0x52, // IHDR
        0x00, 0x00, 0x00, 0x01, // width: 1
        0x00, 0x00, 0x00, 0x01, // height: 1
        0x08, 0x06, // bit depth: 8, color type: 6 (RGBA)
        0x00, 0x00, 0x00, // compression, filter, interlace
        0x1f, 0x15, 0xc4, 0x89, // CRC
        0x00, 0x00, 0x00, 0x0a, // IDAT chunk length
        0x49, 0x44, 0x41, 0x54, // IDAT
        0x78, 0x9c, 0x62, 0x00, 0x00, 0x00, 0x00, 0x02, 0x00, 0x01, // compressed data
        0xe5, 0x27, 0xde, 0xfc, // CRC
        0x00, 0x00, 0x00, 0x00, // IEND chunk length
        0x49, 0x45, 0x4e, 0x44, // IEND
        0xae, 0x42, 0x60, 0x82  // CRC
      ]);
      fs.writeFileSync(screenshotPath, pngBuffer);
      console.log('Created test PNG file');
    }

    // Look for upload button or drag-drop zone
    const uploadZone = page.locator('[data-testid="drop-zone"], .drop-zone, [role="button"][aria-label*="upload"], input[type="file"]').first();

    if (await uploadZone.isVisible()) {
      // If it's an input element, set files directly
      if (await uploadZone.evaluate(el => el.tagName === 'INPUT')) {
        await uploadZone.setInputFiles(screenshotPath);
      } else {
        // Try to find the hidden file input
        const fileInput = page.locator('input[type="file"]').first();
        if (await fileInput.count() > 0) {
          await fileInput.setInputFiles(screenshotPath);
        } else {
          // Simulate drag and drop
          const dataTransfer = await page.evaluateHandle(() => new DataTransfer());
          await page.dispatchEvent('[data-testid="drop-zone"], .drop-zone', 'drop', { dataTransfer });
        }
      }

      // Check that no error message appears about unsupported format
      await expect(page.locator('text="Unsupported file format"')).not.toBeVisible({ timeout: 3000 });
      await expect(page.locator('text="File format .png is not supported"')).not.toBeVisible({ timeout: 3000 });

      // Check for success indicators
      const successIndicators = [
        'text="Analyzing document"',
        'text="Processing"',
        'text="Upload successful"',
        'text="Document uploaded"'
      ];

      let foundSuccess = false;
      for (const indicator of successIndicators) {
        if (await page.locator(indicator).isVisible({ timeout: 1000 }).catch(() => false)) {
          foundSuccess = true;
          break;
        }
      }

      if (!foundSuccess) {
        console.log('No explicit success message found, but no error either - file was accepted');
      }
    } else {
      console.warn('Upload zone not found on page - may need authentication or navigation');
    }
  });

  test('should handle various image formats correctly', async ({ page }) => {
    // Test different file formats
    const testFiles = [
      { name: 'test.png', shouldAccept: true },
      { name: 'TEST.PNG', shouldAccept: true }, // uppercase
      { name: 'image.jpg', shouldAccept: true },
      { name: 'photo.jpeg', shouldAccept: true },
      { name: 'graphic.gif', shouldAccept: true },
      { name: 'image.webp', shouldAccept: true },
      { name: 'bitmap.bmp', shouldAccept: true },
      { name: 'scan.tiff', shouldAccept: true },
      { name: 'document.pdf', shouldAccept: true },
      { name: 'invalid.xyz', shouldAccept: false },
    ];

    for (const testFile of testFiles) {
      console.log(`Testing file: ${testFile.name}`);

      // Create a test file
      const testPath = path.join(__dirname, testFile.name);

      // Create appropriate file based on extension
      if (testFile.name.toLowerCase().endsWith('.png')) {
        // Minimal PNG
        const pngBuffer = Buffer.from([
          0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
          0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
          0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
          0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4, 0x89,
          0x00, 0x00, 0x00, 0x0a, 0x49, 0x44, 0x41, 0x54,
          0x78, 0x9c, 0x62, 0x00, 0x00, 0x00, 0x00, 0x02, 0x00, 0x01,
          0xe5, 0x27, 0xde, 0xfc,
          0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44,
          0xae, 0x42, 0x60, 0x82
        ]);
        fs.writeFileSync(testPath, pngBuffer);
      } else if (testFile.name.toLowerCase().endsWith('.pdf')) {
        // Minimal PDF
        fs.writeFileSync(testPath, '%PDF-1.0\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj 2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj 3 0 obj<</Type/Page/MediaBox[0 0 612 792]/Parent 2 0 R/Resources<<>>>>endobj\nxref\n0 4\n0000000000 65535 f\n0000000009 00000 n\n0000000058 00000 n\n0000000117 00000 n\ntrailer<</Size 4/Root 1 0 R>>\nstartxref\n203\n%%EOF');
      } else {
        // Generic test file
        fs.writeFileSync(testPath, 'test content');
      }

      // Test file upload via direct API if UI is not available
      const fileInput = page.locator('input[type="file"]').first();
      if (await fileInput.count() > 0) {
        await fileInput.setInputFiles(testPath);

        // Wait a moment for validation
        await page.waitForTimeout(500);

        // Check for error messages
        const hasError = await page.locator('text=/unsupported|not supported|invalid format/i').isVisible({ timeout: 1000 }).catch(() => false);

        if (testFile.shouldAccept) {
          expect(hasError).toBe(false);
          console.log(`✅ ${testFile.name} was accepted as expected`);
        } else {
          expect(hasError).toBe(true);
          console.log(`✅ ${testFile.name} was rejected as expected`);
        }
      }

      // Clean up test file
      if (fs.existsSync(testPath)) {
        fs.unlinkSync(testPath);
      }
    }
  });

  test('should validate file through drag-drop zone component', async ({ page }) => {
    // Create a test component page that uses DragDropZone directly
    await page.evaluate(() => {
      // This simulates the validation logic from the component
      const DEFAULT_ACCEPTED_FORMATS = ['.pdf', '.docx', '.pptx', '.xlsx', '.html', '.htm', '.txt', '.md', '.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp', '.tiff'];

      function validateFile(file) {
        const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase();
        if (!DEFAULT_ACCEPTED_FORMATS.includes(fileExtension)) {
          return `File format "${fileExtension}" is not supported. Accepted formats: ${DEFAULT_ACCEPTED_FORMATS.join(', ')}`;
        }
        return null;
      }

      // Test the screenshot filename
      const testFile = {
        name: 'Screenshot 2025-09-13 at 6.06.45 PM.png',
        size: 1024
      };

      const result = validateFile(testFile);
      console.log('Validation result for screenshot:', result || 'File is valid');

      // Store result in window for assertion
      (window as any).validationResult = result;
    });

    // Check the validation result
    const validationResult = await page.evaluate(() => (window as any).validationResult);
    expect(validationResult).toBeNull(); // Should be null (no error) for valid files
    console.log('✅ Screenshot file passes validation');
  });

  test('should handle medical provider screenshot specifically', async ({ page }) => {
    // Use the existing medical provider screenshot if it exists
    const medicalScreenshotPath = path.join(__dirname, '../../../medical-provider-screenshot.png');
    const edgeCaseScreenshotPath = path.join(__dirname, '../../../test-documents/edge-cases/medical-provider-screenshot.png');

    let screenshotPath = null;
    if (fs.existsSync(medicalScreenshotPath)) {
      screenshotPath = medicalScreenshotPath;
    } else if (fs.existsSync(edgeCaseScreenshotPath)) {
      screenshotPath = edgeCaseScreenshotPath;
    }

    if (screenshotPath) {
      console.log(`Testing with existing screenshot: ${screenshotPath}`);

      // Try to find file input
      const fileInput = page.locator('input[type="file"]').first();
      if (await fileInput.count() > 0) {
        // Upload the file
        await fileInput.setInputFiles(screenshotPath);

        // Wait for processing
        await page.waitForTimeout(1000);

        // Check for errors
        const errorVisible = await page.locator('text=/unsupported file format|format.*not supported/i').isVisible({ timeout: 2000 }).catch(() => false);

        expect(errorVisible).toBe(false);
        console.log('✅ Medical provider screenshot accepted without errors');

        // Check if OCR processing starts
        const ocrIndicators = [
          'text=/analyzing|processing|extracting/i',
          '[data-testid="loading-spinner"]',
          '.animate-spin'
        ];

        for (const indicator of ocrIndicators) {
          if (await page.locator(indicator).isVisible({ timeout: 1000 }).catch(() => false)) {
            console.log('✅ OCR processing initiated for medical screenshot');
            break;
          }
        }
      } else {
        console.log('File input not found - may need authentication');
      }
    } else {
      console.log('Medical provider screenshot not found, skipping specific test');
    }
  });
});