import { test, expect } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const imagePath = path.resolve(__dirname, '../../../test-documents/edge-cases/medical-provider-screenshot.png');

test.describe('Image OCR Support', () => {
  test.beforeAll(async ({ request }) => {
    // Ensure Azure OpenAI is selected for faster processing
    console.log('Setting AI provider to Azure OpenAI for faster test execution...');
    try {
      await request.post('http://localhost:8090/models/provider/select', {
        data: { provider: 'azure_openai' }
      });
      console.log('Azure OpenAI provider selected');
    } catch (error) {
      console.log('Note: Could not set provider to Azure OpenAI, tests may be slower with Ollama');
    }
  });

  test('should successfully process PNG images with OCR', async ({ page }) => {
    test.setTimeout(60000); // 60 second timeout for OCR processing

    // Ensure fixture exists
    if (!fs.existsSync(imagePath)) {
      throw new Error(`Fixture image not found: ${imagePath}`);
    }

    // Call the backend batch endpoint directly with the real image
    const response = await page.request.post('http://localhost:8090/api/enhanced-documents/batch-process-with-ai', {
      multipart: {
        files: {
          name: 'medical-provider-screenshot.png',
          mimeType: 'image/png',
          buffer: fs.readFileSync(imagePath)
        }
      },
      timeout: 45000
    });

    expect(response.ok()).toBeTruthy();

    const responseData = await response.json();
    expect(responseData.results).toBeDefined();
    expect(responseData.results.length).toBe(1);

    const result = responseData.results[0];
    expect(result.status).toBe('completed');

    // Verify OCR extracted text from the image
    const extractedText = result.content.text;
    expect(extractedText).toBeTruthy();
    expect(extractedText.length).toBeGreaterThan(100);

    // Should NOT contain old error messages
    expect(extractedText).not.toContain('Text extraction completed');
    expect(extractedText).not.toContain('requires backend processing');
    expect(extractedText).not.toContain('Unsupported file format');

    // Should contain medical provider information from the screenshot
    const containsMedicalInfo =
      extractedText.toLowerCase().includes('vascular surgery') ||
      extractedText.includes('520') ||
      extractedText.toLowerCase().includes('tucson') ||
      extractedText.toLowerCase().includes('provider');

    expect(containsMedicalInfo).toBeTruthy();

    console.log('Image OCR working successfully');
    console.log('Extracted text length:', extractedText.length);
    console.log('Sample:', extractedText.substring(0, 200) + '...');
  });
});
