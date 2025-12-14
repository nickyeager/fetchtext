# Debug Guide: Document Content Not Displaying

## Current Status

### Backend Verification ✅
The backend is working correctly:
- **API Endpoint**: `/documents/upload` processes PDFs successfully
- **Test File**: "Stucco Contract V1.pdf"
- **Processing Time**: ~3-5 seconds
- **Content Extracted**: 2241 characters
- **Database Storage**: Content confirmed in `documents.content_text` column

### Database Verification ✅
```sql
SELECT id, name, processing_status, LENGTH(content_text) as content_len,
       LEFT(content_text, 100) as preview
FROM documents
WHERE name LIKE '%Stucco%'
ORDER BY created_at DESC LIMIT 3;
```

**Result**: All 3 recent Stucco uploads have content_text = 2241 chars with correct preview text.

## Possible Issue: Frontend Display

Since the backend and database are working, the issue is likely in how the frontend displays the content on the document detail page.

### Debugging Steps

1. **Open Browser DevTools** (F12 or Cmd+Option+I)

2. **Upload Stucco PDF** at http://localhost:5173/documents/upload

3. **Check Console Logs** - You should see:
   ```
   📄 Extracting document content...
   ✅ Content extracted: ## PROPOSAL AND CONTRACT...
   📄 DocumentDetailView - Building content display
   📄 DocumentDetailView - Content resolution
   ```

4. **Check Console Output** for these key values:
   - `contentTextLength`: Should be 2241 (not 0 or undefined)
   - `contentTextPreview`: Should show "## PROPOSAL AND CONTRACT..."
   - `originalTextLength`: Should be 2241
   - `processedTextLength`: Should be 2241

### What the Logs Tell You

#### If `contentTextLength` is undefined or 0:
**Problem**: Document record not loading `content_text` from database
**Fix**: Check network tab for `/rest/v1/documents?id=...` request and verify response includes `content_text` field

#### If `contentTextLength` is 2241 but display is empty:
**Problem**: Frontend rendering issue in content tabs
**Fix**: Check which tab you're viewing - content might be in "Content" tab vs "Overview" tab

#### If logs show content but UI shows placeholder:
**Problem**: Component state not updating after content loads
**Fix**: Hard refresh (Cmd+Shift+R) or clear React Query cache

## Testing Checklist

- [ ] Backend API returns content: `curl -X GET http://localhost:8090/documents/result/{job_id}`
- [ ] Database has content: SQL query shows 2241 chars
- [ ] Browser console shows content extraction logs
- [ ] Network tab shows Supabase request returns content_text
- [ ] Console logs show `contentTextLength: 2241`
- [ ] Document detail page "Content" tab displays text

## Expected Flow

1. **Upload** → User uploads Stucco Contract V1.pdf at `/documents/upload`
2. **Analyzing** → Status updates to "analyzing", calls `evaluateDocumentType()`
3. **Processing** → Status updates to "processing", calls `processDocumentWithDocling()`
4. **Content Extracted** → Console logs show: `✅ Content extracted: ## PROPOSAL AND CONTRACT...`
5. **Finalize** → `finalizeDocument()` saves content to database
6. **Redirect** → Navigate to `/documents/{id}`
7. **Load Document** → `getDocumentById()` fetches from database with content_text
8. **Display** → Component renders content in tabs

## Common Issues

### Issue 1: Content extraction not running
**Symptom**: Console logs show "📄 Extracting document content..." never appears
**Cause**: Frontend code not updated after rebuild
**Fix**:
```bash
cd localai-admin-dashboard
pnpm build
# Restart frontend
```

### Issue 2: Backend timeout
**Symptom**: Console shows "Document evaluation failed" or timeout error
**Cause**: Backend processing taking too long (>30s)
**Fix**: Check which AI provider is active - Ollama on CPU can be very slow
```bash
curl http://localhost:8090/models/status
# If using Ollama on CPU, switch to Azure OpenAI for faster processing
```

### Issue 3: Database permissions
**Symptom**: Network error when saving document
**Cause**: RLS policies blocking insert/update
**Fix**: Verify you're logged in as authenticated user with proper JWT token

### Issue 4: Content not in response
**Symptom**: Network response doesn't include content_text field
**Cause**: Supabase query not selecting all columns
**Fix**: Check `getDocumentById()` uses `.select('*')` not `.select('id, name, ...')`

## Quick Test Command

Test the complete flow programmatically:
```bash
# 1. Upload PDF
JOB_ID=$(curl -s -X POST http://localhost:8090/documents/upload \
  -F "file=@./Stucco Contract V1.pdf" \
  -F "extract_text=true" | jq -r '.job_id')

# 2. Wait for processing
sleep 5

# 3. Get result
curl -s http://localhost:8090/documents/result/$JOB_ID | \
  jq '{status: .status, content_length: (.content.text | length), preview: (.content.text[:100])}'
```

Expected output:
```json
{
  "status": "completed",
  "content_length": 2241,
  "preview": "## PROPOSAL AND CONTRACT\n\nEmail: yeag123@gmail.com\n\n## CLIENT INFORMATION\n\nSubmitted To: Nicholas Ye"
}
```

## Files to Check

If content still doesn't display after all checks:

1. **Upload Component**: [DocumentUploadPage.tsx:275-304](localai-admin-dashboard/src/features/documents/components/DocumentUploadPage.tsx#L275-L304)
   - Verify `processDocumentWithDocling()` is called
   - Verify `finalizeDocument()` receives content

2. **Document Service**: [unified-document-service.ts:1047-1070](localai-admin-dashboard/src/services/unified-document-service.ts#L1047-L1070)
   - Verify `getDocumentById()` selects all columns
   - Check query filters (uploaded_by)

3. **Detail View**: [DocumentDetailView.tsx:206-238](localai-admin-dashboard/src/features/documents/components/DocumentDetailView.tsx#L206-L238)
   - Check console logs for content resolution
   - Verify `document.content_text` is populated

4. **Backend Processor**: [document-processor-enhanced.ts:576-610](localai-admin-dashboard/src/lib/document-processor-enhanced.ts#L576-L610)
   - Verify endpoint is `/documents/upload`
   - Check response transformation

## Next Steps

After reviewing console logs and determining where the issue occurs, report back with:
1. The console log output from upload
2. The console log output from document detail view
3. Which step in the flow is failing
4. Any error messages in console or network tab
