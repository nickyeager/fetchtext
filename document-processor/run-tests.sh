#!/bin/bash

# Document Processor Test Runner
# Always runs tests without watch mode

set -e

echo "🧪 Running Document Processor Tests"
echo "⚠️  Tests will run once without watch mode"
echo ""

# Check if we're in a virtual environment
if [[ "$VIRTUAL_ENV" == "" ]]; then
    echo "❌ Please activate a virtual environment first"
    echo "   source venv/bin/activate  # or your venv path"
    exit 1
fi

# Run tests with explicit no-watch options
echo "📋 Running all tests..."
python -m pytest tests/ \
    --strict-markers \
    --strict-config \
    --verbose \
    --tb=short \
    --cov=app \
    --cov-report=term-missing \
    --cov-report=html:htmlcov \
    --cov-report=xml

echo ""
echo "✅ Tests completed successfully!"
echo ""
echo "📊 Coverage reports generated:"
echo "   - Terminal: Coverage summary above"
echo "   - HTML: htmlcov/index.html"
echo "   - XML: coverage.xml"
echo ""
echo "💡 To run specific test files:"
echo "   python -m pytest tests/unit/test_specific.py"
echo "   python -m pytest tests/integration/test_specific.py"
echo ""
echo "💡 To run with different markers:"
echo "   python -m pytest -m unit"
echo "   python -m pytest -m integration"
echo "   python -m pytest -m slow"
echo ""
echo "⚠️  Remember: Always run tests without watch mode!" 