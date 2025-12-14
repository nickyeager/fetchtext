# Extracted Fields Data Flow Analysis

**Date:** 2025-12-13
**Analysis Method:** Code review + architecture analysis
**Issue:** Extracted fields displaying as JSON blobs instead of formatted field values

## Backend Response Structure

From `smart_field_extractor.py` (`_format_extracted_fields` method, lines 386-399), the backend returns:

```python
{
  "extraction_method": "llm_intelligent",
  "extracted_values": {
    "field_name": {
      "value": "actual extracted value",
      "confidence": 0.95,
      "source_text": "AI extracted",
      "location": "llm_intelligent"
    }
  },
  "total_fields_requested": N,
  "fields_extracted": M,
  "confidence_threshold": 0.6,
  "success_rate": 0.85,
  "processing_time_ms": 1500
}
```

**Key Point:** `extracted_values[field_name]` is an **object** with properties `{value, confidence, source_text, location}`, NOT a primitive value.

## Frontend Processing Flow

### 1. Document Upload & Processing
From `document-processor-enhanced.ts` lines 1975-2000:

```typescript
// Backend returns nested structure
const extractionData = response.extracted_data?.extracted_values
  || response.extraction_results
  || response.extracted_fields;

if (extractionData) {
  Object.entries(extractionData).forEach(([fieldName, fieldData]: [string, any]) => {
    extractedFields[fieldName] = {
      value: fieldData.value,        // ✅ CORRECT: Accessing .value property
      confidence: fieldData.confidence || 0.8,
      sourceText: fieldData.source_text || fieldData.sourceText,
      location: fieldData.location || { page: 1, position: 0 }
    };
  });
}
```

**Status:** ✅ This part is CORRECT - it properly extracts the `.value` property.

### 2. Supabase Storage

**Expected Database Schema:**
- `documents.extracted_fields` (JSONB column) should contain the flattened structure
- OR `documents.metadata` (JSONB) should contain `extracted_data.extracted_values`

**Current Storage Pattern (needs verification):**
The data is likely stored in `metadata` as a nested object, possibly:
```json
{
  "metadata": {
    "extracted_data": {
      "extracted_values": {
        "field_name": {
          "value": "...",
          "confidence": 0.95
        }
      }
    }
  }
}
```

### 3. Frontend Field Detection
From `DocumentDetailView.tsx` lines 1771-1861 (after Task 1 logging additions):

**Detection Paths Checked (in order):**
1. `document.extracted_fields`
2. `metadata.extracted_fields`
3. `metadata.extraction_result.extracted_values`
4. `metadata.extracted_data.extracted_values` ✅
5. `metadata.fields`

**Identified Issue:** The detection logic finds the data, but it's still in the **nested object format**:
```typescript
// What the detection finds:
extractedFields = {
  "field_name": {
    "value": "actual value",
    "confidence": 0.95,
    "source_text": "...",
    "location": "..."
  }
}
```

### 4. ExtractedFieldsEditor Processing
From `ExtractedFieldsEditor.tsx` lines 67-156 (after Task 1 logging additions):

**The Code CORRECTLY handles the nested structure:**
```typescript
if (typeof value === 'object' && value !== null) {
  const valAny = value as Record<string, unknown>;
  if ('value' in valAny) {
    const rawVal = valAny.value;
    displayValue = rawVal == null ? '' : typeof rawVal === 'string' ? rawVal : JSON.stringify(rawVal);
    // ✅ This extracts the .value property correctly
  } else {
    displayValue = JSON.stringify(valAny);  // ⚠️ Fallback: stringifies entire object
  }
}
```

**Status:** ✅ The code logic is CORRECT!

## Root Cause Analysis

### The Mystery: If the code is correct, why are fields still showing as JSON blobs?

**Hypothesis 1: Double-Nesting Issue**
The data might be getting **double-stringified** somewhere in the pipeline:
- Backend returns correct structure
- Frontend saves it to Supabase
- But Supabase might be JSON-stringifying the already-JSON data
- When retrieved, it becomes a **string** instead of an object

