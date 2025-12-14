# Fix Extracted Fields Display in DocumentDetailView Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix the extracted fields display in DocumentDetailView to properly show all extracted values from the backend instead of displaying them as JSON blobs.

**Architecture:** The issue is that extracted fields flow from backend → Supabase metadata → frontend, but somewhere in this pipeline the structured data becomes JSON strings. We'll add comprehensive logging to trace the data flow, identify where the structure breaks, and fix the parsing/display logic.

**Tech Stack:**
- Frontend: React, TypeScript, TanStack Query
- Backend: Python FastAPI, smart_field_extractor service
- Database: Supabase PostgreSQL with JSONB fields

---

## Background & Problem Analysis

### Current Data Flow
1. **Backend** (`smart_field_extractor.py`) extracts fields and returns:
   ```python
   {
       "extracted_values": {
           "field_name": {
               "value": "extracted value",
               "confidence": 0.95,
               "type": "text",
               "sourceText": "original text"
           }
       }
   }
   ```

2. **Supabase** stores this in `documents.metadata` or `documents.extracted_fields` as JSONB

3. **Frontend** (`DocumentDetailView.tsx`) tries to detect fields from multiple sources:
   - `document.extracted_fields`
   - `document.metadata.extracted_fields`
   - `document.metadata.extraction_result.extracted_values`
   - `document.metadata.extracted_data.extracted_values`

4. **ExtractedFieldsEditor** component expects `Record<string, unknown>` and processes it into display format

### The Problem
The frontend is displaying extracted fields as JSON blobs instead of properly formatted field values, suggesting:
- Data is being JSON-stringified when it shouldn't be
- Detection logic is choosing the wrong data source
- Field structure is not matching expected format

---

## Task 1: Add Comprehensive Logging to DocumentDetailView

**Files:**
- Modify: `localai-admin-dashboard/src/features/documents/components/DocumentDetailView.tsx:1692-1778`

**Step 1: Add detailed logging at extraction result retrieval**

Add logging right after the document query returns data (around line 200):

```typescript
// After line 200, add extensive logging
useEffect(() => {
  if (!document) return;

  console.log('═══════════════════════════════════════════════════════');
  console.log('📊 [DocumentDetailView] Full Document Data Analysis');
  console.log('═══════════════════════════════════════════════════════');
  console.log('Document ID:', documentId);
  console.log('Document Name:', document.name);
  console.log('Processing Status:', document.processing_status);
  console.log('');

  console.log('--- Top-Level extracted_fields ---');
  console.log('Type:', typeof document.extracted_fields);
  console.log('Value:', document.extracted_fields);
  console.log('Keys:', document.extracted_fields ? Object.keys(document.extracted_fields) : 'N/A');
  console.log('');

  console.log('--- Metadata Structure ---');
  console.log('Metadata keys:', Object.keys(document.metadata || {}));
  console.log('Full metadata:', JSON.stringify(document.metadata, null, 2));
  console.log('');

  if (document.metadata) {
    const meta = document.metadata as Record<string, unknown>;

    console.log('--- metadata.extracted_fields ---');
    console.log('Type:', typeof meta.extracted_fields);
    console.log('Value:', meta.extracted_fields);
    if (meta.extracted_fields && typeof meta.extracted_fields === 'object') {
      console.log('Keys:', Object.keys(meta.extracted_fields));
      console.log('Sample field:', Object.entries(meta.extracted_fields)[0]);
    }
    console.log('');

    console.log('--- metadata.extraction_result ---');
    console.log('Type:', typeof meta.extraction_result);
    console.log('Value:', meta.extraction_result);
    if (meta.extraction_result && typeof meta.extraction_result === 'object') {
      const er = meta.extraction_result as Record<string, unknown>;
      console.log('Keys:', Object.keys(er));
      console.log('extracted_values type:', typeof er.extracted_values);
      console.log('extracted_values value:', er.extracted_values);
      if (er.extracted_values && typeof er.extracted_values === 'object') {
        console.log('extracted_values keys:', Object.keys(er.extracted_values));
        console.log('Sample extracted value:', Object.entries(er.extracted_values)[0]);
      }
    }
    console.log('');

    console.log('--- metadata.extracted_data ---');
    console.log('Type:', typeof meta.extracted_data);
    console.log('Value:', meta.extracted_data);
    if (meta.extracted_data && typeof meta.extracted_data === 'object') {
      const ed = meta.extracted_data as Record<string, unknown>;
      console.log('Keys:', Object.keys(ed));
      console.log('extracted_values type:', typeof ed.extracted_values);
      console.log('extracted_values value:', ed.extracted_values);
      if (ed.extracted_values && typeof ed.extracted_values === 'object') {
        console.log('extracted_values keys:', Object.keys(ed.extracted_values));
        console.log('Sample extracted value:', Object.entries(ed.extracted_values)[0]);
      }
    }
    console.log('');

    console.log('--- metadata.fields ---');
    console.log('Type:', typeof meta.fields);
    console.log('Value:', meta.fields);
    if (meta.fields && typeof meta.fields === 'object') {
      console.log('Keys:', Object.keys(meta.fields));
      console.log('Sample field:', Object.entries(meta.fields)[0]);
    }
  }

  console.log('═══════════════════════════════════════════════════════');
}, [document, documentId]);
```

