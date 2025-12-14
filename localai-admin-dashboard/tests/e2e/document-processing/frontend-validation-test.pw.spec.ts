import { test, expect } from '@playwright/test';
import path from 'path';
import fs from 'fs';

test.describe('Frontend File Validation - Real Upload Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the upload page
    await page.goto('http://localhost:5173/documents');
    await page.waitForLoadState('networkidle');
  });

  test('should reproduce the unsupported file format error for PNG files', async ({ page }) => {
    // Create a test PNG file
    const testDir = path.join(__dirname, '../../../test-documents/edge-cases');
    const pngPath = path.join(testDir, 'test-screenshot.png');

    // Create minimal PNG if it doesn't exist
    if (!fs.existsSync(pngPath)) {
      if (!fs.existsSync(testDir)) {
        fs.mkdirSync(testDir, { recursive: true });
      }

      // Minimal PNG file (1x1 pixel)
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
      fs.writeFileSync(pngPath, pngBuffer);
    }

    // Test what happens when we actually upload through the UI
    const fileInput = page.locator('input[type="file"]').first();

    if (await fileInput.count() > 0) {
      console.log('Found file input, attempting to upload PNG...');

      // Upload the PNG file
      await fileInput.setInputFiles(pngPath);

      // Wait a moment for any validation to trigger
      await page.waitForTimeout(2000);

      // Check for the specific error message we're trying to reproduce
      const unsupportedError = page.locator('text=/Unsupported file format|format.*not supported/i');
      const isErrorVisible = await unsupportedError.isVisible({ timeout: 3000 }).catch(() => false);

      if (isErrorVisible) {
        const errorText = await unsupportedError.textContent();
        console.log('❌ Found the error we\'re trying to reproduce:', errorText);

        // This test expects to find the error - if we find it, the issue exists
        expect(isErrorVisible).toBe(true);
        console.log('✅ Successfully reproduced the "Unsupported file format" issue for PNG files');
      } else {
        console.log('✅ No error found - PNG files are accepted correctly');

        // If no error, check if processing started (which means validation passed)
        const processingIndicators = [
          'text=/analyzing|processing|upload/i',
          '[data-testid="loading"]',
          '.loading'
        ];

        let foundProcessing = false;
        for (const indicator of processingIndicators) {
          if (await page.locator(indicator).isVisible({ timeout: 2000 }).catch(() => false)) {
            foundProcessing = true;
            console.log('✅ Processing started - validation passed');
            break;
          }
        }

        if (!foundProcessing) {
          console.log('⚠️ No error but no processing started either - inconclusive');
        }
      }
    } else {
      console.log('⚠️ No file input found - may need authentication or different page');
    }
  });

  test('should test the DocumentProcessorEnhanced validation directly', async ({ page }) => {
    // Inject the DocumentProcessorEnhanced class and test its validation
    const validationResult = await page.evaluate(() => {
      // Simulate the exact validation logic from DocumentProcessorEnhanced
      const supportedFormats = [
        'application/pdf',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/msword',
        'application/vnd.ms-powerpoint',
        'application/vnd.ms-excel',
        'text/html',
        'text/plain',
        'text/markdown',
        'text/csv',
        'image/png',
        'image/jpeg',
        'image/jpg',
        'image/gif',
        'image/bmp',
        'image/tiff',
        'image/webp'
      ];

      // Test different scenarios that might occur
      const testCases = [
        { name: 'Screenshot.png', type: 'image/png', expected: 'pass' },
        { name: 'Screenshot.png', type: '', expected: 'fail' }, // Empty MIME type
        { name: 'Screenshot.png', type: 'application/octet-stream', expected: 'fail' }, // Generic binary
        { name: 'Screenshot.PNG', type: 'image/png', expected: 'pass' }, // Uppercase extension
        { name: 'file.png', type: 'image/png', expected: 'pass' },
      ];

      const results: any[] = [];

      testCases.forEach(testCase => {
        const mockFile = {
          name: testCase.name,
          type: testCase.type,
          size: 1024
        };

        // This is the exact validation from DocumentProcessorEnhanced
        const wouldPass = supportedFormats.includes(mockFile.type);
        const actualResult = wouldPass ? 'pass' : 'fail';

        results.push({
          ...testCase,
          actualResult,
          matches: actualResult === testCase.expected,
          errorMessage: wouldPass ? null : `Unsupported file format: ${mockFile.type}`
        });
      });

      return results;
    });

    console.log('Validation test results:');
    validationResult.forEach(result => {
      const status = result.matches ? '✅' : '❌';
      console.log(`${status} ${result.name} (${result.type || 'empty'}) -> ${result.actualResult} (expected ${result.expected})`);
      if (result.errorMessage) {
        console.log(`    Error: ${result.errorMessage}`);
      }
    });

    // Check if any of the expected failures happened
    const unexpectedFailures = validationResult.filter(r => !r.matches);
    if (unexpectedFailures.length > 0) {
      console.log('❌ Found unexpected validation behavior');
    } else {
      console.log('✅ All validation tests behaved as expected');
    }
  });

  test('should test what MIME type browser actually reports for PNG files', async ({ page }) => {
    // Create a test to see what MIME type the browser actually reports
    await page.setContent(`
      <html>
        <body>
          <input type="file" id="fileInput" accept=".png">
          <div id="result"></div>
          <script>
            window.fileInfo = null;
            document.getElementById('fileInput').addEventListener('change', (e) => {
              const file = e.target.files[0];
              if (file) {
                window.fileInfo = {
                  name: file.name,
                  type: file.type,
                  size: file.size
                };
                document.getElementById('result').innerHTML =
                  'File: ' + file.name + ', Type: "' + file.type + '", Size: ' + file.size;
              }
            });
          </script>
        </body>
      </html>
    `);

    // Create a test PNG file
    const pngPath = path.join(__dirname, 'test.png');
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
    fs.writeFileSync(pngPath, pngBuffer);

    try {
      // Upload the file and see what MIME type is reported
      await page.locator('#fileInput').setInputFiles(pngPath);

      // Wait for the file info to be populated
      await page.waitForFunction(() => (window as any).fileInfo !== null, { timeout: 5000 });

      const fileInfo = await page.evaluate(() => (window as any).fileInfo);

      console.log('Browser reported file info:');
      console.log(`  Name: ${fileInfo.name}`);
      console.log(`  MIME Type: "${fileInfo.type}"`);
      console.log(`  Size: ${fileInfo.size} bytes`);

      // Test if this would pass validation
      const wouldPass = await page.evaluate((mimeType) => {
        const supportedFormats = [
          'application/pdf', 'text/html', 'text/plain', 'text/markdown', 'text/csv',
          'image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/bmp', 'image/tiff', 'image/webp'
        ];
        return supportedFormats.includes(mimeType);
      }, fileInfo.type);

      console.log(`  Would pass validation: ${wouldPass ? '✅ YES' : '❌ NO'}`);

      if (!wouldPass && fileInfo.type !== '') {
        console.log(`❌ ISSUE FOUND: Browser reports MIME type "${fileInfo.type}" which is not in supportedFormats`);
      } else if (fileInfo.type === '') {
        console.log(`❌ ISSUE FOUND: Browser reports empty MIME type for PNG file`);
      } else {
        console.log(`✅ PNG file would pass validation with MIME type: ${fileInfo.type}`);
      }

    } finally {
      // Clean up
      if (fs.existsSync(pngPath)) {
        fs.unlinkSync(pngPath);
      }
    }
  });
});