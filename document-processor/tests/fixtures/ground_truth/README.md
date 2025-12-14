# Ground Truth Test Data

This directory contains reference documents with known expected text content for testing text extraction effectiveness.

## Test Document Structure

Each test document should have:
1. The source document file (PDF, DOCX, etc.)
2. A corresponding `.expected.txt` file with the exact expected text content
3. Metadata about extraction requirements and quality thresholds

## Example Files Structure

```
ground_truth/
├── simple_text.pdf                    # Source document
├── simple_text.expected.txt           # Expected text content
├── formatted_document.docx            # Source document  
├── formatted_document.expected.txt    # Expected text content
├── complex_table.pdf                  # Document with tables
├── complex_table.expected.txt         # Expected content
└── test_manifest.json                 # Test configuration
```

## Test Manifest Example

```json
{
  "tests": [
    {
      "name": "simple_text_pdf",
      "source_file": "simple_text.pdf",
      "expected_file": "simple_text.expected.txt",
      "min_similarity": 0.90,
      "min_word_precision": 0.85,
      "document_type": "pdf",
      "description": "Basic text extraction from simple PDF"
    },
    {
      "name": "formatted_docx",
      "source_file": "formatted_document.docx", 
      "expected_file": "formatted_document.expected.txt",
      "min_similarity": 0.80,
      "min_word_precision": 0.75,
      "document_type": "docx",
      "description": "Text extraction preserving basic formatting"
    }
  ]
}
```

## Creating Test Documents

To create effective test documents:

1. **Start Simple**: Create basic documents with plain text
2. **Add Complexity Gradually**: Include formatting, lists, tables
3. **Verify Manual Extraction**: Manually verify what the expected output should be
4. **Test Edge Cases**: Include challenging documents (scanned, unusual fonts, etc.)

## Quality Thresholds

Recommended minimum thresholds:
- **PDF (native)**: 90% similarity, 85% word precision
- **PDF (scanned)**: 75% similarity, 70% word precision  
- **DOCX**: 85% similarity, 80% word precision
- **TXT/MD**: 95% similarity, 90% word precision

## Usage in Tests

The effectiveness tests will:
1. Load test configurations from the manifest
2. Process each source document with Docling
3. Compare extracted text against expected content
4. Calculate similarity and accuracy metrics
5. Report results and failures

This enables automated quality assurance and regression testing for text extraction accuracy.