**Step 2: Add logging to field detection logic**

Replace the existing detection logic (lines 1692-1778) with enhanced logging version:

```typescript
{/* Extracted Fields Editor */}
{(() => {
  // Handle different possible structures for extracted fields
  let extractedFields = {};
  let confidenceScores = {};
  let detectionPath = 'none';

  console.log('');
  console.log('🔍 [Field Detection] Starting field detection process');
  console.log('Document ID:', documentId);

  // Try direct extracted_fields first
  if (document.extracted_fields && typeof document.extracted_fields === 'object') {
    extractedFields = document.extracted_fields;
    detectionPath = 'document.extracted_fields';
    console.log('✅ [Field Detection] Found fields at:', detectionPath);
    console.log('   Field count:', Object.keys(extractedFields).length);
    console.log('   Fields:', extractedFields);
  }
  // Try metadata.extracted_fields
  else if (document.metadata?.extracted_fields && typeof document.metadata.extracted_fields === 'object') {
    extractedFields = document.metadata.extracted_fields;
    detectionPath = 'metadata.extracted_fields';
    console.log('✅ [Field Detection] Found fields at:', detectionPath);
    console.log('   Field count:', Object.keys(extractedFields).length);
    console.log('   Fields:', extractedFields);
  }
  // Try metadata.extraction_result.extracted_values
  else if ((document.metadata as Record<string, unknown>)?.extraction_result &&
           typeof (document.metadata as Record<string, unknown>).extraction_result === 'object') {
    const erUnknown = (document.metadata as Record<string, unknown>).extraction_result as unknown;
    if (erUnknown && typeof erUnknown === 'object') {
      const er = erUnknown as { extracted_values?: Record<string, unknown>; confidence_scores?: Record<string, number> };
      if (er.extracted_values && typeof er.extracted_values === 'object') {
        extractedFields = er.extracted_values;
        detectionPath = 'metadata.extraction_result.extracted_values';
        console.log('✅ [Field Detection] Found fields at:', detectionPath);
        console.log('   Field count:', Object.keys(extractedFields).length);
        console.log('   Fields:', extractedFields);
      }
      if (er.confidence_scores && typeof er.confidence_scores === 'object') {
        confidenceScores = er.confidence_scores as Record<string, number>;
        console.log('   Found confidence scores:', confidenceScores);
      }
    }
  }
  // CRITICAL FIX: Also check metadata.extracted_data.extracted_values (backend response structure)
  else if ((document.metadata as Record<string, unknown>)?.extracted_data &&
           typeof (document.metadata as Record<string, unknown>).extracted_data === 'object') {
    const edUnknown = (document.metadata as Record<string, unknown>).extracted_data as unknown;
    if (edUnknown && typeof edUnknown === 'object') {
      const ed = edUnknown as { extracted_values?: Record<string, unknown>; confidence_scores?: Record<string, number> };
      if (ed.extracted_values && typeof ed.extracted_values === 'object') {
        extractedFields = ed.extracted_values;
        detectionPath = 'metadata.extracted_data.extracted_values';
        console.log('✅ [Field Detection] Found fields at:', detectionPath);
        console.log('   Field count:', Object.keys(extractedFields).length);
        console.log('   Fields:', extractedFields);
      }
      if (ed.confidence_scores && typeof ed.confidence_scores === 'object') {
        confidenceScores = ed.confidence_scores as Record<string, number>;
        console.log('   Found confidence scores:', confidenceScores);
      }
    }
  }
  // Try metadata.fields
  else if (document.metadata?.fields && typeof document.metadata.fields === 'object') {
    extractedFields = document.metadata.fields;
    detectionPath = 'metadata.fields';
    console.log('✅ [Field Detection] Found fields at:', detectionPath);
    console.log('   Field count:', Object.keys(extractedFields).length);
    console.log('   Fields:', extractedFields);
  } else {
    console.log('❌ [Field Detection] No fields found in any expected location');
    console.log('   Checked paths:');
    console.log('   - document.extracted_fields');
    console.log('   - metadata.extracted_fields');
    console.log('   - metadata.extraction_result.extracted_values');
    console.log('   - metadata.extracted_data.extracted_values');
    console.log('   - metadata.fields');
  }

  console.log('');
  console.log('📦 [Field Detection] Final Results:');
  console.log('   Detection path:', detectionPath);
  console.log('   Field count:', Object.keys(extractedFields).length);
  console.log('   Field names:', Object.keys(extractedFields));
  console.log('   Full extracted fields:', extractedFields);
  console.log('   Confidence scores:', confidenceScores);
  console.log('');

  return (
    <ExtractedFieldsEditor
      documentId={documentId}
      extractedFields={extractedFields}
      confidenceScores={confidenceScores}
      onSave={handleSaveExtractedFields}
      onCreateTemplate={async (fields) => {
        setFieldsForTemplate(fields);
        setShowCreateTemplateDialog(true);
      }}
      readOnly={false}
      showCreateTemplate={true}
    />
  );
})()}
```

