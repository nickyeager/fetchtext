/**
 * Integration tests for document highlighting feature
 *
 * Tests the /api/enhanced-documents/field-positions endpoint that
 * returns field positions for highlighting extracted values in document preview.
 *
 * @vitest-environment node
 */
import { describe, it, expect, beforeAll } from 'vitest';

// Test configuration - use environment variables with fallbacks
const BACKEND_URL = process.env.VITE_DOCUMENT_PROCESSOR_URL || 'http://localhost:8090';
const TEST_TIMEOUT = 30000; // 30 seconds for field position lookups

let backendAvailable = false;

// Helper: check backend availability
const isBackendAvailable = async (): Promise<boolean> => {
  try {
    const response = await fetch(`${BACKEND_URL}/health`, {
      signal: AbortSignal.timeout(5000),
    });
    return response.ok;
  } catch {
    return false;
  }
};

describe('Document Highlighting Integration', () => {
  beforeAll(async () => {
    backendAvailable = await isBackendAvailable();
    if (!backendAvailable) {
      throw new Error(
        '[TEST SETUP FAILED] Backend not available at ' +
          BACKEND_URL +
          '\n' +
          'Integration tests REQUIRE running services.\n' +
          'Start services with: python start_services.py --profile cpu'
      );
    }
    console.log('[TEST] Backend available at', BACKEND_URL);
  });

  describe('Field Positions Endpoint', () => {
    it(
      'should return field positions from backend for text file',
      async () => {
        // Create a test file with known content
        const testContent = 'Invoice Number: INV-001\nTotal: $100.00\nDate: 2024-01-15';
        const blob = new Blob([testContent], { type: 'text/plain' });
        const formData = new FormData();
        formData.append('file', blob, 'test-invoice.txt');
        formData.append('field_values', JSON.stringify(['INV-001', '$100.00', '2024-01-15']));

        console.log('[TEST] Sending field-positions request with 3 field values');

        const response = await fetch(`${BACKEND_URL}/api/enhanced-documents/field-positions`, {
          method: 'POST',
          body: formData,
        });

        console.log('[TEST] Response status:', response.status);

        expect(response.ok).toBe(true);
        const data = await response.json();

        console.log('[TEST] Response data:', JSON.stringify(data, null, 2));

        expect(data.filename).toBe('test-invoice.txt');
        expect(data.positions).toBeDefined();
        expect(Array.isArray(data.positions)).toBe(true);
        expect(typeof data.total_found).toBe('number');
        expect(data.total_found).toBeGreaterThanOrEqual(0);

        // Verify position structure for any found positions
        if (data.positions.length > 0) {
          const firstPosition = data.positions[0];
          expect(firstPosition).toHaveProperty('text');
          // Position may have page, bbox, element_type depending on document format
        }

        console.log(`[TEST] Found ${data.total_found} positions`);
      },
      TEST_TIMEOUT
    );

    it(
      'should handle empty field values gracefully',
      async () => {
        const testContent = 'Hello World - this is test content';
        const blob = new Blob([testContent], { type: 'text/plain' });
        const formData = new FormData();
        formData.append('file', blob, 'empty-test.txt');
        formData.append('field_values', JSON.stringify([]));

        console.log('[TEST] Sending field-positions request with empty field values');

        const response = await fetch(`${BACKEND_URL}/api/enhanced-documents/field-positions`, {
          method: 'POST',
          body: formData,
        });

        expect(response.ok).toBe(true);
        const data = await response.json();

        console.log('[TEST] Empty field values response:', JSON.stringify(data, null, 2));

        expect(data.positions).toEqual([]);
        expect(data.total_found).toBe(0);
      },
      TEST_TIMEOUT
    );

    it(
      'should return 400 for invalid JSON in field_values',
      async () => {
        const testContent = 'Test content for invalid JSON test';
        const blob = new Blob([testContent], { type: 'text/plain' });
        const formData = new FormData();
        formData.append('file', blob, 'invalid-json-test.txt');
        formData.append('field_values', 'not-valid-json{[}');

        console.log('[TEST] Sending field-positions request with invalid JSON');

        const response = await fetch(`${BACKEND_URL}/api/enhanced-documents/field-positions`, {
          method: 'POST',
          body: formData,
        });

        console.log('[TEST] Invalid JSON response status:', response.status);

        expect(response.status).toBe(400);

        const data = await response.json();
        expect(data.detail).toBeDefined();
        console.log('[TEST] Error detail:', data.detail);
      },
      TEST_TIMEOUT
    );

    it(
      'should return 400 for missing file',
      async () => {
        const formData = new FormData();
        formData.append('field_values', JSON.stringify(['test']));

        console.log('[TEST] Sending field-positions request without file');

        const response = await fetch(`${BACKEND_URL}/api/enhanced-documents/field-positions`, {
          method: 'POST',
          body: formData,
        });

        console.log('[TEST] Missing file response status:', response.status);

        // FastAPI returns 422 for missing required fields
        expect(response.status).toBeGreaterThanOrEqual(400);
        expect(response.status).toBeLessThan(500);
      },
      TEST_TIMEOUT
    );

    it(
      'should find text that exists in document',
      async () => {
        // Create document with specific searchable content
        const testContent = `
ACME Corporation
Invoice #12345
Date: January 15, 2024

Bill To:
John Smith
john.smith@acme.com

Items:
Widget A - $50.00
Widget B - $75.00

Total: $125.00
Due Date: February 15, 2024
        `.trim();

        const blob = new Blob([testContent], { type: 'text/plain' });
        const formData = new FormData();
        formData.append('file', blob, 'acme-invoice.txt');
        formData.append('field_values', JSON.stringify(['ACME Corporation', '$125.00', 'John Smith']));

        console.log('[TEST] Sending field-positions request with real document content');

        const response = await fetch(`${BACKEND_URL}/api/enhanced-documents/field-positions`, {
          method: 'POST',
          body: formData,
        });

        expect(response.ok).toBe(true);
        const data = await response.json();

        console.log('[TEST] Found positions:', JSON.stringify(data.positions, null, 2));

        // These values should be found in the document
        expect(data.total_found).toBeGreaterThan(0);

        // Verify at least some of the searched values were found
        const foundTexts = data.positions.map((p: { text: string }) => p.text);
        console.log('[TEST] Found texts:', foundTexts);

        // At least one of our search values should be found
        const searchedValues = ['ACME Corporation', '$125.00', 'John Smith'];
        const foundAny = searchedValues.some(
          (searchValue) =>
            foundTexts.includes(searchValue) ||
            data.positions.some((p: { found_in?: string }) => p.found_in?.includes(searchValue))
        );

        expect(foundAny).toBe(true);
      },
      TEST_TIMEOUT
    );

    it(
      'should handle values not found in document',
      async () => {
        const testContent = 'Simple document with basic text content';
        const blob = new Blob([testContent], { type: 'text/plain' });
        const formData = new FormData();
        formData.append('file', blob, 'simple.txt');
        // Search for values that don't exist
        formData.append('field_values', JSON.stringify(['XYZ-NOTFOUND-123', 'NONEXISTENT-VALUE']));

        console.log('[TEST] Sending field-positions request with non-existent values');

        const response = await fetch(`${BACKEND_URL}/api/enhanced-documents/field-positions`, {
          method: 'POST',
          body: formData,
        });

        expect(response.ok).toBe(true);
        const data = await response.json();

        console.log('[TEST] Non-existent values response:', JSON.stringify(data, null, 2));

        // Should return successfully but with no positions found
        expect(data.positions).toBeDefined();
        expect(data.total_found).toBe(0);
      },
      TEST_TIMEOUT
    );
  });

  describe('Backend Health', () => {
    it('should confirm backend is healthy', async () => {
      const response = await fetch(`${BACKEND_URL}/health`);
      expect(response.ok).toBe(true);

      const data = await response.json();
      expect(data.status).toBe('healthy');
      expect(data.service).toBe('document-processor');

      console.log('[TEST] Backend health check passed:', data);
    });
  });
});
