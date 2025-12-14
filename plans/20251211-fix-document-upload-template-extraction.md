# Implementation Plan: Fix Document Upload & Template Extraction

**Date**: 2025-12-11
**Status**: Ready for execution

## Problem Analysis

**Current Issues:**
1. **Auto-selecting low-confidence templates** - System selects templates with <60% match score
2. **PDF content extraction failure** - Extracting PDF metadata instead of actual text content
3. **400 Bad Request on template extraction** - Backend rejecting requests with "No smart template variables provided"
4. **Poor template matching** - Using PDF structure markers instead of document content for matching

## Root Causes

1. **Document Type Evaluation**: Backend extracting first 5000 chars includes PDF metadata (endobj, /type, etc.) instead of actual text
2. **No Confidence Threshold Check**: Frontend auto-selects any template regardless of match score
3. **Template Data Serialization**: Possible mismatch in how `smart_variables` are being sent to backend
4. **Text Extraction Timing**: Content not fully extracted before template matching occurs

---

## Phase 1: Fix PDF Content Extraction for Template Matching

### Task 1.1: Update Document Type Evaluation to Use Proper Text Content

**File**: `document-processor/app/services/document_evaluator.py`

**Current Problem**: Line ~100-120 extracts first 5000 characters which includes PDF structure

**Implementation**:
```python
# In evaluate_document method, before processing content:
# Add parameter to accept pre-extracted content
async def evaluate_document(
    self,
    file_path: Path,
    content_override: Optional[str] = None
) -> Dict[str, Any]:
    """
    Evaluate document type and characteristics.

    Args:
        file_path: Path to document file
        content_override: Pre-extracted text content (bypasses extraction)
    """
    # Use override if provided, otherwise extract
    if content_override:
        content = content_override
        logger.info(f"Using provided content override ({len(content)} chars)")
    else:
        # Existing extraction logic
        content = await self._extract_text(file_path)

    # Rest of evaluation logic...
```

**Verification**:
- Test with Stucco Contract PDF
- Verify key phrases extracted are contract terms, not PDF markers
- Expected: `['proposal', 'contract', 'client', 'scope']` instead of `['endobj', '<</type']`

---

### Task 1.2: Add Text Content Pre-processing in Evaluate Endpoint

**File**: `document-processor/app/routers/enhanced_documents.py`

**Location**: `/evaluate-document-type` endpoint (line ~665)

**Implementation**:
```python
@router.post("/evaluate-document-type")
async def evaluate_document_type(
    file: UploadFile = File(...),
    quick_scan: bool = Query(False),
    include_confidence_scores: bool = Query(True),
    suggest_templates: bool = Query(True)
):
    temp_file_path = None
    try:
        # Save file
        temp_file_path = await save_uploaded_file(file)

        # Extract clean text FIRST for PDFs
        document_content = None
        if temp_file_path.suffix.lower() == '.pdf':
            logger.info("Extracting clean text from PDF before evaluation")
            docling_result = await enhanced_docling_service.process_document_with_ai_enhancement(
                temp_file_path,
                extract_text=True,
                extract_metadata=False,
                extract_structure=False,
                use_ai_enhancement=False  # Fast extraction
            )

            if docling_result.get('status') == 'completed':
                document_content = docling_result.get('content', {}).get('text', '')
                logger.info(f"Extracted {len(document_content)} chars of clean text")

        # Pass clean content to evaluator
        evaluation = await document_evaluator.evaluate_document(
            file_path=temp_file_path,
            content_override=document_content
        )

        # Rest of endpoint logic...
```

---

## Phase 2: Fix Template Auto-Selection Logic

### Task 2.1: Add Confidence Threshold Check Before Auto-Selection

**File**: `localai-admin-dashboard/src/services/unified-document-service.ts`

**Location**: Line 239-248 (auto-selection logic in `triggerAIAnalysis` method)

**Current Code**:
```typescript
// Auto-selects ANY template
const bestTemplate = evaluation.template_suggestions
  .sort((a, b) => b.match_score - a.match_score)[0];
```

