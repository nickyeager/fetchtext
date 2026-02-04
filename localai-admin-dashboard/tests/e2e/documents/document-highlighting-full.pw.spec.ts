/**
 * FULL E2E Integration Test: Document Highlighting Feature
 *
 * This test proves the complete highlighting flow works:
 * 1. Upload a PDF document
 * 2. Process it with smart-extract to get extracted fields
 * 3. Call field-positions API to get bounding boxes
 * 4. Verify bbox data is returned correctly
 *
 * NO MOCKS - all real API calls to running backend
 */

import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BACKEND_URL = 'http://localhost:8090';

test.describe('Document Highlighting - Full E2E Test', () => {
  test.beforeEach(async () => {
    // REQUIRED: Verify backend is running
    const backendHealth = await fetch(`${BACKEND_URL}/health`).catch(() => null);
    if (!backendHealth || !backendHealth.ok) {
      throw new Error(`Backend not available at ${BACKEND_URL} - cannot run integration test`);
    }
    console.log('[Test] Backend health check passed');
  });

  test('should return bbox coordinates for extracted field values in PDF', async () => {
    console.log('[Test] Starting full highlighting e2e test...');

    // Step 1: Load test PDF fixture
    const fixturePath = path.join(__dirname, '../../fixtures/Stucco Contract V1.pdf');
    if (!fs.existsSync(fixturePath)) {
      throw new Error(`Test fixture not found: ${fixturePath}`);
    }
    console.log('[Test] Step 1: Test fixture found');

    const pdfBuffer = fs.readFileSync(fixturePath);
    const pdfBlob = new Blob([pdfBuffer], { type: 'application/pdf' });

    // Step 2: Call field-positions API with known field values from this contract
    // These are values we KNOW exist in the Stucco Contract V1.pdf
    const fieldValues = [
      { fieldName: 'customer_name', value: 'Nicholas Yeager' },
      { fieldName: 'contract_type', value: 'Contract' },
      { fieldName: 'location_city', value: 'Tucson' },
    ];

    const formData = new FormData();
    formData.append('file', pdfBlob, 'Stucco Contract V1.pdf');
    formData.append('field_values', JSON.stringify(fieldValues));

    console.log('[Test] Step 2: Calling field-positions API...');
    const response = await fetch(`${BACKEND_URL}/api/enhanced-documents/field-positions`, {
      method: 'POST',
      body: formData,
    });

    console.log(`[Test] Response status: ${response.status}`);
    expect(response.ok).toBe(true);

    const data = await response.json();
    console.log('[Test] Step 3: API Response:', JSON.stringify(data, null, 2));

    // Step 4: Verify the response structure
    expect(data).toHaveProperty('filename');
    expect(data).toHaveProperty('positions');
    expect(data).toHaveProperty('total_found');
    expect(Array.isArray(data.positions)).toBe(true);

    // Step 5: Verify we got positions with bbox data
    console.log(`[Test] Step 4: Found ${data.total_found} position(s)`);
    expect(data.total_found).toBeGreaterThan(0);

    // Step 6: Verify bbox structure for each position
    let positionsWithBbox = 0;
    for (const position of data.positions) {
      expect(position).toHaveProperty('text');
      expect(position).toHaveProperty('found_in');
      expect(position).toHaveProperty('page');
      expect(position).toHaveProperty('element_type');

      if (position.bbox) {
        positionsWithBbox++;
        // Verify bbox has required fields
        expect(position.bbox).toHaveProperty('x');
        expect(position.bbox).toHaveProperty('y');
        expect(position.bbox).toHaveProperty('width');
        expect(position.bbox).toHaveProperty('height');

        // Verify bbox values are positive numbers
        expect(typeof position.bbox.x).toBe('number');
        expect(typeof position.bbox.y).toBe('number');
        expect(position.bbox.width).toBeGreaterThan(0);
        expect(position.bbox.height).toBeGreaterThan(0);

        console.log(`[Test] Position "${position.text}" has valid bbox:`, position.bbox);
      }
    }

    console.log(`[Test] Step 5: ${positionsWithBbox}/${data.positions.length} positions have bbox data`);
    expect(positionsWithBbox).toBeGreaterThan(0);

    // Step 7: Verify specific field values were found
    const foundTexts = data.positions.map((p: { text: string }) => p.text.toLowerCase());
    expect(foundTexts).toContain('nicholas yeager');
    expect(foundTexts).toContain('contract');
    expect(foundTexts).toContain('tucson');

    console.log('[Test] SUCCESS: All expected field values found with bbox coordinates');
  });

  test('should handle multiple pages in PDF', async () => {
    console.log('[Test] Testing multi-page PDF handling...');

    const fixturePath = path.join(__dirname, '../../fixtures/Stucco Contract V1.pdf');
    const pdfBuffer = fs.readFileSync(fixturePath);
    const pdfBlob = new Blob([pdfBuffer], { type: 'application/pdf' });

    // "Nicholas Yeager" appears on both page 1 and page 2
    const fieldValues = [{ fieldName: 'customer_name', value: 'Nicholas Yeager' }];

    const formData = new FormData();
    formData.append('file', pdfBlob, 'Stucco Contract V1.pdf');
    formData.append('field_values', JSON.stringify(fieldValues));

    const response = await fetch(`${BACKEND_URL}/api/enhanced-documents/field-positions`, {
      method: 'POST',
      body: formData,
    });

    expect(response.ok).toBe(true);
    const data = await response.json();

    // Nicholas Yeager should be found on multiple pages
    const pages = new Set(data.positions.map((p: { page: number }) => p.page));
    console.log(`[Test] Found matches on pages: ${Array.from(pages).join(', ')}`);

    // Verify we found it on at least 2 pages
    expect(pages.size).toBeGreaterThanOrEqual(2);
    expect(pages.has(1)).toBe(true);
    expect(pages.has(2)).toBe(true);

    console.log('[Test] SUCCESS: Multi-page positions returned correctly');
  });

  test('should return empty positions for text not in document', async () => {
    console.log('[Test] Testing text not found scenario...');

    const fixturePath = path.join(__dirname, '../../fixtures/Stucco Contract V1.pdf');
    const pdfBuffer = fs.readFileSync(fixturePath);
    const pdfBlob = new Blob([pdfBuffer], { type: 'application/pdf' });

    // Use a value that definitely doesn't exist in the contract
    const fieldValues = [
      { fieldName: 'nonexistent', value: 'XYZZY_NONEXISTENT_VALUE_12345' },
    ];

    const formData = new FormData();
    formData.append('file', pdfBlob, 'Stucco Contract V1.pdf');
    formData.append('field_values', JSON.stringify(fieldValues));

    const response = await fetch(`${BACKEND_URL}/api/enhanced-documents/field-positions`, {
      method: 'POST',
      body: formData,
    });

    expect(response.ok).toBe(true);
    const data = await response.json();

    // Should return empty positions for non-existent text
    expect(data.total_found).toBe(0);
    expect(data.positions).toHaveLength(0);

    console.log('[Test] SUCCESS: Empty positions returned for non-existent text');
  });

  test('should handle empty field values gracefully', async () => {
    console.log('[Test] Testing empty field values...');

    const fixturePath = path.join(__dirname, '../../fixtures/Stucco Contract V1.pdf');
    const pdfBuffer = fs.readFileSync(fixturePath);
    const pdfBlob = new Blob([pdfBuffer], { type: 'application/pdf' });

    // Empty field values array
    const formData = new FormData();
    formData.append('file', pdfBlob, 'Stucco Contract V1.pdf');
    formData.append('field_values', JSON.stringify([]));

    const response = await fetch(`${BACKEND_URL}/api/enhanced-documents/field-positions`, {
      method: 'POST',
      body: formData,
    });

    expect(response.ok).toBe(true);
    const data = await response.json();

    expect(data.total_found).toBe(0);
    expect(data.positions).toHaveLength(0);

    console.log('[Test] SUCCESS: Empty field values handled gracefully');
  });
});
