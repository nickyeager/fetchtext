# Template Matching E2E Testing Guide

## 🎯 **Overview**

This guide shows you how to run comprehensive end-to-end tests for the template matching functionality using real documents from the `/data` folder.

## 📋 **What Gets Tested**

### **Core Functionality**
- ✅ Document type detection (invoice, receipt, contract, etc.)
- ✅ Intelligent template suggestions with scoring
- ✅ Workflow recommendations (existing template vs. generate new)
- ✅ End-to-end document processing pipeline
- ✅ Performance and reliability metrics

### **Test Documents Used**
- `sample_invoice.txt` - Professional services invoice
- `sample_receipt.txt` - Retail purchase receipt  
- `sample_contract.txt` - Service agreement contract
- `sample_report.txt` - Business sales report
- `sample_form.txt` - Employee information form
- `sample_letter.txt` - Business correspondence
- `Receipt-2975-4330.pdf` - Real receipt document (PDF)
- `Hippa_auth_form.pdf` - HIPAA authorization form (PDF)

## 🚀 **How to Run the Tests**

### **Option 1: Quick Test Runner (Recommended)**

```bash
# Run everything automatically
./scripts/run_template_matching_tests.sh

# Run with services already started
./scripts/run_template_matching_tests.sh --skip-start

# Run just a quick manual test
./scripts/run_template_matching_tests.sh --manual-only
```

### **Option 2: Comprehensive Python E2E Tests**

```bash
# Start services first
python start_services.py --profile cpu

# Run comprehensive Python E2E tests
python run_template_matching_e2e.py
```

### **Option 3: Frontend E2E Tests (Vitest)**

```bash
# Start services
python start_services.py --profile cpu

# Run frontend E2E tests
cd localai-admin-dashboard
pnpm test tests/e2e/template-matching-e2e.spec.ts
```

### **Option 4: Backend Integration Tests**

```bash
# Run backend template matching integration tests
cd document-processor
python test_template_matching_integration.py
```

### **Option 5: Manual API Testing**

```bash
# Test a single document directly
curl -X POST \
  -F "file=@data/sample_invoice.txt" \
  http://localhost:8090/api/enhanced-documents/evaluate-document-type \
  | jq '.'
```

## 📊 **Expected Test Results**

### **Successful Test Output Example**

```
🎉 TEMPLATE MATCHING E2E TEST RESULTS
============================================================

📊 Overall Performance:
   Total Tests: 6
   Successful: 6 ✅
   Failed: 0 ❌
   Success Rate: 100%

⚡ Performance Metrics:
   Average Processing Time: 2.45s
   Average Quality Score: 0.758 / 1.0
   Type Detection Accuracy: 83%

🎯 Template Matching:
   Average Templates per Document: 1.5
   Average Best Match Score: 0.687
   Documents with Suggestions: 5/6

🔄 Workflow Distribution:
   existing_template: 3 documents
   template_selection: 2 documents
   generate_template: 1 document

📋 Detailed Results:
   ✅ sample_invoice.txt      | Type: invoice    | Templates:  1 | Quality: 0.785
   ✅ sample_receipt.txt      | Type: receipt    | Templates:  2 | Quality: 0.823
   ✅ sample_contract.txt     | Type: contract   | Templates:  1 | Quality: 0.756
   ✅ sample_report.txt       | Type: report     | Templates:  0 | Quality: 0.645
   ✅ sample_form.txt         | Type: unknown    | Templates:  0 | Quality: 0.432
   ✅ sample_letter.txt       | Type: letter     | Templates:  1 | Quality: 0.681
```

### **What Each Test Verifies**

1. **Document Type Detection**
   - Correctly identifies document types using AI
   - Provides confidence scores for classification
   - Handles edge cases and unknown documents

2. **Template Matching Quality**
   - Suggests relevant templates based on content
   - Provides accurate match scores (0.0 - 1.0)
   - Orders suggestions by relevance

3. **Workflow Decision Logic**
   - `existing_template` - High confidence + good template match
   - `template_selection` - Medium confidence + some templates
   - `generate_template` - Low confidence or no templates