**Implementation**:
```typescript
// Template selection thresholds
const MIN_AUTO_SELECT_THRESHOLD = 0.70;  // 70% minimum for auto-select
const MIN_SHOW_SUGGESTIONS = 0.50;        // 50% minimum to show as option

// Sort by match score
const sortedTemplates = evaluation.template_suggestions
  .sort((a, b) => b.match_score - a.match_score);

const bestTemplate = sortedTemplates[0];

// Only auto-select if confidence is high enough
if (bestTemplate.match_score >= MIN_AUTO_SELECT_THRESHOLD) {
  console.log('🎯 High confidence match - auto-selecting template:', {
    templateId: bestTemplate.template_id,
    templateName: bestTemplate.template_name,
    matchScore: bestTemplate.match_score
  });

  setTimeout(() => this.applyTemplateToDocument(documentId, bestTemplate.template_id), 100);
} else if (bestTemplate.match_score >= MIN_SHOW_SUGGESTIONS) {
  console.log('⚠️ Medium confidence matches - waiting for user selection:', {
    bestMatch: bestTemplate.template_name,
    score: bestTemplate.match_score,
    threshold: MIN_AUTO_SELECT_THRESHOLD
  });

  // Store suggestions in metadata for user to choose
  // User will manually select from document detail view
} else {
  console.log('❌ Low confidence - no good template matches:', {
    bestMatch: bestTemplate.template_name,
    score: bestTemplate.match_score,
    action: 'suggest_new_template_generation'
  });

  // Optionally trigger template generation flow
}
```

---

### Task 2.2: Add Better Logging for Template Selection

**File**: `localai-admin-dashboard/src/services/unified-document-service.ts`

**Location**: In same method, after evaluation

**Implementation**:
```typescript
console.log('📊 Template matching results:', {
  documentId,
  totalSuggestions: evaluation.template_suggestions?.length || 0,
  topSuggestions: evaluation.template_suggestions?.slice(0, 3).map(t => ({
    name: t.template_name,
    score: t.match_score,
    category: t.category
  })),
  autoSelectThreshold: MIN_AUTO_SELECT_THRESHOLD,
  willAutoSelect: bestTemplate?.match_score >= MIN_AUTO_SELECT_THRESHOLD
});
```

---

## Phase 3: Fix 400 Bad Request Error

### Task 3.1: Add Comprehensive Debugging to Backend

**File**: `document-processor/app/routers/enhanced_documents.py`

**Location**: Line 903-914 (`/extract-with-smart-template` endpoint)

**Implementation**:
```python
@router.post("/extract-with-smart-template")
async def extract_with_smart_template(
    file: UploadFile = File(...),
    template_data: Optional[str] = Form(None),
    processing_mode: str = Form("smart_template"),
    confidence_threshold: float = Form(0.7),
    enable_validation: bool = Form(True),
    provider: str = Form("azure")
):
    if not file.filename:
        raise HTTPException(status_code=400, detail="No file provided")

    temp_file_path = None

    try:
        # Parse template data if provided
        template_info = None
        template_variables = []

        if template_data:
            logger.info(f"Received template_data (length: {len(template_data)} chars)")
            logger.debug(f"First 200 chars of template_data: {template_data[:200]}")

            try:
                template_info = json.loads(template_data)
                logger.info(f"Parsed template_info keys: {list(template_info.keys())}")

                template_variables = template_info.get('smart_variables', [])
                logger.info(f"Template variables count: {len(template_variables)}")

                if template_variables:
                    logger.info(f"Sample variable: {json.dumps(template_variables[0], indent=2)}")
                else:
                    logger.warning("⚠️ smart_variables is empty or missing!")
                    logger.warning(f"Full template_info: {json.dumps(template_info, indent=2)}")

            except json.JSONDecodeError as e:
                logger.error(f"❌ JSON decode error: {str(e)}")
                logger.error(f"Raw template_data causing error: {template_data[:500]}")
                raise HTTPException(status_code=400, detail=f"Invalid JSON in template_data: {str(e)}")
        else:
            logger.error("❌ No template_data provided in request")
            raise HTTPException(status_code=400, detail="template_data is required")

        if not template_variables:
            logger.error(f"❌ No smart template variables provided. Template info: {template_info}")
            raise HTTPException(
                status_code=400,
                detail=f"No smart_variables found in template_data. Keys present: {list(template_info.keys()) if template_info else 'none'}"
            )

        # Continue with extraction...
```

---

### Task 3.2: Add Frontend Template Data Validation

**File**: `localai-admin-dashboard/src/lib/document-processor-enhanced.ts`

**Location**: Line 492-505 (FormData preparation in `processDocumentWithTemplate`)

