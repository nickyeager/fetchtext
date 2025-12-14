# Manual Frontend Testing Checklist

## Auto-Template Generation with Extraction Feature

**Date**: December 11, 2025
**Feature**: Automatic template generation and field extraction for documents with no suitable template match

---

## Prerequisites

✅ **Backend Services Running**
```bash
# Verify all services are running
python start_services.py --profile cpu

# Check backend health
curl http://localhost:8090/health
```

✅ **Frontend Built**
```bash
cd localai-admin-dashboard
pnpm build
```

✅ **Test Document Available**
- File: `Stucco Contract V1.pdf`
- Location: Project root directory

---

## Testing Steps

### 1. Open Application

- [ ] Open browser to: http://localhost:5173
- [ ] Verify you're logged in
  - If not, create account/login
  - Credentials stored in browser localStorage

### 2. Navigate to Smart Upload

- [ ] Click "Smart Upload" in sidebar navigation
- [ ] Verify Smart Upload page loads successfully
- [ ] Page should show drag-drop zone for file upload

### 3. Upload Test Document

- [ ] Drag and drop `Stucco Contract V1.pdf` OR click to browse
- [ ] Verify file appears in upload zone
- [ ] Click "Process Document" (or equivalent button)

### 4. Monitor Browser Console Logs

**CRITICAL:** Open browser DevTools (F12) → Console tab before uploading

Expected console log sequence:

```
📤 Uploading document: Stucco Contract V1.pdf
🎯 Calling /decide-template endpoint with 2-way validation...
✅ Template decision received: { action: 'generate_new', ... }
✨ No suitable template found - generating new template with AI...
  template_name: Contract Template
  variables_count: 2
📝 Saving generated template to database...
  name: Contract Template
  category: general
  variable_names: document_date, reference_number
✅ Save Generated Template - Authenticated user: [user_id]
✅ Template saved successfully:
  template_id: [number]
  name: Contract Template
🔍 Extracting fields with generated template...
✅ Auto-extraction with generated template completed:
  fields_extracted: 2
  template_id: [number]
  template_name: Contract Template
```

**If you see errors:**
- [ ] `⚠️ Failed to save/apply generated template:` → Check error details in console
- [ ] Authentication errors → Verify user is logged in
- [ ] Database errors → Check Supabase is running and accessible

### 5. Verify Document Detail Page

After upload completes, you should be redirected to document detail page:

- [ ] Page URL changes to `/documents/[document_id]`
- [ ] Document metadata section shows:
  - **Name**: Stucco Contract V1.pdf
  - **Status**: `completed` (GREEN badge)
  - **Document Type**: contract (or similar)
  - **Template Used**: Contract Template

- [ ] **Extracted Fields** section displays:
  - [ ] `document_date` field with value (if found in document)
  - [ ] `reference_number` field with value (if found in document)
  - Each field should show:
    - Field name
    - Extracted value
    - Confidence score (if available)

- [ ] **Content Preview** section shows actual document text (not PDF metadata)

### 6. Verify Template in Database

**Option A: Supabase Studio UI**
```bash
# Open Supabase Studio (if available)
# Navigate to: Table Editor → smart_templates
# Find: Contract Template (most recent)
```

**Option B: Direct Database Query**
```sql
SELECT
  id,
  name,
  category,
  smart_variables,
  created_by,
  created_at
FROM smart_templates
WHERE name LIKE '%Contract%'
ORDER BY created_at DESC
LIMIT 1;
```

**Expected Results:**
- [ ] Template exists in `smart_templates` table
- [ ] `smart_variables` column contains JSON array with 2 items:
  ```json
  [
    {
      "id": "document_date",
      "name": "document_date",
      "type": "date",
      "description": "Document date",
      ...
    },
    {
      "id": "reference_number",
      "name": "reference_number",
      "type": "text",
      "description": "Reference number",
      ...
    }
  ]
  ```
- [ ] `created_by` matches your user ID
- [ ] `is_public` = false (private by default)
- [ ] `template_type` = 'smart'

### 7. Verify Document in Database

```sql
SELECT
  id,
  name,
  status,
  extracted_fields,
  metadata
FROM documents
WHERE name = 'Stucco Contract V1.pdf'
ORDER BY created_at DESC
LIMIT 1;
```

**Expected Results:**
- [ ] Document exists in `documents` table
- [ ] `status` = 'completed'
- [ ] `extracted_fields` contains JSON object with field values
- [ ] `metadata` → `template_decision` → `action` = 'generate_new' (or similar)
- [ ] `metadata` → `template_decision` → `auto_applied` = true

---

## Edge Cases & Error Scenarios

### Test 1: Document with Existing Template Match

- [ ] Upload a document that SHOULD match an existing template
- [ ] Verify system uses existing template (action: 'use_existing')
- [ ] Verify NO new template is created

### Test 2: Authentication Error Handling

- [ ] Log out of application
- [ ] Try to upload document
- [ ] Verify graceful error handling (not server crash)
- [ ] Verify user sees authentication error message

### Test 3: Backend Generation Timeout

- [ ] Upload very large/complex PDF (>10MB)
- [ ] If generation times out:
  - [ ] Verify document still saves
  - [ ] Verify status is 'uploaded' (not 'completed')
  - [ ] Verify user can manually select template

### Test 4: Extraction Failure After Template Save

- [ ] Monitor console for extraction errors
- [ ] If extraction fails after template save:
  - [ ] Template should still exist in database
  - [ ] Document should have status 'uploaded' (not 'completed')
  - [ ] User can manually trigger extraction later

---

## Success Criteria

✅ **All of the following must be true for feature to be considered complete:**

1. [ ] Document uploads successfully
2. [ ] Backend generates template with Azure OpenAI
3. [ ] Frontend saves template to `smart_templates` table
4. [ ] Template has `smart_variables` array populated
5. [ ] Frontend extracts fields using saved template
6. [ ] Extracted fields appear in document detail view
7. [ ] Document status shows 'completed'
8. [ ] No JavaScript errors in browser console
9. [ ] No Python errors in backend logs
10. [ ] Template is private (belongs to user)
11. [ ] Template can be edited/reused for future documents

---

## Rollback Plan

If testing reveals critical issues:

**Backend Rollback:**
```bash
# Revert backend changes (already in container)
docker compose -p localai restart document-processor
```

**Frontend Rollback:**
```bash
cd localai-admin-dashboard
git checkout HEAD -- src/features/documents/components/DocumentUploadPage.tsx
git checkout HEAD -- src/lib/document-processor-enhanced.ts
pnpm build
```

**Database Cleanup:**
```sql
-- Remove test templates
DELETE FROM smart_templates WHERE name LIKE '%Contract Template%' AND created_at > NOW() - INTERVAL '1 hour';

-- Remove test documents
DELETE FROM documents WHERE name = 'Stucco Contract V1.pdf' AND created_at > NOW() - INTERVAL '1 hour';
```

---

## Notes & Observations

**Write notes here during testing:**

- Timestamp: ____________________
- Tester: ____________________
- Browser: ____________________
- Issues Found:



- Performance Notes:



- User Experience Notes:



---

## Sign-Off

- [ ] All tests passed successfully
- [ ] No critical bugs found
- [ ] Ready for production deployment

**Tested By:** ____________________
**Date:** ____________________
**Signature:** ____________________
