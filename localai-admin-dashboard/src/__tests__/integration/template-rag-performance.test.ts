/**
 * Template-RAG Performance Test
 *
 * Verifies that the /decide-template endpoint responds within the 45-second
 * frontend timeout after switching from 3 sequential extraction tests to
 * vector search + 1 extraction test (Template-RAG).
 *
 * Created to prevent regression of the production CORS/timeout incident
 * where /decide-template consistently exceeded the AbortSignal.timeout.
 *
 * Run with:
 *   cd localai-admin-dashboard && npx vitest run src/__tests__/integration/template-rag-performance.test.ts
 *
 * @vitest-environment node
 */

import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'fs/promises';
import path from 'path';

const BACKEND_URL =
  process.env.VITE_DOCUMENT_PROCESSOR_URL || 'http://localhost:8090';

// Budget: must finish well under the frontend's 45s AbortSignal timeout
const MAX_RESPONSE_TIME_MS = 30_000;

let backendAvailable = false;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const loadFixture = async (
  relativePath: string,
  mimeType = 'text/plain',
): Promise<File> => {
  const absolutePath = path.resolve(
    __dirname,
    '../../../tests/fixtures',
    relativePath,
  );
  const buffer = await fs.readFile(absolutePath);
  const arrayBuffer: ArrayBuffer = buffer.buffer.slice(
    buffer.byteOffset,
    buffer.byteOffset + buffer.byteLength,
  ) as ArrayBuffer;
  const blob = new Blob([arrayBuffer], { type: mimeType });
  return new File([blob], path.basename(absolutePath), { type: mimeType });
};

const isBackendAvailable = async (): Promise<boolean> => {
  try {
    const response = await fetch(`${BACKEND_URL}/health`, {
      signal: AbortSignal.timeout(10_000),
    });
    return response.ok;
  } catch {
    return false;
  }
};

// ---------------------------------------------------------------------------
// Pre-flight
// ---------------------------------------------------------------------------

beforeAll(async () => {
  backendAvailable = await isBackendAvailable();
  if (!backendAvailable) {
    throw new Error(
      `Backend not reachable at ${BACKEND_URL} — cannot run integration tests. ` +
        'Start services with: python start_services.py --profile cpu',
    );
  }
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Template-RAG: /decide-template performance', () => {
  it(
    'should respond within 30 seconds for a text fixture',
    async () => {
      const file = await loadFixture('real-test-contract.txt');
      const formData = new FormData();
      formData.append('file', file);

      const params = new URLSearchParams({
        quick_scan: 'true',
        min_match_confidence: '0.5',
        allow_generation: 'true',
        generation_mode: 'automatic',
      });

      const start = performance.now();

      const response = await fetch(
        `${BACKEND_URL}/api/enhanced-documents/decide-template?${params}`,
        {
          method: 'POST',
          body: formData,
          signal: AbortSignal.timeout(60_000),
        },
      );

      const elapsed = performance.now() - start;

      expect(response.ok).toBe(true);

      const data = await response.json();

      // Validate response format
      expect(data).toHaveProperty('action');
      expect(['use_existing', 'generated', 'no_suitable_template']).toContain(
        data.action,
      );
      expect(data).toHaveProperty('evaluation');

      // Performance assertion
      expect(elapsed).toBeLessThan(MAX_RESPONSE_TIME_MS);

      console.log(
        `[Template-RAG] action=${data.action}, elapsed=${(elapsed / 1000).toFixed(1)}s`,
      );

      // If we got an existing template match, verify its shape
      if (data.action === 'use_existing') {
        const chosen = data.chosen_template;
        expect(chosen).toBeDefined();
        expect(chosen).toHaveProperty('template_id');
        expect(chosen).toHaveProperty('match_score');

        // decision_metadata should be present
        expect(data.decision_metadata).toBeDefined();
      }
    },
    60_000,
  );

  it(
    'should include decision_metadata with extraction_tested flag',
    async () => {
      const file = await loadFixture('real-test-contract.txt');
      const formData = new FormData();
      formData.append('file', file);

      const params = new URLSearchParams({
        quick_scan: 'true',
        min_match_confidence: '0.5',
        allow_generation: 'true',
      });

      const response = await fetch(
        `${BACKEND_URL}/api/enhanced-documents/decide-template?${params}`,
        {
          method: 'POST',
          body: formData,
          signal: AbortSignal.timeout(60_000),
        },
      );

      expect(response.ok).toBe(true);
      const data = await response.json();

      if (data.action === 'use_existing') {
        const meta = data.decision_metadata;
        expect(meta).toBeDefined();
        // extraction_tested is true when extraction_quality was computed
        expect(meta).toHaveProperty('extraction_tested');
        expect(meta).toHaveProperty('match_score');
      }
    },
    60_000,
  );
});

describe('Template-RAG: /health/cors sanity', () => {
  it('should return CORS configuration', async () => {
    const response = await fetch(`${BACKEND_URL}/health/cors`, {
      signal: AbortSignal.timeout(10_000),
    });
    expect(response.ok).toBe(true);
    const data = await response.json();
    expect(data.status).toBe('ok');
    expect(data.allowed_origins).toBeDefined();
    expect(data.allowed_origins_count).toBeGreaterThan(0);
  });
});
