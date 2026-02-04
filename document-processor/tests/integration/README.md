# Integration Tests - Improved Extraction E2E

## Overview

This directory contains end-to-end integration tests for the improved variable extraction pipeline. These tests verify that all components work together correctly with **REAL LLM services** (no mocking).

## Test File: `test_improved_extraction_e2e.py`

### What It Tests

#### 1. **Semantic Extraction Accuracy** (`test_semantic_extraction_improves_accuracy`)
- Verifies that semantic parsing helps extract fields accurately
- Tests extraction of vendor name, invoice number, and total amount
- Validates confidence levels are reasonable (≥ 0.3)
- Uses a realistic invoice document with multiple field types

#### 2. **Two-Pass Extraction** (`test_two_pass_extraction_works`)
- Verifies two-pass extraction successfully processes documents
- Checks that `extraction_method` is set to `"two_pass_intelligent"`
- Validates `pass_stats` are included in the response
- Ensures extraction pass tracking (1 or 2) is present for each field
- Confirms at least 3 fields are extracted from the sample invoice

#### 3. **Context-Aware Extraction** (`test_context_aware_extraction_uses_context`)
- Tests that existing context is accepted and utilized
- Provides "previously extracted" vendor name as context
- Verifies extraction of vendor address using context
- Demonstrates context improves field location accuracy

#### 4. **Chunked Extraction Methods** (`test_chunked_extraction_methods_exist`)
- Verifies chunking functionality for long documents
- Tests `_chunk_document()` method splits text correctly
- Tests `_merge_chunk_extractions()` keeps highest confidence values
- Validates chunk overlap and size parameters work

#### 5. **Semantic Parser Integration** (`test_semantic_parser_enhances_prompts`)
- Verifies semantic parser is available and functional
- Tests parsing of variable names into semantic components
- Validates output includes:
  - `semantic_description`
  - `field_type_hint`
  - `search_keywords`

#### 6. **API Endpoint Integration** (`test_api_two_pass_endpoint`)
- Tests the `/api/enhanced-documents/extract-with-text` endpoint
- Verifies `use_two_pass=true` parameter is accepted
- Validates response contains `extraction_method: "two_pass_intelligent"`
- Requires document-processor service running on port 8090

## Sample Test Data

The tests use a realistic invoice document:

```
INVOICE

From: Acme Corporation
123 Business Lane
New York, NY 10001
accounting@acme-corp.com

Invoice Number: INV-2024-0042
Invoice Date: January 15, 2024
Due Date: February 15, 2024

Bill To:
John Smith
456 Customer Road
Los Angeles, CA 90001

Description                     Amount
--------------------------------
Consulting Services            $5,000.00
Software License               $2,500.00
Support Package                  $750.00
--------------------------------
Subtotal:                      $8,250.00
Tax (8%):                        $660.00
--------------------------------
TOTAL DUE:                     $8,910.00

Payment Terms: Net 30
```

## Template Variables Tested

The tests use these template variables:

| Variable Name | Type | Description |
|---------------|------|-------------|
| `vendor_name` | text | Company sending invoice |
| `vendor_address` | text | Vendor street address |
| `vendor_email` | email | Vendor email |
| `invoice_number` | id | Invoice reference number |
| `invoice_date` | date | Date invoice was issued |
| `customer_name` | text | Customer being billed |
| `total_amount` | currency | Total amount due |

## Running the Tests

### Option 1: Using the Shell Script (Recommended)

```bash
cd document-processor
./run_integration_tests.sh
```

### Option 2: Direct Docker Exec

```bash
docker exec localai-document-processor-1 python -m pytest tests/integration/test_improved_extraction_e2e.py -v -s
```

### Option 3: Inside Container

```bash
docker exec -it localai-document-processor-1 bash
cd /app
python -m pytest tests/integration/test_improved_extraction_e2e.py -v -s
```

### Option 4: Direct Python Execution

```bash
cd document-processor
python tests/integration/test_improved_extraction_e2e.py
```

## Prerequisites

1. **Document Processor Service Running**
   - Service must be available at `http://localhost:8090`
   - Verify with: `curl http://localhost:8090/health`

2. **Azure OpenAI Configuration**
   - Tests use `provider="azure"` for fast LLM responses
   - Requires environment variables:
     - `AZURE_OPENAI_API_KEY`
     - `AZURE_OPENAI_ENDPOINT`
     - `AZURE_OPENAI_DEPLOYMENT_NAME`
     - `AZURE_OPENAI_API_VERSION`

3. **Pytest and Dependencies**
   - All dependencies installed in Docker container
   - `httpx` for async HTTP requests
   - `pytest-asyncio` for async test support

