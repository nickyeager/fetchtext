#!/bin/bash
# Run integration tests for improved extraction inside Docker container
# Usage: ./run_integration_tests.sh

echo "Running E2E Integration Tests for Improved Extraction Pipeline..."
echo "=========================================="

# Run tests inside the document-processor container
docker exec localai-document-processor-1 python -m pytest tests/integration/test_improved_extraction_e2e.py -v -s

echo ""
echo "=========================================="
echo "Integration tests completed!"