**Step 3: Add logging to ExtractedFieldsEditor initialization**

In `ExtractedFieldsEditor.tsx`, add logging in the useEffect (after line 67):

```typescript
// Initialize fields from props
useEffect(() => {
  console.log('');
  console.log('🎨 [ExtractedFieldsEditor] Initializing fields from props');
  console.log('   Prop extractedFields type:', typeof initialFields);
  console.log('   Prop extractedFields value:', initialFields);
  console.log('   Prop extractedFields keys:', Object.keys(initialFields || {}));
  console.log('   Confidence scores:', confidenceScores);
  console.log('');

  const processedFields = Object.entries(initialFields || {}).map(([key, value], index) => {
    console.log(`   Processing field ${index + 1}/${Object.keys(initialFields || {}).length}: "${key}"`);
    console.log('     Raw value type:', typeof value);
    console.log('     Raw value:', value);

    let displayValue = '';
    let confidence = confidenceScores[key] || 0;
    let sourceText = '';
    let fieldType: ExtractedField['type'] = 'text';

    // Handle different field data structures
    if (typeof value === 'object' && value !== null) {
      const valAny = value as Record<string, unknown>;
      console.log('     Object keys:', Object.keys(valAny));

      if ('value' in valAny) {
        const rawVal = valAny.value;
        displayValue = rawVal == null ? '' : typeof rawVal === 'string' ? rawVal : JSON.stringify(rawVal);
        console.log('     Extracted .value property:', displayValue);

        if (typeof valAny.confidence === 'number') {
          confidence = valAny.confidence;
          console.log('     Extracted .confidence property:', confidence);
        }
        if (typeof valAny.sourceText === 'string') {
          sourceText = valAny.sourceText;
          console.log('     Extracted .sourceText property:', sourceText);
        }
        if (typeof valAny.type === 'string') {
          fieldType = valAny.type as ExtractedField['type'];
          console.log('     Extracted .type property:', fieldType);
        }
      } else {
        displayValue = JSON.stringify(valAny);
        console.log('     ⚠️ No .value property, stringifying entire object:', displayValue);
      }
    } else {
      displayValue = value == null ? '' : typeof value === 'string' ? value : String(value);
      console.log('     Primitive value:', displayValue);
    }

    // Infer field type from name and value (existing logic continues...)
    // ... rest of existing type inference code ...

    const processedField = {
      id: key,
      name: key,
      value: displayValue,
      confidence,
      sourceText,
      type: fieldType,
      required: confidence > 0.8 || key.toLowerCase().includes('id') || key.toLowerCase().includes('number')
    };

    console.log('     Final processed field:', processedField);
    console.log('');

    return processedField;
  });

  console.log('🎨 [ExtractedFieldsEditor] Field processing complete');
  console.log('   Total processed fields:', processedFields.length);
  console.log('   Processed fields:', processedFields);
  console.log('');

  setFields(processedFields);
}, [initialFields, confidenceScores]);
```

