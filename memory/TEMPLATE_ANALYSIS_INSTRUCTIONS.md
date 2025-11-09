# Template Analysis & Selection Instructions

## 🎯 **Overview**

The template analysis system uses Azure OpenAI to analyze uploaded documents and **match them with existing templates** from the database. It does **NOT** create new templates automatically - it intelligently selects the best existing template for document processing.

## 🔍 **How Template Analysis Works**

### **1. Template Matching Process**

When a document is uploaded without a pre-selected template, the system:

1. **Document Classification**: Uses Azure OpenAI to classify the document type
2. **Template Database Search**: Queries existing templates in Supabase
3. **Intelligent Matching**: Compares document characteristics with template metadata
4. **Confidence Scoring**: Assigns match scores to candidate templates
5. **Best Match Selection**: Recommends the highest-scoring template

### **2. Template Selection Strategies**

The system uses **three different approaches** depending on the upload method:

#### **Strategy A: Pre-Selected Template (Template Gallery)**
```typescript
// User selects template first, then uploads document
templateId: 123,
processingMethod: 'template_guided'
```
- **No AI analysis needed** - template already chosen
- **Direct to processing** - skips evaluation step
- **Fastest method** - processing starts immediately

#### **Strategy B: Smart Upload Analysis**
```typescript
// User uploads document, system suggests templates
processingMethod: 'ai_enhanced'
```
- **Document type detection** via Azure OpenAI
- **Template suggestions** from existing database
- **User chooses** from recommended templates

#### **Strategy C: No Template Available**
```typescript
// No suitable existing template found
workflow: 'generate_template'
```
- **Fallback processing** with generic extraction
- **User must manually** create template later
- **Least automated** but still functional

## 📊 **Template Matching Algorithm**

### **Document Classification (Azure OpenAI)**

**Location**: `document_evaluator.py` → `_full_type_detection()`

```python
# Azure OpenAI analyzes document content
ai_classification = await ai_classifier.classify_document_content(content, metadata)

# Maps AI categories to template types
type_mapping = {
    'invoice': 'invoice',
    'financial_statement': 'invoice', 
    'legal_contract': 'contract',
    'business_report': 'report',
    'receipt': 'receipt'
}
```

**Azure OpenAI Prompt**:
```
Classify this document into one of these categories:
- invoice: Bills, invoices, payment requests
- receipt: Purchase receipts, transaction records  
- contract: Legal agreements, terms of service
- report: Business reports, analysis documents
- form: Applications, surveys, data collection

Document content: [first 2000 characters]

Return classification with confidence score (0.0-1.0).
```

### **Template Database Matching**

**Location**: `document_evaluator.py` → `_suggest_matching_templates()`

```python
async def _suggest_matching_templates(
    document_type: str,
    confidence: float, 
    key_phrases: List[str]
) -> List[Dict[str, Any]]:
    """
    Currently returns empty list - template database integration needed.
    
    PLANNED IMPLEMENTATION:
    1. Query Supabase for templates matching document_type
    2. Score templates based on:
       - Category match (invoice → invoice templates)
       - Field compatibility (document has fields template expects)
       - Usage patterns (popular templates score higher)
       - Content similarity (key phrases match template examples)
    3. Return top 3-5 matches with confidence scores
    """
```

### **Template Scoring Criteria**

When fully implemented, templates will be scored on:

#### **Primary Factors (80% weight)**
- **Category Match**: Exact document type → template category match
- **Field Coverage**: % of template fields detectable in document
- **Content Patterns**: Key phrases match template examples

#### **Secondary Factors (20% weight)**  
- **Usage Count**: More popular templates score higher
- **Success Rate**: Templates with higher extraction success rates
- **Recency**: Recently updated templates get slight boost

#### **Confidence Calculation**
```python
template_confidence = (
    category_match_score * 0.4 +      # 40%: Direct category alignment
    field_coverage_score * 0.3 +      # 30%: Template fields detectable  
    content_similarity_score * 0.1 +  # 10%: Content pattern matching
    usage_popularity_score * 0.1 +    # 10%: Community usage patterns
    success_rate_score * 0.1          # 10%: Historical success rate
)
```

## 🔄 **Template Selection User Experience**

### **Scenario 1: High Confidence Match**
```
✅ Document Type: Invoice (95% confidence)
✅ Best Match: "Standard Invoice Template" (88% match)
✅ Action: Automatically process with recommended template
```

### **Scenario 2: Multiple Good Matches**
```
✅ Document Type: Receipt (92% confidence)  
🤔 Template Options:
   1. "Retail Receipt Template" (85% match)
   2. "Restaurant Receipt Template" (82% match)
   3. "Service Receipt Template" (78% match)
✅ Action: User selects preferred template
```

### **Scenario 3: Low Confidence / No Match**
```
⚠️  Document Type: Unknown (45% confidence)
❌ No suitable templates found
✅ Action: Generic processing or create new template
```

## 📁 **Template Database Structure**

