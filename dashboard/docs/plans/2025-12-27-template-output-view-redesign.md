# Template Output View Redesign

**Date:** 2025-12-27
**Status:** Complete

## Summary

Enhanced the document output view with two major features:
1. Fixed variable tag display bug with fuzzy key matching
2. Added real-time variable extraction when typing `{{variable_name}}`

## Changes Implemented

### 1. Variable Tag Bug Fix

**Problem:** Template variables `{{name}}` don't match extracted field keys due to formatting differences (spaces, underscores, case)

**Solution:** Fuzzy key matching that normalizes both sides:
- `invoice_number` → `invoicenumber`
- `invoice number` → `invoicenumber`
- `invoiceNumber` → `invoicenumber`

### 2. Real-Time Variable Extraction

**Feature:** When editing a template and typing `{{new_variable}}`, the system:
1. Detects new variables on `}}` completion (500ms debounce)
2. Shows loading indicator on the variable badge
3. Calls backend AI to extract the value from the document
4. Updates the UI with the extracted value and confidence

### 3. Save Template Dialog

**Feature:** When template changes are made, users can:
- **Modify Existing:** Update the current template with new variables
- **Create New:** Save as a new template with a custom name

## Files Modified

### [TemplateOutputView.tsx](src/features/documents/components/TemplateOutputView.tsx)
- Added `normalizeKey()` and `findMatchingField()` for fuzzy matching
- Added `extractSingleVariable()` for real-time extraction
- Added `handleContentChange()` with debounced variable detection
- Added editable mode with Textarea
- Added loading states for extracting variables
- New props: `documentText`, `editable`, `onTemplateChange`, `onFieldsChange`, `onSaveTemplate`

### [SaveTemplateDialog.tsx](src/features/documents/components/SaveTemplateDialog.tsx) (NEW)
- Dialog for choosing between "Modify Existing" and "Create New"
- Radio group selection with descriptions
- Input field for new template name
- Loading state during save

### [DualDocumentView.tsx](src/features/documents/components/DualDocumentView.tsx)
- Added props passthrough: `documentText`, `editable`, `onTemplateChange`, `onFieldsChange`, `onSaveTemplate`

### [DocumentDetailView.tsx](src/features/documents/components/DocumentDetailView.tsx)
- Added `documentText={documentContent.original.text}` prop to DualDocumentView

### [document-processor-enhanced.ts](src/lib/document-processor-enhanced.ts)
- Changed `extractWithTemplateFast` from `private` to `public`

## Architecture

```
User types {{variable}} in editable template
         ↓
handleContentChange() (500ms debounce)
         ↓
Detect new variables via regex
         ↓
extractSingleVariable()
         ↓
DocumentProcessorEnhanced.extractWithTemplateFast()
         ↓
POST /api/enhanced-documents/extract-with-text
         ↓
Update localExtractedFields state
         ↓
UI shows extracted value in badge
```

## Testing

Build and lint pass successfully. To test the feature:

1. Navigate to a document detail page with a matched template
2. Enable editing mode (if available)
3. Type `{{new_field_name}}` in the template content
4. Observe the loading spinner on the new variable badge
5. After extraction completes, see the extracted value
6. Click "Save Template" to open the save dialog