**Step 4: Test with a real document**

Run the application and navigate to a document detail view:

```bash
cd localai-admin-dashboard
pnpm build
# Then in browser, navigate to a processed document
# Check browser console for all the log output
```

Expected output:
- Full document structure logged
- Field detection path identified
- Each field processing step logged
- Clear identification of where data structure breaks

**Step 5: Commit logging changes**

```bash
git add localai-admin-dashboard/src/features/documents/components/DocumentDetailView.tsx
git add localai-admin-dashboard/src/features/documents/components/ExtractedFieldsEditor.tsx
git commit -m "feat: add comprehensive logging to trace extracted fields data flow"
```

---

## Task 2: Identify and Document Data Structure Issues

**Files:**
- Create: `docs/analysis/extracted-fields-data-flow.md`

**Step 1: Run application and capture logs**

1. Start services: `python start_services.py --profile cpu`
2. Navigate to a document with extracted fields
3. Copy all console logs to a text file
4. Analyze the logs to identify:
   - Which detection path is being used
   - What the data structure looks like at each step
   - Where JSON stringification occurs
   - What the ExtractedFieldsEditor receives

**Step 2: Create analysis document**

Create `docs/analysis/extracted-fields-data-flow.md`:

```markdown
# Extracted Fields Data Flow Analysis

**Date:** 2025-12-13
**Document Tested:** [Document ID and name]
**Browser:** [Browser version]

## Backend Response Structure

From `smart_field_extractor.py`, the backend returns:

```json
{
  "extracted_values": {
    "field_name": {
      "value": "actual extracted value",
      "confidence": 0.95,
      "type": "text",
      "sourceText": "source text from document"
    }
  },
  "confidence_scores": {
    "field_name": 0.95
  }
}
```

## Supabase Storage Structure

[Document what's actually stored in the database]

**Column:** `extracted_fields` (JSONB)
**Value:** [Paste actual value from logs]

**Column:** `metadata` (JSONB)
**Value:** [Paste actual value from logs]

## Frontend Detection Results

**Detection Path Used:** [e.g., metadata.extraction_result.extracted_values]

**Data Structure at Detection Point:**
```json
[Paste the actual structure from logs]
```

## Issues Identified

1. **Issue 1:** [Describe the problem]
   - Expected: [What should be there]
   - Actual: [What's actually there]
   - Cause: [Why this is happening]

2. **Issue 2:** [etc.]

## Recommended Fixes

1. [Specific fix with code location]
2. [etc.]
```

**Step 3: Fill in analysis document with actual log data**

Manually review the console logs and fill in all sections of the analysis document.

**Step 4: Commit analysis**

```bash
git add docs/analysis/extracted-fields-data-flow.md
git commit -m "docs: analyze extracted fields data flow and identify issues"
```

---

## Task 3: Fix Data Parsing Logic in DocumentDetailView

**Files:**
- Modify: `localai-admin-dashboard/src/features/documents/components/DocumentDetailView.tsx:1692-1778`

Based on the analysis from Task 2, we'll likely need to fix one or more of these issues:

### Fix 3A: Handle JSON-stringified data

If the data is stored as a JSON string instead of an object:

```typescript
// Add this helper function before the component
function parseExtractedFields(data: unknown): Record<string, unknown> {
  if (!data) return {};

  // If it's already an object, return it
  if (typeof data === 'object' && data !== null) {
    return data as Record<string, unknown>;
  }

  // If it's a string, try to parse it
  if (typeof data === 'string') {
    try {
      const parsed = JSON.parse(data);
      if (typeof parsed === 'object' && parsed !== null) {
        return parsed as Record<string, unknown>;
      }
    } catch (e) {
      console.error('[parseExtractedFields] Failed to parse JSON string:', e);
    }
  }

  return {};
}
```

Then use this function in the detection logic:

```typescript
// Try direct extracted_fields first
if (document.extracted_fields) {
  const parsed = parseExtractedFields(document.extracted_fields);
  if (Object.keys(parsed).length > 0) {
    extractedFields = parsed;
    detectionPath = 'document.extracted_fields';
  }
}
```

### Fix 3B: Prioritize correct data source

If multiple sources exist but some are outdated, ensure we use the most recent/correct one:

```typescript
// Priority order (most reliable first):
const sources = [
  {
    name: 'metadata.extraction_result.extracted_values',
    getter: () => (document.metadata as Record<string, unknown>)?.extraction_result?.extracted_values
  },
  {
    name: 'metadata.extracted_data.extracted_values',
    getter: () => (document.metadata as Record<string, unknown>)?.extracted_data?.extracted_values
  },
  {
    name: 'document.extracted_fields',
    getter: () => document.extracted_fields
  },
  {
    name: 'metadata.extracted_fields',
    getter: () => document.metadata?.extracted_fields
  },
  {
    name: 'metadata.fields',
    getter: () => document.metadata?.fields
  }
];

for (const source of sources) {
  const data = source.getter();
  const parsed = parseExtractedFields(data);
  if (Object.keys(parsed).length > 0) {
    extractedFields = parsed;
    detectionPath = source.name;
    console.log('✅ [Field Detection] Using source:', detectionPath);
    break;
  }
}
```

### Fix 3C: Handle nested value extraction

If the structure has an extra nesting level:

```typescript
function normalizeFieldStructure(fields: Record<string, unknown>): Record<string, unknown> {
  const normalized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(fields)) {
    // If value is already in correct format {value, confidence, type, sourceText}
    if (value && typeof value === 'object' && 'value' in value) {
      normalized[key] = value;
    }
    // If value is nested one level deeper
    else if (value && typeof value === 'object' && 'extracted_values' in value) {
      const nested = (value as any).extracted_values;
      if (nested && typeof nested === 'object' && 'value' in nested) {
        normalized[key] = nested;
      }
    }
    // If value is a primitive, wrap it
    else {
      normalized[key] = {
        value: value,
        confidence: 0,
        type: 'text',
        sourceText: ''
      };
    }
  }

  return normalized;
}
```

**Step 1: Implement the fixes identified in Task 2**

Based on the specific issues found, implement the appropriate fixes from 3A, 3B, or 3C above.

**Step 2: Test the fixes**

```bash
cd localai-admin-dashboard
pnpm build
# Navigate to document detail view in browser
# Verify extracted fields display correctly
```

Expected result:
- Fields display as individual inputs, not JSON blobs
- Each field shows its value, confidence, type
- Field editing works properly

**Step 3: Commit the fixes**

```bash
git add localai-admin-dashboard/src/features/documents/components/DocumentDetailView.tsx
git commit -m "fix: properly parse and display extracted fields data structure"
```

---

## Task 4: Add Integration Test for Field Display

**Files:**
- Create: `localai-admin-dashboard/src/__tests__/integration/extracted-fields-display.test.tsx`

**Step 1: Write test for field display**

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider, createMemoryHistory, createRootRoute, createRoute, createRouter } from '@tanstack/react-router';
import { DocumentDetailView } from '@/features/documents/components/DocumentDetailView';

