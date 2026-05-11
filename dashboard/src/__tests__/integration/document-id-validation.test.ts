/**
 * Regression Test: Document ID Validation
 *
 * Verifies that document operations properly validate document IDs
 * before passing them to database queries.
 *
 * Created after production incident (GitHub issue #7) where:
 *   updateDocumentStatus received 'undefined' as documentId,
 *   causing PostgreSQL error: "invalid input syntax for type integer: 'undefined'"
 *
 * The bug manifests when:
 *   1. createDocumentRecord inserts a document
 *   2. data.id from the insert response is undefined (edge case)
 *   3. updateDocumentStatus(data.id, ...) passes "undefined" to .eq('id', ...)
 *   4. PostgreSQL rejects it → cryptic 400 error
 *
 * Run with:
 *   cd dashboard && npx vitest run src/__tests__/integration/document-id-validation.test.ts
 */

import { describe, it, expect, beforeAll } from 'vitest';

const BACKEND_URL =
  import.meta.env.VITE_DOCUMENT_PROCESSOR_URL || 'http://localhost:8090';

const SUPABASE_URL =
  import.meta.env.VITE_SUPABASE_URL || 'http://localhost:8000';

// ─────────────────────────────────────────────────────────────────────────────
// Source Code Validation
// Ensures unified-document-service.ts has proper ID validation guards
// ─────────────────────────────────────────────────────────────────────────────

describe('Document ID Validation: Source Code Guards', () => {
  let serviceSource: string;

  const { readFileSync } = require('fs');
  const { resolve } = require('path');

  beforeAll(() => {
    const servicePath = resolve(
      __dirname,
      '../../services/unified-document-service.ts'
    );
    serviceSource = readFileSync(servicePath, 'utf-8');
  });

  it('updateDocumentStatus must validate documentId is defined before querying', () => {
    // The function must check that documentId is not undefined/null/empty
    // before executing .eq('id', documentId)
    const hasIdValidation =
      serviceSource.includes('!documentId') ||
      serviceSource.includes('documentId === undefined') ||
      serviceSource.includes('typeof documentId') ||
      (serviceSource.includes('documentId') &&
        serviceSource.match(
          /updateDocumentStatus[\s\S]{0,300}(if\s*\(\s*!documentId|throw.*documentId.*invalid|throw.*document.*id.*required)/
        ));

    expect(
      hasIdValidation,
      'updateDocumentStatus must validate documentId parameter before database query. ' +
        'Without validation, undefined IDs cause: "invalid input syntax for type integer: undefined"'
    ).toBe(true);
  });

  it('createDocumentRecord must validate data.id exists after insert', () => {
    // After .insert().select().single(), must validate that data.id is defined
    // before passing it to updateDocumentStatus.
    // The check may be separated from .single() by the error handling block.
    const hasPostInsertValidation =
      serviceSource.includes('!data?.id') ||
      serviceSource.includes('!data.id') ||
      serviceSource.includes('data.id === undefined');

    expect(
      hasPostInsertValidation,
      'createDocumentRecord must validate data.id after .insert().select().single(). ' +
        'If data.id is undefined, downstream updateDocumentStatus calls will fail.'
    ).toBe(true);
  });

  it('createDocumentRecord must normalize array responses from .single()', () => {
    // Production Supabase can return an array [{id: 11, ...}] instead of
    // a single object {id: 11, ...} despite .single() being called.
    // The code must handle both formats by normalizing the response.
    //
    // Extract the createDocumentRecord function body to check for
    // Array.isArray normalization within that specific function.
    const fnStart = serviceSource.indexOf('createDocumentRecord');
    // Find the next static method or end of class as boundary
    const fnBody = serviceSource.slice(fnStart, fnStart + 3000);

    const hasArrayNormalization =
      fnBody.includes('Array.isArray') &&
      (fnBody.includes('rawData') || fnBody.includes('[0]'));

    expect(
      hasArrayNormalization,
      'createDocumentRecord must normalize Supabase .single() responses that arrive as arrays. ' +
        'Production evidence shows .single() returning [{id: 11}] instead of {id: 11}. ' +
        'Use: const data = Array.isArray(rawData) ? rawData[0] : rawData;'
    ).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Caller Validation
// Ensures upload components validate documentRecord.id before using it
// ─────────────────────────────────────────────────────────────────────────────

describe('Document ID Validation: Upload Component Guards', () => {
  const { readFileSync } = require('fs');
  const { resolve } = require('path');

  it('DragDropUpload must validate documentRecord.id before updateDocumentStatus', () => {
    const componentPath = resolve(
      __dirname,
      '../../components/documents/DragDropUpload.tsx'
    );
    const source = readFileSync(componentPath, 'utf-8');

    // Must check documentRecord.id before passing to updateDocumentStatus
    const hasValidation =
      source.includes('!documentRecord.id') ||
      source.includes('documentRecord.id === undefined') ||
      source.match(
        /documentRecord\.id[\s\S]{0,200}(if\s*\(!documentRecord\.id|throw.*id.*missing)/
      ) ||
      // Or the guard is in the service layer (acceptable if service validates)
      source.includes('documentRecord?.id');

    expect(
      hasValidation,
      'DragDropUpload must validate documentRecord.id before passing to updateDocumentStatus'
    ).toBe(true);
  });

  it('DocumentUploadPage must validate documentRecord.id before updateDocumentStatus', () => {
    const componentPath = resolve(
      __dirname,
      '../../features/documents/components/DocumentUploadPage.tsx'
    );
    const source = readFileSync(componentPath, 'utf-8');

    // Must check documentRecord.id before passing to updateDocumentStatus
    const hasValidation =
      source.includes('!documentRecord.id') ||
      source.includes('documentRecord.id === undefined') ||
      source.match(
        /documentRecord\.id[\s\S]{0,200}(if\s*\(!documentRecord\.id|throw.*id.*missing)/
      ) ||
      source.includes('documentRecord?.id');

    expect(
      hasValidation,
      'DocumentUploadPage must validate documentRecord.id before passing to updateDocumentStatus'
    ).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Backend Health Check
// Ensures the document processor and Supabase are reachable
// ─────────────────────────────────────────────────────────────────────────────

describe('Document ID Validation: Backend Connectivity', () => {
  it('backend health endpoint is reachable', async () => {
    const resp = await fetch(`${BACKEND_URL}/health`, { signal: AbortSignal.timeout(10_000) });
    expect(resp.ok, `Backend unhealthy at ${BACKEND_URL}/health`).toBe(true);
  });

  it('Supabase REST API is reachable', async () => {
    const resp = await fetch(`${SUPABASE_URL}/rest/v1/`, {
      headers: { apikey: 'placeholder' },
      signal: AbortSignal.timeout(10_000),
    }).catch(() => null);
    // Just verify it's reachable (will get 401 without valid key, which is fine)
    expect(resp, `Supabase REST API unreachable at ${SUPABASE_URL}`).not.toBeNull();
  });
});
