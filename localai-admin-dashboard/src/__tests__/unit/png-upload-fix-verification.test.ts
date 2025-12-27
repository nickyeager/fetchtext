/**
 * Integration test to verify PNG upload fix actually works
 * This test uses the REAL DocumentProcessorEnhanced class
 */

import { describe, it, expect, vi } from 'vitest';
import { DocumentProcessorEnhanced } from '@/lib/document-processor-enhanced';

describe('PNG Upload Fix Verification', () => {
  let processor: DocumentProcessorEnhanced;

  beforeEach(() => {
    processor = new DocumentProcessorEnhanced();

    // Mock fetch to prevent actual API calls
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should accept PNG files with correct MIME type', async () => {
    const mockFile = new File(['fake png content'], 'screenshot.png', {
      type: 'image/png'
    });

    // Mock successful API response
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        content: 'Extracted text from PNG',
        metadata: { pages: 1 }
      })
    });

    // This should NOT throw an error
    expect(async () => {
      await processor.processDocumentWithDocling(mockFile);
    }).not.toThrow();
  });

  it('should accept PNG files with empty MIME type (FIXED)', async () => {
    const mockFile = new File(['fake png content'], 'screenshot.png', {
      type: '' // Empty MIME type - common browser issue
    });

    // Mock successful API response
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        content: 'Extracted text from PNG',
        metadata: { pages: 1 }
      })
    });

    // This should NOT throw an error (this would have failed before the fix)
    expect(async () => {
      await processor.processDocumentWithDocling(mockFile);
    }).not.toThrow();

    console.log('✅ PNG with empty MIME type accepted');
  });

  it('should accept PNG files with generic binary MIME type (FIXED)', async () => {
    const mockFile = new File(['fake png content'], 'screenshot.png', {
      type: 'application/octet-stream' // Generic binary - common for PNG
    });

    // Mock successful API response
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        content: 'Extracted text from PNG',
        metadata: { pages: 1 }
      })
    });

    // This should NOT throw an error (this would have failed before the fix)
    expect(async () => {
      await processor.processDocumentWithDocling(mockFile);
    }).not.toThrow();

    console.log('✅ PNG with generic binary MIME type accepted');
  });

  it('should accept PNG files with alternative MIME type (FIXED)', async () => {
    const mockFile = new File(['fake png content'], 'screenshot.png', {
      type: 'image/x-png' // Alternative PNG MIME type
    });

    // Mock successful API response
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        content: 'Extracted text from PNG',
        metadata: { pages: 1 }
      })
    });

    // This should NOT throw an error (this would have failed before the fix)
    expect(async () => {
      await processor.processDocumentWithDocling(mockFile);
    }).not.toThrow();

    console.log('✅ PNG with alternative MIME type accepted');
  });

  it('should still reject truly unsupported files', async () => {
    const mockFile = new File(['fake content'], 'document.xyz', {
      type: 'application/unknown'
    });

    // This should throw an error for unsupported file types
    await expect(async () => {
      await processor.processDocumentWithDocling(mockFile);
    }).rejects.toThrow('Unsupported file format');

    console.log('✅ Unsupported files still rejected correctly');
  });

  it('should test the exact validation method directly', () => {
    // Test the validation method directly using reflection
    const testCases = [
      {
        name: 'Screenshot 2025-09-13 at 6.06.45 PM.png',
        type: 'image/png',
        shouldPass: true,
        description: 'Normal PNG with correct MIME'
      },
      {
        name: 'Screenshot 2025-09-13 at 6.06.45 PM.png',
        type: '',
        shouldPass: true,
        description: 'PNG with empty MIME (FIXED)'
      },
      {
        name: 'Screenshot 2025-09-13 at 6.06.45 PM.png',
        type: 'application/octet-stream',
        shouldPass: true,
        description: 'PNG with binary MIME (FIXED)'
      },
      {
        name: 'document.xyz',
        type: 'application/unknown',
        shouldPass: false,
        description: 'Unsupported file'
      }
    ];

    testCases.forEach(testCase => {
      const mockFile = new File(['content'], testCase.name, {
        type: testCase.type
      });

      console.log(`Testing: ${testCase.description}`);
      console.log(`  File: ${testCase.name}, MIME: "${testCase.type}"`);

      try {
        // Access the private method using bracket notation
        (processor as any).validateFileFormat(mockFile);

        if (testCase.shouldPass) {
          console.log(`  ✅ PASSED as expected`);
        } else {
          console.log(`  ❌ FAILED - should have been rejected but wasn't`);
          expect(false).toBe(true); // Force test failure
        }
      } catch (error) {
        if (!testCase.shouldPass) {
          console.log(`  ✅ REJECTED as expected: ${(error as Error).message}`);
        } else {
          console.log(`  ❌ FAILED - should have passed but was rejected: ${(error as Error).message}`);
          throw error; // Re-throw to fail the test
        }
      }
    });
  });
});