describe('Extracted Fields Display Integration Test', () => {
  let queryClient: QueryClient;
  let testDocumentId: string;

  beforeAll(async () => {
    // Setup: Create a test document with extracted fields
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false }
      }
    });

    // TODO: Upload a test document and process it
    // This will be filled in after we understand the exact test setup needed
  });

  afterAll(async () => {
    // Cleanup: Delete test document
  });

  it('should display extracted fields as individual inputs, not JSON blobs', async () => {
    // Create test document data with known structure
    const mockDocument = {
      id: '123',
      name: 'Test Document',
      processing_status: 'completed',
      extracted_fields: {
        company_name: {
          value: 'Acme Corp',
          confidence: 0.95,
          type: 'text',
          sourceText: 'Acme Corp from page 1'
        },
        contract_number: {
          value: 'CNT-12345',
          confidence: 0.88,
          type: 'text',
          sourceText: 'Contract #CNT-12345'
        },
        amount: {
          value: '$50,000',
          confidence: 0.92,
          type: 'currency',
          sourceText: 'Total amount: $50,000'
        }
      },
      metadata: {},
      created_at: new Date().toISOString(),
      file_type: 'application/pdf',
      file_size: 12345
    };

    // Mock the API response
    const { vi } = await import('vitest');
    const { UnifiedDocumentService } = await import('@/services/unified-document-service');
    vi.spyOn(UnifiedDocumentService, 'getDocumentById').mockResolvedValue(mockDocument as any);

    // Create router for the test
    const rootRoute = createRootRoute();
    const documentRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: '/documents/$documentId',
      component: () => <DocumentDetailView documentId="123" />
    });
    const router = createRouter({
      routeTree: rootRoute.addChildren([documentRoute]),
      history: createMemoryHistory({ initialEntries: ['/documents/123'] })
    });

    // Render the component
    render(
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    );

    // Wait for component to load
    await waitFor(() => {
      expect(screen.getByText('Test Document')).toBeInTheDocument();
    });

    // Verify extracted fields section exists
    const fieldsSection = await screen.findByTestId('extracted-fields-editor');
    expect(fieldsSection).toBeInTheDocument();

    // Verify individual fields are displayed, not JSON blob
    await waitFor(() => {
      // Check that field names are displayed as labels
      expect(screen.getByText(/company_name/i)).toBeInTheDocument();
      expect(screen.getByText(/contract_number/i)).toBeInTheDocument();
      expect(screen.getByText(/amount/i)).toBeInTheDocument();

      // Check that field values are displayed correctly
      const companyField = screen.getByTestId('extracted-field-value');
      expect(companyField).toHaveTextContent('Acme Corp');

      // Verify NOT displaying as JSON blob
      const pageText = document.body.textContent || '';
      expect(pageText).not.toContain('{"value"');
      expect(pageText).not.toContain('"confidence"');
    });

    // Verify confidence badges are shown
    const confidenceBadges = screen.getAllByText(/\d+%/);
    expect(confidenceBadges.length).toBeGreaterThan(0);
  });

  it('should handle different metadata storage structures', async () => {
    // Test with data in metadata.extraction_result.extracted_values
    const mockDocumentMetadata = {
      id: '456',
      name: 'Test Document 2',
      processing_status: 'completed',
      extracted_fields: null,
      metadata: {
        extraction_result: {
          extracted_values: {
            field1: { value: 'Value 1', confidence: 0.9, type: 'text' },
            field2: { value: 'Value 2', confidence: 0.85, type: 'text' }
          }
        }
      },
      created_at: new Date().toISOString(),
      file_type: 'application/pdf',
      file_size: 12345
    };

    const { vi } = await import('vitest');
    const { UnifiedDocumentService } = await import('@/services/unified-document-service');
    vi.spyOn(UnifiedDocumentService, 'getDocumentById').mockResolvedValue(mockDocumentMetadata as any);

    // Similar test setup and assertions...
    // Should still find and display fields correctly
  });
});
```

**Step 2: Run the test**

```bash
cd localai-admin-dashboard
npx vitest src/__tests__/integration/extracted-fields-display.test.tsx
```

Expected: Test should FAIL initially (showing the bug), then PASS after fixes

**Step 3: Fix test if needed based on actual data structure**

Adjust mock data structure to match what we discovered in Task 2.

**Step 4: Verify test passes**

```bash
npx vitest src/__tests__/integration/extracted-fields-display.test.tsx
```

Expected: All tests PASS

**Step 5: Commit the test**

```bash
git add localai-admin-dashboard/src/__tests__/integration/extracted-fields-display.test.tsx
git commit -m "test: add integration test for extracted fields display"
```

---

## Task 5: Clean Up Logging and Finalize

**Files:**
- Modify: `localai-admin-dashboard/src/features/documents/components/DocumentDetailView.tsx`
- Modify: `localai-admin-dashboard/src/features/documents/components/ExtractedFieldsEditor.tsx`

**Step 1: Remove or reduce verbose logging**

Keep essential logging but remove the detailed step-by-step logs:

```typescript
// Keep this minimal logging in DocumentDetailView.tsx
console.log('📦 [DocumentDetailView] Extracted fields detected:', {
  detectionPath,
  fieldCount: Object.keys(extractedFields).length,
  fieldNames: Object.keys(extractedFields)
});

// Keep this minimal logging in ExtractedFieldsEditor.tsx
console.log('🎨 [ExtractedFieldsEditor] Processing fields:', {
  inputFieldCount: Object.keys(initialFields || {}).length,
  processedFieldCount: processedFields.length
});
```

Remove:
- Line-by-line field processing logs
- Detailed metadata structure logs
- Redundant "step X of Y" logs

**Step 2: Add JSDoc comments for helper functions**

```typescript
/**
 * Parses extracted fields data that may be stored as JSON string or object
 * @param data - Raw data from document or metadata
 * @returns Normalized object structure
 */
function parseExtractedFields(data: unknown): Record<string, unknown> {
  // ... implementation
}