4. **Performance Benchmarks**
   - Document processing under 10 seconds
   - Template matching under 5 seconds
   - End-to-end workflow under 15 seconds

## 🔧 **Prerequisites**

### **Required Services**
- ✅ Document Processor (`http://localhost:8090`)
- ✅ Admin Dashboard (`http://localhost:5173`) 
- ⚠️ Supabase (`http://localhost:8000`) - Optional

### **Start Services**
```bash
# Start with CPU profile (recommended for testing)
python start_services.py --profile cpu

# Or with GPU if available
python start_services.py --profile gpu-nvidia
```

### **Verify Services**
```bash
# Check document processor
curl http://localhost:8090/health

# Check admin dashboard
curl http://localhost:5173

# Check Supabase (optional)
curl http://localhost:8000/health
```

## 🐛 **Troubleshooting**

### **Common Issues**

**"Document processor not running"**
```bash
# Check if port is in use
lsof -i :8090

# Start services manually
cd document-processor
python -m uvicorn app.main:app --host 0.0.0.0 --port 8090
```

**"No template suggestions found"**
- This is normal if no templates are seeded in the database
- Tests will use mock templates and still verify functionality
- Check logs for template matching debug output

**"Tests timing out"**
- Increase timeout values in test configuration
- Check system resources (CPU/memory)
- Ensure no other heavy processes are running

**"PDF processing fails"**
- PDF processing requires additional dependencies
- Text file tests should still work
- Check document processor logs for details

### **Debug Mode**

Add debug logging to see detailed template matching:
```bash
# Set debug environment variables
export TEMPLATE_DEBUG=1
export LOG_LEVEL=DEBUG

# Run tests with verbose output
python run_template_matching_e2e.py
```

## 📈 **Performance Expectations**

### **Processing Times (CPU Profile)**
- Simple text documents: 1-3 seconds
- PDF documents: 3-8 seconds  
- Template matching: 0.5-2 seconds
- Complete workflow: 5-15 seconds

### **Quality Thresholds**
- Type detection confidence: > 0.3 (acceptable), > 0.7 (good)
- Template match scores: > 0.4 (acceptable), > 0.7 (good)  
- Overall quality score: > 0.5 (pass), > 0.8 (excellent)

## 📁 **Test Files Structure**

```
/data/                          # Test documents
├── sample_invoice.txt          # Professional invoice
├── sample_receipt.txt          # Retail receipt
├── sample_contract.txt         # Service contract
├── sample_report.txt           # Business report  
├── sample_form.txt             # Information form
├── sample_letter.txt           # Business letter
├── Receipt-2975-4330.pdf       # Real PDF receipt
└── Hippa_auth_form.pdf        # HIPAA form PDF

/tests/e2e/                     # Frontend E2E tests
├── template-matching-e2e.spec.ts
└── document-processing-e2e.spec.ts

/document-processor/            # Backend tests  
├── test_template_matching_integration.py
└── tests/integration/

/scripts/                       # Test runners
└── run_template_matching_tests.sh
```

## 🎯 **Success Criteria**

### **Tests PASS if:**
- ✅ 80%+ of documents are processed successfully
- ✅ Type detection has >50% accuracy on known document types  
- ✅ Template suggestions are relevant when available
- ✅ Workflow recommendations are logical
- ✅ Processing completes within timeout limits
- ✅ No critical errors or crashes

### **Tests provide VALUE if:**
- 📊 Performance metrics help identify bottlenecks
- 🎯 Quality scores show improvement areas
- 🔄 Workflow distribution guides UI/UX decisions
- 📈 Results can be compared over time for regression testing

## 🚀 **Next Steps After Testing**

1. **Review Results**: Analyze quality scores and performance metrics
2. **Improve Templates**: Add more templates to database if suggestions are poor
3. **Tune Parameters**: Adjust confidence thresholds and scoring weights
4. **Production Deployment**: Use test results to validate production readiness
5. **Monitoring Setup**: Implement similar tests in CI/CD pipeline

---

**✨ The template matching system is now fully tested and production-ready!** 

Use these tests to verify functionality, measure performance, and ensure quality before deploying to users.