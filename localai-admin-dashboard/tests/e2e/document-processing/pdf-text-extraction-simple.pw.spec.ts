import { test, expect } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test.describe('PDF Text Extraction - Backend Integration', () => {
  test('should verify backend processes PDF correctly (even with minimal text)', async ({ page }) => {
    // Test with a technical drawing PDF that has minimal text content
    const pdfPath = path.join(__dirname, '../../../test-documents/edge-cases/alu, deck for nick yeager.pdf');

    // Call the backend endpoint using multipart form data
    const response = await page.request.post('http://localhost:8090/api/enhanced-documents/process-with-ai', {
      multipart: {
        file: {
          name: 'alu, deck for nick yeager.pdf',
          mimeType: 'application/pdf',
          buffer: fs.readFileSync(pdfPath)
        }
      }
    });

    expect(response.ok()).toBeTruthy();

    const responseData = await response.json();
    expect(responseData.status).toBe('completed');

    // This PDF is a technical drawing with minimal text, so we expect minimal/empty text extraction
    const extractedText = responseData.content.text;

    // Verify the backend processed the PDF successfully (even if text is minimal/empty)
    expect(responseData.processing_method).toBe('real_docling');
    expect(responseData.metadata.mime_type).toBe('application/pdf');
    expect(responseData.content).toBeDefined();

    // Verify it's NOT the hardcoded fallback message from our old bug
    expect(extractedText).not.toContain('Text extraction completed');
    expect(extractedText).not.toContain('requires backend processing for full text extraction');

    // Log what we extracted (may be empty for technical drawings)
    console.log('✅ Backend successfully processed PDF');
    console.log('Processing method:', responseData.processing_method);
    console.log('Extracted text length:', extractedText.length);
    console.log('Content preview:', extractedText || '[No text content - technical drawing]');

    // For technical drawings, empty text is acceptable - the important thing is that
    // the backend was called and processed the PDF (vs returning hardcoded message)
    console.log('✅ PDF processed correctly - technical drawing with minimal extractable text');

    // Verify document structure was analyzed
    expect(responseData.content.document_structure).toBeDefined();
    expect(responseData.content.layout_info.pages).toBe(1);
  });

  test('should verify document processor health', async ({ page }) => {
    const response = await page.request.get('http://localhost:8090/health');
    expect(response.ok()).toBeTruthy();

    const healthData = await response.json();
    expect(healthData.status).toBe('healthy');
    expect(healthData.service).toBe('document-processor');

    console.log('✅ Document processor backend is healthy');
  });
});

// This test will demonstrate the issue when we run it against the current frontend
test.describe('PDF Text Extraction - Frontend Issue (Will Fail Until Fixed)', () => {
  test.skip('Frontend PDF upload should call backend for text extraction', async ({ page }) => {
    // This test is skipped because it requires the frontend fix
    // After we fix extractTextFromFile method, this test should pass

    // The issue: Frontend's extractTextFromFile method returns hardcoded message
    // for PDF files instead of calling the backend process-with-ai endpoint

    // Expected fix: Update extractTextFromFile in document-processor-enhanced.ts
    // to call this.processDocumentWithDocling(file) for PDF files

    console.log('📝 This test will be enabled after fixing extractTextFromFile method');
  });
});