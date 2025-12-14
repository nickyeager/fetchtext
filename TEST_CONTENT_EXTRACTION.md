# Document Content Extraction Fix - Test Instructions

## Problem Fixed
Documents uploaded via `/documents/upload` were showing placeholder text instead of actual extracted content:
```
Sample document content for test.pdf...
```

## Root Cause
The `handleFileSelect` function in `DocumentUploadPage.tsx` was only calling:
1. `evaluateDocumentType()` - which analyzes document TYPE only
2. Immediately redirecting to document page - without extracting content

The `processDocumentWithDocling()` method that extracts content was never being called during the upload flow.

## Solution Implemented
Modified `DocumentUploadPage.tsx` (lines 275-301) to add content extraction step:

```typescript
// Step 3: Evaluate document type
const evaluationResult = await documentProcessor.evaluateDocumentType(file);

// Step 4: Extract document content using Docling ✅ NEW
const processedContent = await documentProcessor.processDocumentWithDocling(file);

// Step 5: Store both evaluation and extracted content ✅ UPDATED
await documentManager.finalizeDocument(documentRecord.id, {
  content_text: processedContent.content,  // Real content, not placeholder
  metadata: {
    document_type: evaluationResult.type_evaluation.primary_type,
    title: processedContent.metadata?.title,
    author: processedContent.metadata?.author,
    page_count: processedContent.metadata?.page_count,
  }
});
```

## Manual Testing Instructions

### Prerequisites
1. Start local services:
   ```bash
   python start_services.py --profile cpu
   ```

2. Build and run frontend:
   ```bash
   cd localai-admin-dashboard
   pnpm build
   # Then either run in Docker or:
   pnpm dev  # For local debugging with breakpoints
   ```

### Test Scenario 1: Upload Invoice PDF
1. Navigate to http://localhost:5173/documents/upload
2. Upload a test invoice (e.g., `test-invoice.pdf`)
3. Wait for processing to complete (status: analyzing → processing → uploaded)
4. When redirected to `/documents/{id}`, verify:
   - ✅ Document content shows ACTUAL extracted text from PDF
   - ❌ NOT placeholder text like "Sample document content for test-invoice.pdf"
5. Check browser console logs:
   - Should see: "📄 Extracting document content..."
   - Should see: "✅ Content extracted: [first 100 chars]..."

### Test Scenario 2: Upload from Template Gallery
1. Navigate to http://localhost:5173/documents/gallery
2. Click "Use Template" on any smart template
3. Upload a document matching that template type
4. Verify content is extracted before redirect

### Test Scenario 3: Upload Unsupported Format
1. Upload a `.txt` or `.docx` file
2. Verify graceful error handling if Docling can't process it
3. Check error message is displayed to user

### Expected Backend API Calls (in order)
1. `POST /api/enhanced-documents/evaluate-document-type` - Analyze type
2. `POST /api/enhanced-documents/process-with-ai` - Extract content ✅ NEW
3. Supabase: Update document record with content_text field

### Database Verification
Check that `documents` table has populated `content_text`:
```sql
SELECT
  id,
  filename,
  status,
  LENGTH(content_text) as content_length,
  LEFT(content_text, 100) as content_preview
FROM documents
WHERE upload_source = 'smart_upload'
ORDER BY created_at DESC
LIMIT 5;
```

**Expected**: `content_length` should be > 100, `content_preview` should show actual document text

## Integration Test
Run automated test to verify fix:
```bash
cd localai-admin-dashboard
pnpm test src/__tests__/integration/document-content-extraction.test.tsx
```

**Test assertions**:
- ✅ `processDocumentWithDocling()` is called during upload
- ✅ `finalizeDocument()` receives real content, not placeholder
- ✅ Content contains actual document text (e.g., "INVOICE #12345")
- ❌ Content does NOT contain "Sample document content for"

## Performance Impact
Content extraction adds ~2-10 seconds to upload flow (depending on AI provider):
- **Azure OpenAI**: 2-5 seconds
- **Ollama (local)**: 5-10 seconds

This is acceptable because:
1. User sees "processing" status with progress indicator
2. Content is immediately available when viewing document (no second API call needed)
3. Aligns with user expectation that upload = fully processed document

## Rollback Plan
If this causes issues, revert changes to `DocumentUploadPage.tsx` lines 271-304:
```bash
git diff HEAD localai-admin-dashboard/src/features/documents/components/DocumentUploadPage.tsx
git checkout HEAD -- localai-admin-dashboard/src/features/documents/components/DocumentUploadPage.tsx
```

## Related Files
- **Fixed**: `localai-admin-dashboard/src/features/documents/components/DocumentUploadPage.tsx:275-301`
- **Service**: `localai-admin-dashboard/src/lib/document-processor-enhanced.ts:555-609`
- **Test**: `localai-admin-dashboard/src/__tests__/integration/document-content-extraction.test.tsx`

## Status
✅ **FIXED** - Content extraction now runs automatically during upload
🔄 **TESTING REQUIRED** - Manual verification needed with real documents
