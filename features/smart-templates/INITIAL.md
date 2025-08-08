# Smart Template Generation Feature

## Objective
Implement a robust AI-powered template generation system that analyzes documents and creates reusable extraction templates with smart variables, handling all edge cases gracefully.

## Current State
- Backend `/api/enhanced-documents/generate-template` times out for .txt files
- Docling doesn't support plain text files
- Ollama integration failing with empty responses
- Using client-side fallback template generator
- Smart variables implementation exists but needs refinement

## Desired Outcome
1. **Robust template generation** that handles all file types
2. **Intelligent field detection** based on document content analysis
3. **Category-specific smart variables** with confidence scores
4. **Seamless fallback** when AI services are unavailable
5. **Template quality validation** before saving

## Detailed Requirements

### File Type Support
- ✅ PDF, DOCX, HTML, MD (via backend)
- ❌ TXT files (backend fails - must use frontend fallback)
- 🔄 Images (future: OCR integration)
- All unsupported types should gracefully fall back to mock generator

### Smart Variable Requirements
Each smart variable MUST have:
```typescript
{
  id: string;                    // Unique identifier (snake_case)
  name: string;                  // Human-readable name
  type: 'text' | 'number' | 'date' | 'currency' | 'percentage' | 'email' | 'phone';
  description: string;           // Clear description for users
  extraction_hints: string[];    // Min 3 hints for finding this field
  default_value?: any;          // Type-appropriate default
  validation_rules?: {
    required?: boolean;
    pattern?: string;          // Regex pattern
    min?: number;
    max?: number;
  };
  confidence_threshold: number;  // 0.0 to 1.0
}
```

### Category-Specific Variables

#### Invoice Category
- invoice_number (text, required)
- invoice_date (date, required)
- due_date (date)
- vendor_name (text, required)
- vendor_address (text)
- customer_name (text)
- customer_address (text)
- line_items (array of {description, quantity, price})
- subtotal (currency)
- tax_amount (currency)
- total_amount (currency, required)
- payment_terms (text)

#### Contract Category
- contract_title (text, required)
- contract_number (text)
- effective_date (date, required)
- expiration_date (date)
- party_1_name (text, required)
- party_2_name (text, required)
- contract_value (currency)
- terms_conditions (text)
- signatures (array)

#### Receipt Category
- receipt_number (text)
- transaction_date (date, required)
- merchant_name (text, required)
- items_purchased (array)
- subtotal (currency)
- tax (currency)
- total_paid (currency, required)
- payment_method (text)

#### General/Other Category (Fallback)
- document_title (text)
- document_date (date)
- author_name (text)
- content_summary (text)
- key_points (array)
- metadata (object)

### Error Handling

1. **Backend Timeout** (>10 seconds)
   - Log timeout details
   - Switch to fallback generator
   - Notify user: "Using quick template generation"

2. **File Format Not Supported**
   - Detect before sending to backend
   - Use fallback immediately
   - Log skipped backend call

3. **AI Service Failures**
   - Ollama not responding
   - Invalid AI responses
   - Fallback to pattern matching

4. **Validation Failures**
   - Template missing required fields
   - Invalid variable structure
   - Auto-fix when possible, reject when not

### Performance Requirements
- Template generation: <10 seconds (including fallback)
- Fallback activation: <100ms after failure detection
- Variable extraction: Progressive (show as found)
- UI remains responsive during generation

### User Experience

1. **Progress Indicators**
   ```
   Step 1/4: Analyzing document... ✓
   Step 2/4: Detecting document type... ✓
   Step 3/4: Generating smart fields... ⟳
   Step 4/4: Validating template...
   ```

2. **Fallback Transparency**
   - Show when using fallback (subtle indicator)
   - Explain why: "Using quick analysis for text files"
   - Same quality results regardless of method

3. **Template Preview**
   - Show generated variables immediately
   - Allow editing before saving
   - Highlight high-confidence fields

### Success Criteria
- [ ] All document types generate valid templates (PDF, DOCX, TXT, etc.)
- [ ] Smart variables have appropriate extraction hints
- [ ] Template generation completes in <10 seconds
- [ ] Fallback templates are indistinguishable from AI-generated ones
- [ ] No hanging or timeouts visible to users
- [ ] Clear error messages with recovery actions
- [ ] Generated templates pass validation
- [ ] Templates can successfully extract data from similar documents

### Implementation Notes

1. **Backend fixes needed** (but don't wait):
   - Add text file support to enhanced_docling_service
   - Fix Ollama timeout issues
   - Improve error responses (don't hang)

2. **Frontend enhancements**:
   - Detect file type before backend call
   - Enhance mock generator with more categories
   - Add template validation before save
   - Implement progress tracking

3. **Testing Requirements**:
   - Unit tests for each document category
   - E2E tests for full workflow
   - Fallback trigger tests
   - Performance benchmarks

### Example Usage Flow

```typescript
// User uploads invoice.pdf
1. Create document record ✓
2. Check file type → PDF (backend supported) ✓
3. Call backend /generate-template
4. Backend analyzes with Docling + AI
5. Returns template with smart variables
6. Validate template structure
7. Preview to user
8. Save to database

// User uploads invoice.txt
1. Create document record ✓
2. Check file type → TXT (backend unsupported) ✓
3. Skip backend, use fallback generator
4. Analyze filename → detect "invoice"
5. Generate invoice-specific variables
6. Validate template structure
7. Preview to user (same UI)
8. Save to database
```