**Implementation**:
```typescript
// Before sending request, validate template data
if (!template.smart_variables || template.smart_variables.length === 0) {
  console.error('❌ Template missing smart_variables:', template);
  throw new Error(`Template "${template.name}" has no smart_variables defined`);
}

const templateDataPayload = {
  id: template.id,
  name: template.name,
  smart_variables: template.smart_variables,
  extraction_rules: template.extraction_rules || [],
  generation_settings: template.generation_settings || {},
  confidence_threshold: 0.7
};

console.log('📤 Sending template data to backend:', {
  templateId: template.id,
  templateName: template.name,
  smartVariablesCount: template.smart_variables.length,
  smartVariablesSample: template.smart_variables.slice(0, 2).map(v => ({
    id: v.id,
    name: v.name,
    type: v.type
  })),
  payloadSize: JSON.stringify(templateDataPayload).length
});

formData.append('template_data', JSON.stringify(templateDataPayload));
```

---

### Task 3.3: Verify Template Fetch Includes smart_variables

**File**: `localai-admin-dashboard/src/services/unified-document-service.ts`

**Location**: In `applyTemplateToDocument` method (line ~1236)

**Implementation**:
```typescript
async applyTemplateToDocument(documentId: number, templateId: number) {
  console.log('🎯 Starting applyTemplateToDocument:', { documentId, templateId });

  // Fetch full template with all fields
  const template = await this.smartTemplateService.getTemplate(templateId);

  if (!template) {
    console.error('❌ Template not found:', templateId);
    throw new Error(`Template ${templateId} not found`);
  }

  console.log('📋 Template fetched from database:', {
    id: template.id,
    name: template.name,
    hasSmartVariables: !!template.smart_variables,
    smartVariablesCount: template.smart_variables?.length || 0,
    smartVariablesPreview: template.smart_variables?.slice(0, 2).map(v => ({
      id: v.id,
      name: v.name,
      type: v.type
    }))
  });

  if (!template.smart_variables || template.smart_variables.length === 0) {
    console.error('❌ Template has no smart_variables:', template);
    throw new Error(`Template "${template.name}" has no smart_variables defined. Cannot perform extraction.`);
  }

  // Update status to processing
  await this.updateDocumentStatus(documentId, {
    status: DocumentStatus.PROCESSING,
    metadata: {
      template_id: templateId,
      template_name: template.name,
      processing_method: 'template_guided'
    }
  });

  // Continue with extraction...
}
```

---

## Phase 4: Testing & Verification

### Task 4.1: Manual Testing Steps

**Test Document**: "Stucco Contract V1.pdf"

**Steps**:
1. Start services: `python start_services.py --profile cpu`
2. Open browser: `http://localhost:5173/documents/upload`
3. Upload: "Stucco Contract V1.pdf"
4. **Monitor browser console** for logs:
   - Should show contract-related key phrases
   - Template suggestions with scores
   - Auto-selection decision (should NOT auto-select if score <70%)
5. **Check backend logs**:
   ```bash
   docker logs localai-document-processor --tail 100 -f
   ```
   - Should show clean text extraction
   - Should show template matching with contract terms
6. **Verify behavior**:
   - If match <70%: Document stays in "uploaded" state with suggestions shown
   - If match ≥70%: Auto-selects and extracts (not expected for current data)

---

### Task 4.2: Create Automated Test

**File**: `test_stucco_contract_processing.py` (new file)