## Expected Test Timing

- **Semantic extraction test**: ~5-15 seconds (LLM call)
- **Two-pass extraction test**: ~10-30 seconds (2 LLM calls)
- **Context-aware test**: ~5-15 seconds (LLM call)
- **Chunked methods test**: <1 second (no LLM)
- **Semantic parser test**: <1 second (no LLM)
- **API endpoint test**: ~5-15 seconds (requires running service)

**Total runtime**: ~35-80 seconds for full suite

## Expected Output

### Successful Test Run

```
============================= test session starts ==============================
collected 6 items

tests/integration/test_improved_extraction_e2e.py::TestImprovedExtractionE2E::test_semantic_extraction_improves_accuracy PASSED
tests/integration/test_improved_extraction_e2e.py::TestImprovedExtractionE2E::test_two_pass_extraction_works PASSED
tests/integration/test_improved_extraction_e2e.py::TestImprovedExtractionE2E::test_context_aware_extraction_uses_context PASSED
tests/integration/test_improved_extraction_e2e.py::TestImprovedExtractionE2E::test_chunked_extraction_methods_exist PASSED
tests/integration/test_improved_extraction_e2e.py::TestImprovedExtractionE2E::test_semantic_parser_enhances_prompts PASSED
tests/integration/test_improved_extraction_e2e.py::TestExtractionAPIIntegration::test_api_two_pass_endpoint PASSED

============================== 6 passed in 45.23s ===============================
```

## Troubleshooting

### Test Fails: "Module not found"

**Problem**: Import errors for `app.services.smart_field_extractor` or other modules

**Solution**: Tests must run inside Docker container where all modules are available

```bash
docker exec localai-document-processor-1 python -m pytest tests/integration/test_improved_extraction_e2e.py -v -s
```

### Test Fails: "Connection refused"

**Problem**: API test cannot connect to `http://localhost:8090`

**Solution**:
1. Verify service is running: `curl http://localhost:8090/health`
2. Check Docker container status: `docker ps | grep document-processor`
3. Restart if needed: `docker compose -p localai restart document-processor`

### Test Fails: "Azure OpenAI authentication"

**Problem**: Missing or invalid Azure OpenAI credentials

**Solution**:
1. Check environment variables in `.env` file
2. Verify API key is valid
3. Ensure endpoint URL is correct
4. Alternative: Switch to Ollama provider (slower but no API key required)

### Tests Take Too Long

**Problem**: Tests timeout after 60+ seconds

**Solution**:
1. Use Azure OpenAI instead of Ollama (150x faster)
2. Increase timeout in test: `@pytest.mark.timeout(120)`
3. Reduce test document size for faster processing

## Test Failure Analysis

If tests fail, check:

1. **Assertion failures** - Field extraction accuracy issues
   - Review confidence thresholds (currently 0.3-0.6)
   - Check LLM prompt quality in `smart_field_extractor.py`
   - Verify semantic parser is enhancing descriptions

2. **Missing fields** - Expected fields not extracted
   - Check LLM response parsing in `_parse_extraction_response()`
   - Verify JSON cleanup handles malformed LLM outputs
   - Review extraction prompt template

3. **Low confidence** - Extracted values below threshold
   - May indicate LLM uncertainty about field location
   - Review semantic descriptions for clarity
   - Check if field appears in multiple contexts

## Integration with CI/CD

These tests are designed for local development and validation. For CI/CD:

1. **Mock LLM calls** for faster pipeline execution
2. **Use recorded responses** to ensure deterministic results
3. **Run full E2E tests** only on pre-production environments
4. **Set timeouts** appropriate for CI environment (120+ seconds)

## Related Files

- `/Users/nickyeager/Code/agents/local-ai-packaged/document-processor/app/services/smart_field_extractor.py` - Main extraction service
- `/Users/nickyeager/Code/agents/local-ai-packaged/document-processor/app/services/two_pass_extractor.py` - Two-pass extraction logic
- `/Users/nickyeager/Code/agents/local-ai-packaged/document-processor/app/services/semantic_variable_parser.py` - Semantic parsing
- `/Users/nickyeager/Code/agents/local-ai-packaged/document-processor/tests/unit/` - Unit tests for individual components

## Next Steps

After verifying these tests pass:

1. Add more test documents (contracts, receipts, legal documents)
2. Test edge cases (missing fields, ambiguous values, malformed documents)
3. Add performance benchmarks (extraction time, accuracy metrics)
4. Create regression test suite with known-good extractions
5. Integrate with frontend E2E tests for full workflow validation