**Evidence:** In `ExtractedFieldsEditor.tsx`, if `value` is a string containing JSON, it won't match the `typeof value === 'object'` check and will be treated as a primitive string.

**Hypothesis 2: Wrong Detection Path**
The field detection might be using the **wrong path** that contains stringified data instead of the correct nested object.

For example:
- `document.extracted_fields` might contain `{"field_name": "{\"value\":\"text\",...}"}`  (stringified)
- `metadata.extracted_data.extracted_values` contains `{"field_name": {"value":"text",...}}` (correct)

But if detection stops at path #1, it never reaches the correct path #4.

**Hypothesis 3: Type Coercion Issue**
TypeScript type assertions might be causing the object to be treated as a string in some cases.

## Recommended Fixes

### Fix 1: Add JSON Parse Helper (Handle Double-Stringification)

```typescript
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

**Usage in detection logic:**
```typescript
if (document.extracted_fields) {
  const parsed = parseExtractedFields(document.extracted_fields);
  if (Object.keys(parsed).length > 0) {
    extractedFields = parsed;
    detectionPath = 'document.extracted_fields';
  }
}
```

### Fix 2: Prioritize Correct Data Source

Change the detection order to try the most reliable paths first:

```typescript
const sources = [
  {
    name: 'metadata.extracted_data.extracted_values',
    getter: () => (document.metadata as Record<string, unknown>)?.extracted_data?.extracted_values
  },
  {
    name: 'metadata.extraction_result.extracted_values',
    getter: () => (document.metadata as Record<string, unknown>)?.extraction_result?.extracted_values
  },
  {
    name: 'document.extracted_fields',
    getter: () => document.extracted_fields
  },
  // ... other sources
];

for (const source of sources) {
  const data = source.getter();
  const parsed = parseExtractedFields(data);
  if (Object.keys(parsed).length > 0) {
    extractedFields = parsed;
    detectionPath = source.name;
    break;
  }
}
```

### Fix 3: Add Field Value Normalization

In `ExtractedFieldsEditor.tsx`, add better handling for stringified values:

```typescript
if (typeof value === 'object' && value !== null) {
  // ... existing object handling
} else if (typeof value === 'string') {
  // Try to parse if it looks like JSON
  if (value.startsWith('{') || value.startsWith('[')) {
    try {
      const parsed = JSON.parse(value);
      if (parsed && typeof parsed === 'object' && 'value' in parsed) {
        displayValue = parsed.value;
        confidence = parsed.confidence || confidence;
        // ... extract other properties
        console.log('     ✅ Parsed JSON string to extract .value');
      } else {
        displayValue = value;  // Use the JSON string as-is
      }
    } catch (e) {
      displayValue = value;  // Not valid JSON, use as-is
    }
  } else {
    displayValue = value;  // Regular string
  }
}
```

## Next Steps

1. ✅ **Task 1 Complete**: Comprehensive logging added
2. **Task 2 In Progress**: This analysis document
3. **Task 3**: Implement fixes based on what the logs reveal:
   - Add `parseExtractedFields` helper function
   - Adjust detection path priority if needed
   - Add JSON string parsing in `ExtractedFieldsEditor`
4. **Task 4**: Write integration tests to verify the fix
5. **Task 5**: Clean up debug logging
6. **Task 6**: Document the working solution for users

## Testing Instructions

To verify which hypothesis is correct, check the browser console logs:

1. Navigate to a processed document
2. Look for `📊 [DocumentDetailView] Full Document Data Analysis`
3. Check the `metadata.extracted_data` structure
4. Look for `🔍 [Field Detection]` to see which path was used
5. Check `🎨 [ExtractedFieldsEditor]` to see what data type each field receives

**Key Questions to Answer:**
- Is `metadata.extracted_data.extracted_values` an object or a string?
- Are the field values objects `{value: "..."}` or already strings?
- Which detection path is being used?
- At what point does the data become a JSON string instead of an object?

---

**Conclusion:** The code logic appears correct, but there may be a data serialization issue in the Supabase storage/retrieval layer causing object-to-string conversion. The comprehensive logging will reveal the exact point where this conversion occurs.