/**
 * Normalizes field structure to ensure consistent {value, confidence, type} format
 * @param fields - Raw fields object
 * @returns Normalized fields with proper structure
 */
function normalizeFieldStructure(fields: Record<string, unknown>): Record<string, unknown> {
  // ... implementation
}
```

**Step 3: Run final verification**

```bash
cd localai-admin-dashboard
pnpm build
pnpm test
# Manually test in browser with real document
```

Expected:
- All tests pass
- Fields display correctly in UI
- Console has minimal, useful logging

**Step 4: Final commit**

```bash
git add localai-admin-dashboard/src/features/documents/components/DocumentDetailView.tsx
git add localai-admin-dashboard/src/features/documents/components/ExtractedFieldsEditor.tsx
git commit -m "refactor: clean up logging and add documentation"
```

---

## Task 6: Create End-User Testing Documentation

**Files:**
- Create: `docs/testing/extracted-fields-display-verification.md`

**Step 1: Write user testing guide**

```markdown
# Extracted Fields Display - End-User Testing Guide

## Prerequisites
- Services running: `python start_services.py --profile cpu`
- User account created and logged in
- At least one document uploaded and processed

## Test Scenario 1: View Extracted Fields

### Steps:
1. Navigate to http://localhost:5173
2. Log in with test credentials
3. Go to Documents page
4. Click on any processed document (status: completed)
5. Scroll down to "Extracted Fields" section

### Expected Results:
- ✅ Fields are displayed as individual labeled inputs
- ✅ Each field shows: name, value, confidence score, type badge
- ✅ Values are readable text, NOT JSON blobs like `{"value": "text"}`
- ✅ Confidence scores show as percentages (e.g., "95%")
- ✅ Field types show as badges (Text, Number, Currency, Date, etc.)

### Common Issues:
- ❌ Fields show as `{"value":"text","confidence":0.95}` → Bug not fixed
- ❌ No fields displayed → Check document processing status
- ❌ Fields show "No value" → Data extraction may have failed

## Test Scenario 2: Edit Extracted Fields

### Steps:
1. In document detail view, find "Extracted Fields" section
2. Click "Edit Fields" button
3. Modify a field value
4. Click "Save Changes"

### Expected Results:
- ✅ Edit mode enables input fields
- ✅ Can modify field values
- ✅ Save button works without errors
- ✅ Fields update after save

## Test Scenario 3: Different Document Types

Test with multiple document types to verify field detection works across different storage structures:

1. **Contract PDF**: Should extract company names, dates, amounts
2. **Invoice Image**: Should extract line items, totals, vendor info
3. **Form Document**: Should extract form field values

### Expected Results:
- ✅ All document types display fields correctly
- ✅ No JSON blob display in any case

## Reporting Issues

If fields still display as JSON blobs:
1. Open browser DevTools (F12)
2. Go to Console tab
3. Look for logs starting with "📦 [DocumentDetailView]"
4. Copy the full log output
5. Check "Detection path" - which source is being used?
6. Report: detection path + actual field structure logged
```

**Step 2: Run through the user testing guide yourself**

Actually follow the steps and verify everything works.

**Step 3: Document any remaining issues**

If any issues are found, add them to the testing guide under "Known Issues" section.

**Step 4: Commit the documentation**

```bash
git add docs/testing/extracted-fields-display-verification.md
git commit -m "docs: add end-user testing guide for extracted fields display"
```

---

## Success Criteria

- [ ] Console logs clearly show the extracted fields data structure at each step
- [ ] Data structure issues are identified and documented in analysis doc
- [ ] Extracted fields display as individual labeled inputs, not JSON blobs
- [ ] Field values, confidence scores, and types are all visible
- [ ] Integration test passes verifying correct display
- [ ] Code has minimal logging and clear documentation
- [ ] End-user testing guide created and verified

## Rollback Plan

If the fix breaks existing functionality:

```bash
# Revert the commits
git revert HEAD~3..HEAD

# Or reset to before the changes
git reset --hard [commit-before-changes]

# Restart frontend
cd localai-admin-dashboard
pnpm build
```

## Future Improvements

After this fix is complete, consider:
1. Add TypeScript interfaces for extracted field structure
2. Create a shared validator for field data format
3. Add backend endpoint to validate field structure before saving
4. Implement field schema validation in Supabase
5. Add visual regression tests for field display

---

**End of Plan**

Plan saved to: `docs/plans/2025-12-13-fix-extracted-fields-display.md`