### **Smart Templates Table** (`smart_templates`)
```sql
CREATE TABLE smart_templates (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    category VARCHAR(100) NOT NULL,        -- For matching document types
    description TEXT,
    smart_variables JSONB NOT NULL,        -- Field definitions for matching
    extraction_rules JSONB,               -- AI extraction hints
    usage_count INTEGER DEFAULT 0,        -- Popularity scoring
    success_rate FLOAT DEFAULT 0.0,       -- Effectiveness metric
    is_public BOOLEAN DEFAULT true,       -- Available for auto-selection
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMP DEFAULT NOW()
);
```

### **Template Categories**
```typescript
const TEMPLATE_CATEGORIES = {
    'business': ['report', 'memo', 'proposal'],
    'legal': ['contract', 'agreement', 'terms'],
    'finance': ['invoice', 'receipt', 'statement'], 
    'hr': ['resume', 'application', 'evaluation'],
    'procurement': ['purchase_order', 'quotation', 'rfp'],
    'healthcare': ['patient_form', 'medical_record', 'prescription'],
    'insurance': ['claim_form', 'policy', 'assessment']
};
```

## ⚡ **Implementation Status**

### **✅ Currently Working**
- Document type classification via Azure OpenAI
- Template pre-selection (gallery workflow)  
- Direct template processing
- Fallback generic processing

### **🚧 Partially Implemented**
- Template suggestion framework (returns empty array)
- Confidence scoring infrastructure
- Template metadata structure

### **📋 TODO: Full Template Matching**
- Database query implementation for template suggestions
- Scoring algorithm with confidence calculation  
- Template compatibility analysis
- Usage analytics integration
- A/B testing framework for template recommendations

**📄 For detailed implementation status and code examples, see `TEMPLATE_ANALYSIS_IMPLEMENTATION_STATUS.md`**

## 🛠️ **Configuration**

### **Azure OpenAI Settings**
```python
# Required environment variables
AZURE_OPENAI_API_KEY=your_api_key
AZURE_OPENAI_ENDPOINT=https://resource.openai.azure.com/
AZURE_OPENAI_DEPLOYMENT_NAME=gpt-4
AZURE_OPENAI_API_VERSION=2024-02-01

# Template analysis parameters  
DOCUMENT_CLASSIFICATION_TEMPERATURE=0.1    # Low for consistent results
TEMPLATE_MATCHING_CONFIDENCE_THRESHOLD=0.7  # Minimum match score
MAX_TEMPLATE_SUGGESTIONS=5                  # Top N recommendations
```

### **Template Matching Tuning**
```python
TEMPLATE_MATCHING_CONFIG = {
    'category_weight': 0.4,        # Category alignment importance
    'field_coverage_weight': 0.3,  # Field compatibility importance  
    'content_similarity_weight': 0.1, # Content pattern matching
    'popularity_weight': 0.1,      # Community usage factor
    'success_rate_weight': 0.1,    # Historical effectiveness
    'min_match_threshold': 0.6,    # Minimum score to suggest
    'max_suggestions': 5           # Maximum recommendations
}
```

## 🚀 **Performance Optimization**

### **Template Matching Speed**
- **Template metadata caching**: Keep template info in Redis
- **Document type prediction caching**: Cache common document patterns  
- **Batch processing**: Analyze multiple documents simultaneously
- **Lazy loading**: Load template details only when selected

### **Accuracy Improvements**
- **Template field examples**: Store sample values for better matching
- **Document preprocessing**: Clean and normalize content before analysis
- **Multi-model consensus**: Use multiple AI models for classification
- **User feedback integration**: Learn from selection patterns

## 📈 **Analytics & Monitoring**

### **Template Performance Metrics**
```sql
-- Track template effectiveness
CREATE TABLE template_analytics (
    template_id INTEGER REFERENCES smart_templates(id),
    document_count INTEGER,           -- Times used
    avg_extraction_confidence FLOAT, -- Average field confidence
    user_satisfaction_score FLOAT,   -- User rating 1-5
    processing_time_avg_ms INTEGER,  -- Performance metric
    last_updated TIMESTAMP DEFAULT NOW()
);
```

### **Document Classification Accuracy**
```sql
-- Monitor AI classification performance
CREATE TABLE classification_analytics (
    document_id UUID REFERENCES documents(id),
    predicted_type VARCHAR(100),      -- AI prediction
    actual_type VARCHAR(100),         -- User-confirmed type
    confidence_score FLOAT,           -- AI confidence
    template_selected INTEGER,       -- Final template chosen
    user_overrode BOOLEAN,           -- User changed AI suggestion
    created_at TIMESTAMP DEFAULT NOW()
);
```

## 🎯 **Best Practices**

### **For Template Creators**
1. **Clear Categories**: Use standard category names for better matching
2. **Rich Descriptions**: Include keywords that help with content matching  
3. **Example Values**: Provide sample field values to improve detection
4. **Field Hints**: Add extraction hints for complex fields
5. **Public Availability**: Mark useful templates as public for auto-selection

### **For System Administrators**  
1. **Monitor Match Rates**: Track how often documents get good template matches
2. **Curate Template Library**: Regularly review and improve popular templates
3. **Performance Tuning**: Adjust confidence thresholds based on user feedback
4. **AI Model Updates**: Keep Azure OpenAI models current for best classification
5. **Usage Analytics**: Use data to identify gaps in template coverage

This template analysis system provides intelligent document processing while leveraging existing organizational templates, ensuring consistency and efficiency in document automation workflows.