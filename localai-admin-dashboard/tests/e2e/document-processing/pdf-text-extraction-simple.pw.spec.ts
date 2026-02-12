import { test, expect } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixturePath = path.resolve(__dirname, '../../fixtures/Stucco Contract V1.pdf');

test.describe('PDF Text Extraction - Backend Integration', () => {
  test('should verify backend processes PDF correctly', async ({ page }) => {
    test.setTimeout(60000);

    // Ensure fixture exists
    if (!fs.existsSync(fixturePath)) {
      throw new Error(`Fixture not found: ${fixturePath}`);
    }

    // Call the backend batch endpoint
    const response = await page.request.post('http://localhost:8090/api/enhanced-documents/batch-process-with-ai', {
      multipart: {
        files: {
          name: 'Stucco Contract V1.pdf',
          mimeType: 'application/pdf',
          buffer: fs.readFileSync(fixturePath)
        }
      }
    });

    expect(response.ok()).toBeTruthy();

    const responseData = await response.json();
    expect(responseData.results).toBeDefined();
    expect(responseData.results.length).toBe(1);

    const result = responseData.results[0];
    expect(result.status).toBe('completed');

    const extractedText = result.content.text;

    // Verify the backend processed the PDF successfully
    expect(result.metadata.mime_type).toBe('application/pdf');
    expect(result.content).toBeDefined();

    // Verify it's NOT the hardcoded fallback message from our old bug
    expect(extractedText).not.toContain('Text extraction completed');
    expect(extractedText).not.toContain('requires backend processing for full text extraction');

    // The stucco contract should have real text content
    expect(extractedText.length).toBeGreaterThan(50);

    console.log('Backend successfully processed PDF');
    console.log('Processing method:', result.processing_method);
    console.log('Extracted text length:', extractedText.length);
  });

  test('should verify document processor health', async ({ page }) => {
    const response = await page.request.get('http://localhost:8090/health');
    expect(response.ok()).toBeTruthy();

    const healthData = await response.json();
    expect(healthData.status).toBe('healthy');
    expect(healthData.service).toBe('document-processor');

    console.log('Document processor backend is healthy');
  });
});