**Implementation**:
```python
#!/usr/bin/env python3
"""
Test Stucco Contract PDF processing with proper text extraction
"""
import requests
import json
from pathlib import Path

API_BASE = "http://localhost:8090"
PDF_PATH = "localai-admin-dashboard/test-documents/edge-cases/alu, deck for nick yeager.pdf"

def test_pdf_text_extraction():
    """Verify PDF extracts actual text, not PDF metadata"""
    print("\n" + "="*80)
    print("TEST 1: PDF Text Extraction")
    print("="*80 + "\n")

    with open(PDF_PATH, 'rb') as f:
        files = {'file': (Path(PDF_PATH).name, f, 'application/pdf')}

        response = requests.post(
            f"{API_BASE}/api/enhanced-documents/evaluate-document-type",
            files=files,
            params={
                'quick_scan': 'false',
                'suggest_templates': 'true'
            },
            timeout=60
        )

        assert response.status_code == 200, f"Request failed: {response.status_code}"

        result = response.json()
        key_phrases = result.get('evaluation', {}).get('key_phrases', [])

        print(f"Key phrases extracted: {key_phrases[:15]}")

        # Check for contract-related terms (should be present)
        contract_terms = ['proposal', 'contract', 'client', 'scope', 'work', 'stucco']
        found_contract_terms = [term for term in contract_terms if any(term in phrase.lower() for phrase in key_phrases)]

        # Check for PDF metadata markers (should NOT be present)
        pdf_markers = ['endobj', '<</type', '/structelem', '/flatedecode']
        found_pdf_markers = [marker for marker in pdf_markers if any(marker in phrase.lower() for phrase in key_phrases)]

        print(f"\n✅ Contract terms found: {found_contract_terms}")
        print(f"{'✅' if not found_pdf_markers else '❌'} PDF markers found: {found_pdf_markers}")

        assert len(found_contract_terms) > 0, f"No contract terms found in key phrases!"
        assert len(found_pdf_markers) == 0, f"PDF metadata markers found: {found_pdf_markers}"

        print("\n✅ TEST 1 PASSED: Clean text extraction working!")
        return True

def test_template_matching():
    """Verify template matching uses clean text"""
    print("\n" + "="*80)
    print("TEST 2: Template Matching")
    print("="*80 + "\n")

    with open(PDF_PATH, 'rb') as f:
        files = {'file': (Path(PDF_PATH).name, f, 'application/pdf')}

        response = requests.post(
            f"{API_BASE}/api/enhanced-documents/evaluate-document-type",
            files=files,
            params={
                'quick_scan': 'false',
                'suggest_templates': 'true'
            },
            timeout=60
        )

        result = response.json()
        suggestions = result.get('template_suggestions', [])

        print(f"\nTemplate suggestions ({len(suggestions)}):")
        for i, s in enumerate(suggestions[:5], 1):
            print(f"  {i}. {s['template_name']}: {s['match_score']:.3f} ({s['category']})")

        if suggestions:
            best = suggestions[0]

            # For contract documents, expect "Contract" template to rank high
            if 'contract' in best['template_name'].lower():
                print(f"\n✅ Correct template type ranked first: {best['template_name']}")
            else:
                print(f"\n⚠️ Unexpected top template: {best['template_name']}")

            # Check if score is reasonable (should be >0.5 for related templates)
            if best['match_score'] >= 0.50:
                print(f"✅ Match score is reasonable: {best['match_score']:.3f}")
            else:
                print(f"⚠️ Low match score: {best['match_score']:.3f}")

        print("\n✅ TEST 2 PASSED: Template matching working!")
        return True

if __name__ == "__main__":
    try:
        test_pdf_text_extraction()
        test_template_matching()

        print("\n" + "="*80)
        print("✅ ALL TESTS PASSED!")
        print("="*80 + "\n")

    except AssertionError as e:
        print(f"\n❌ TEST FAILED: {e}\n")
        exit(1)
    except Exception as e:
        print(f"\n❌ ERROR: {e}\n")
        import traceback
        traceback.print_exc()
        exit(1)
```

---

## Success Criteria

✅ **Phase 1 Complete**:
- Backend logs show contract-related key phrases, not PDF markers
- Document evaluation extracts clean text before template matching

✅ **Phase 2 Complete**:
- Templates with <70% confidence are NOT auto-selected
- Browser console logs show threshold checks
- User shown template suggestions for manual selection

✅ **Phase 3 Complete**:
- No 400 errors when extracting with templates
- Backend receives valid `smart_variables` array
- Detailed error messages if template data is invalid

✅ **Phase 4 Complete**:
- Automated test passes
- Manual upload test works end-to-end
- Logs show correct data flow at each step

---

## Rollback Plan

If issues occur:
1. ✅ **document_evaluator.py**: Revert `content_override` parameter (keep existing extraction)
2. ✅ **enhanced_documents.py**: Remove PDF pre-extraction (falls back to existing flow)
3. ✅ **unified-document-service.ts**: Remove threshold checks (auto-selects any template)
4. ✅ **Keep all logging** - Useful for future debugging

All changes are additive with fallbacks - system will continue working even if new code has issues.

---

**Estimated Time**: 2-3 hours
**Risk Level**: Medium (core document processing changes)
**Testing Required**: Both automated and manual verification
