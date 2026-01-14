# Integration Tests - Quick Reference Card

## Run Tests

```bash
# Method 1: Shell script (easiest)
./run_integration_tests.sh

# Method 2: Direct Docker exec
docker exec localai-document-processor-1 python -m pytest tests/integration/test_improved_extraction_e2e.py -v -s

# Method 3: Validation only (no LLM calls)
python3 validate_integration_tests.py
```

## What Gets Tested

| Test Name | Duration | What It Tests |
|-----------|----------|---------------|
| `test_semantic_extraction_improves_accuracy` | ~10s | Semantic parsing extracts vendor, invoice #, total |
| `test_two_pass_extraction_works` | ~20s | Two-pass returns correct structure + pass tracking |
| `test_context_aware_extraction_uses_context` | ~10s | Existing context improves extraction |
| `test_chunked_extraction_methods_exist` | <1s | Chunking splits text, merge keeps high confidence |
| `test_semantic_parser_enhances_prompts` | <1s | Parser generates semantic descriptions |
| `test_api_two_pass_endpoint` | ~10s | API accepts `use_two_pass=true` parameter |

**Total:** ~50 seconds

## Expected Output (All Passing)

```
============================== 6 passed in 45.23s ===============================
```

## Prerequisites

- ✅ Document processor running: `curl http://localhost:8090/health`
- ✅ Azure OpenAI configured (or Ollama fallback)
- ✅ Docker container: `localai-document-processor-1`

## Common Issues

| Error | Fix |
|-------|-----|
| "Module not found" | Run inside Docker container |
| "Connection refused" | Start document processor service |
| "Azure auth failed" | Check `.env` for Azure credentials |
| "Tests too slow" | Switch to Azure OpenAI (150x faster) |

## Test Data

**Sample Invoice:**
- Vendor: Acme Corporation
- Invoice #: INV-2024-0042
- Total: $8,910.00

**Template Variables:** 7 fields (vendor_name, invoice_number, total_amount, etc.)

## Quick Validation (No LLM Calls)

```bash
python3 validate_integration_tests.py
```

✓ Checks syntax, structure, methods, fixtures, imports, sample data in <1 second

## Documentation

See [README.md](README.md) for:
- Detailed test descriptions
- Troubleshooting guide
- CI/CD integration
- Related files
