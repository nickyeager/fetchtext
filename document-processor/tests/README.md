# Test Configuration for Document Processor

This directory contains the complete test suite for the document processor service.

## Directory Structure

```
tests/
├── conftest.py                   # Shared pytest configuration and fixtures
├── test_api.py                   # API endpoint tests
├── test_extraction_effectiveness.py  # Text extraction quality tests
│
├── unit/                         # Unit tests for individual components
│   ├── test_docling_converter.py     # Docling integration tests
│   ├── test_content_extraction.py    # Content extraction logic tests
│   ├── test_metadata_extraction.py   # Metadata extraction tests
│   └── test_models.py                # Pydantic model tests
│
├── integration/                  # Integration tests
│   ├── test_end_to_end_workflow.py   # Complete workflow tests
│   └── test_docling_integration.py   # Docling service integration
│
└── fixtures/                     # Test data and fixtures
    ├── sample_documents/             # Test documents
    └── ground_truth/                 # Expected results for effectiveness testing
```

## Running Tests

Tests are run using `pytest`.

### Run All Tests
```bash
pytest
```

### Run Specific Test Categories
```bash
# Unit tests only
pytest tests/unit/

# Integration tests only
pytest tests/integration/

# API tests only
pytest tests/test_api.py

# Effectiveness tests only
pytest tests/test_extraction_effectiveness.py
```

### Run Individual Test Files
```bash
# Using pytest directly
pytest tests/test_api.py -v
pytest tests/unit/test_content_extraction.py -v
pytest tests/test_extraction_effectiveness.py -v -s
```

## Test Categories

### 1. Unit Tests (`tests/unit/`)
- Test individual components in isolation
- Mock external dependencies
- Fast execution
- High coverage of edge cases

### 2. Integration Tests (`tests/integration/`)
- Test component interactions
- Use real Docling integration
- Validate end-to-end workflows
- Test with actual documents

### 3. API Tests (`tests/test_api.py`)
- Test FastAPI endpoints
- Validate request/response models
- Test error handling
- Authentication and authorization

### 4. Effectiveness Tests (`tests/test_extraction_effectiveness.py`)
- Measure text extraction quality
- Compare against ground truth
- Calculate accuracy metrics
- Performance benchmarks

### 5. Comprehensive Tests (`tests/test_comprehensive.py`)
- Full system integration
- Real-world scenarios
- Performance under load
- Error recovery

### 6. Manual Verification (`tests/manual_verification/`)
- Quick debugging tools
- Manual quality checks
- Development utilities

## Test Data

### Sample Documents (`tests/fixtures/sample_documents/`)
Documents in various formats for testing:
- Text files with different complexity levels
- Markdown documents with formatting
- HTML documents with structure
- Documents with tables and special content

### Ground Truth (`tests/fixtures/ground_truth/`)
Expected extraction results for effectiveness testing:
- `.expected.txt` files with correct text content
- `test_manifest.json` with test configurations
- Quality thresholds and metrics

## Configuration

### Test Settings
- Timeouts: 30 seconds per test
- Similarity thresholds: 80-95% depending on document type
- Word accuracy thresholds: 70-90%
- Parallel execution: Disabled for consistency

### Environment
- Python 3.10+
- pytest framework
- Docling library
- FastAPI TestClient

## Quality Assurance

The test suite ensures:
- ✅ Functional correctness
- ✅ API contract compliance
- ✅ Text extraction accuracy
- ✅ Performance benchmarks
- ✅ Error handling
- ✅ Regression prevention

## CI/CD Integration

Tests are organized for continuous integration:
1. Unit tests run first (fastest feedback)
2. Integration tests validate components work together
3. API tests ensure endpoint functionality
4. Effectiveness tests validate quality metrics
5. Comprehensive tests verify full system

## Troubleshooting

### Common Issues
1. **Import errors**: Ensure PYTHONPATH includes project root
2. **Missing test files**: Run with `--check-structure` to verify setup
3. **Docling failures**: Check that Docling is properly installed
4. **Timeout errors**: Increase timeout in conftest.py

### Getting Help
- Check test output for specific error messages
- Run individual test files to isolate issues
- Use `--verbose` flag for detailed output
- Review test logs in `.pytest_cache/`
