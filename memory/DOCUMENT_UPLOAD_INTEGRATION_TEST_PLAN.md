# Document Upload Integration Test Plan

## Overview
This plan tests the complete document upload and processing flow from file upload to extracted data display, with detailed logging at each step.

## Step-by-Step Flow to Test

### Phase 1: Document Upload (Gallery)
**File**: `src/routes/_authenticated/documents/gallery.tsx`

**Steps to verify:**
1. User navigates to http://localhost:5173/documents/gallery
2. User drags/drops or selects file
3. File validation occurs
4. Upload starts → Document record created in database
5. File uploaded to storage
6. Status set to 'uploaded'

**Logging to add:**
- File selection event
- File validation results
- Database record creation
- Storage upload progress
- Status transitions

### Phase 2: Document Analysis 
**File**: `src/services/unified-document-service.ts` → `triggerAIAnalysis`

**Steps to verify:**
1. Status changes from 'uploaded' to 'analyzing'
2. Document sent to backend for AI analysis
3. Backend returns document type and template suggestions
4. Status changes to 'processing'

**Logging to add:**
- AI analysis start
- Backend API calls
- Response data structure
- Template suggestions received

### Phase 3: Template Selection
**Component**: Template selector UI

**Steps to verify:**
1. User sees template suggestions
2. User selects template OR generates new one
3. Template applied to document
4. Extraction process begins

**Logging to add:**
- Template suggestions display
- User selection
- Template application

### Phase 4: Data Extraction
**Backend**: Document processor service

**Steps to verify:**
1. Document processed with selected template
2. Text extracted from document
3. Fields extracted using template patterns
4. Results returned to frontend
5. Status changes to 'completed'

**Logging to add:**
- Extraction process start
- Text extraction results
- Field extraction results
- Final status update

### Phase 5: Display Results
**File**: `src/features/documents/components/DocumentDetailView.tsx`

**Steps to verify:**
1. Document detail page loads
2. Extracted text displayed
3. Template fields displayed
4. Generated content shown
5. Status shows 'completed'

**Logging to add:**
- Document data received
- Display components rendering
- Final state verification

## Database Schema Reference

```sql
-- documents table structure (from migration 005)
CREATE TABLE documents (
  id SERIAL PRIMARY KEY,
  uuid UUID DEFAULT gen_random_uuid() UNIQUE,
  name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_size INTEGER,
  content_text TEXT,
  metadata JSONB DEFAULT '{}',
  processing_status TEXT NOT NULL DEFAULT 'uploaded' 
    CHECK (processing_status IN ('uploaded', 'analyzing', 'processing', 'completed', 'failed')),
  uploaded_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

**Key Points:**
- Only `processing_status` field exists (NO `status` field)
- Valid statuses: 'uploaded', 'analyzing', 'processing', 'completed', 'failed'
- Extracted data stored in `metadata` JSONB field
- Content stored in `content_text` field

## Test Scenarios

### Test 1: Simple Invoice Upload
**File**: Create test-invoice.txt
**Expected Flow**: 
1. Upload → 'uploaded' status
2. Analysis → 'analyzing' status + AI suggestions
3. Template selection → Invoice template
4. Processing → 'processing' status
5. Completion → 'completed' + extracted fields (invoice_number, amount, etc.)

### Test 2: Template Generation
**File**: Create unique-document.txt
**Expected Flow**:
1. Upload → 'uploaded' status
2. Analysis → No matching templates
3. Generate new template → User defines fields
4. Processing → 'processing' status 
5. Completion → 'completed' + custom extracted fields

### Test 3: Error Handling
**File**: Create corrupted.txt
**Expected Flow**:
1. Upload → 'uploaded' status
2. Analysis → Error occurs
3. Status → 'failed'
4. User sees error message
5. Retry option available

## Integration Test Implementation

### Test Structure
```
tests/integration/document-flow/
├── 01-upload.test.ts          # Test file upload to gallery
├── 02-analysis.test.ts        # Test AI analysis phase  
├── 03-template-selection.test.ts # Test template selection
├── 04-extraction.test.ts      # Test data extraction
├── 05-display.test.ts         # Test result display
└── 06-end-to-end.test.ts      # Complete flow test
```

### Logging Strategy
1. **Frontend Logging**: Console.log with prefixes
   - 🔵 UPLOAD: File upload events
   - 🟡 ANALYSIS: AI analysis events  
   - 🟢 TEMPLATE: Template selection events
   - 🟣 EXTRACT: Data extraction events
   - 🔴 ERROR: Error events

2. **Backend Logging**: API response logging
   - Track all API calls and responses
   - Log status transitions
   - Log data transformations

3. **Database Logging**: Query logging
   - Log all database updates
   - Track status changes
   - Monitor metadata updates

## Success Criteria

### For Each Phase:
1. ✅ Status transitions correctly
2. ✅ Data flows between components
3. ✅ UI updates in real-time
4. ✅ No errors in console
5. ✅ Database records updated
6. ✅ User sees expected results

### Overall Success:
1. ✅ File uploads successfully
2. ✅ Document analyzed by AI
3. ✅ Template selected/generated
4. ✅ Data extracted correctly
5. ✅ Results displayed properly
6. ✅ No "stuck" states
7. ✅ Process completes end-to-end

## Implementation Priority

### Phase 1 (Immediate): Fix Current Issues
1. Remove incorrect `status` field references
2. Fix database update errors
3. Test basic upload functionality

### Phase 2 (Today): Add Comprehensive Logging  
1. Add logging to each component
2. Track data flow
3. Monitor status transitions

### Phase 3 (Tomorrow): Full Integration Tests
1. Write complete test suite
2. Test all scenarios
3. Verify with real data

### Phase 4 (This Week): Polish & Documentation
1. Fix any discovered issues
2. Document the complete flow
3. Create troubleshooting guide

## Next Actions

1. **Immediate**: Fix the database schema mismatch
2. **Add logging**: Instrument each step with detailed logs
3. **Create tests**: Write integration tests for each phase
4. **Run tests**: Execute against running services
5. **Verify results**: Ensure complete flow works end-to-end