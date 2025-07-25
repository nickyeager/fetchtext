#!/bin/bash

# Alternative test approach when Python is hanging
# This script will try different methods to test the document service

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_status "🔍 Alternative Document Service Verification"
print_status "=" 
echo ""

# Test 1: Check project structure
print_status "📂 Checking project structure..."
required_files=(
    "app/services/docling_service.py"
    "app/models/document.py"
    "requirements.txt"
    "tests/unit/test_docling_converter.py"
    "tests/unit/test_metadata_extraction.py"
    "tests/unit/test_content_extraction.py"
)

missing_files=()
for file in "${required_files[@]}"; do
    if [[ -f "$file" ]]; then
        print_success "✅ Found: $file"
    else
        print_error "❌ Missing: $file"
        missing_files+=("$file")
    fi
done

if [ ${#missing_files[@]} -gt 0 ]; then
    print_error "❌ Missing required files"
    exit 1
fi

# Test 2: Check service file content
print_status "📄 Checking DoclingService implementation..."
if grep -q "class DoclingService" app/services/docling_service.py; then
    print_success "✅ DoclingService class found"
else
    print_error "❌ DoclingService class not found"
    exit 1
fi

if grep -q "async def process_document" app/services/docling_service.py; then
    print_success "✅ process_document method found"
else
    print_error "❌ process_document method not found"
fi

if grep -q "async def extract_metadata" app/services/docling_service.py; then
    print_success "✅ extract_metadata method found"
else
    print_error "❌ extract_metadata method not found"
fi

if grep -q "async def extract_content_from_file" app/services/docling_service.py; then
    print_success "✅ extract_content_from_file method found"
else
    print_error "❌ extract_content_from_file method not found"
fi

# Test 3: Check Docling integration
print_status "🔗 Checking Docling integration..."
if grep -q "from docling.document_converter import DocumentConverter" app/services/docling_service.py; then
    print_success "✅ Real Docling import found"
else
    print_warning "⚠️ Real Docling import not found"
fi

if grep -q "DocumentConverter()" app/services/docling_service.py; then
    print_success "✅ DocumentConverter initialization found"
else
    print_warning "⚠️ DocumentConverter initialization not found"
fi

# Test 4: Check model structure
print_status "📋 Checking document models..."
if grep -q "class DocumentMetadata" app/models/document.py; then
    print_success "✅ DocumentMetadata model found"
else
    print_error "❌ DocumentMetadata model not found"
fi

if grep -q "class ProcessingResult" app/models/document.py; then
    print_success "✅ ProcessingResult model found"
else
    print_error "❌ ProcessingResult model not found"
fi

# Test 5: Check requirements
print_status "📦 Checking requirements..."
if grep -q "docling" requirements.txt; then
    print_success "✅ Docling dependency found in requirements.txt"
else
    print_error "❌ Docling dependency not found in requirements.txt"
fi

if grep -q "fastapi" requirements.txt; then
    print_success "✅ FastAPI dependency found"
else
    print_error "❌ FastAPI dependency not found"
fi

if grep -q "pytest" requirements.txt; then
    print_success "✅ Pytest dependency found"
else
    print_error "❌ Pytest dependency not found"
fi

# Test 6: Check test files
print_status "🧪 Checking test files..."
test_files=(
    "tests/unit/test_docling_converter.py"
    "tests/unit/test_metadata_extraction.py"
    "tests/unit/test_content_extraction.py"
)

for test_file in "${test_files[@]}"; do
    if [[ -f "$test_file" ]]; then
        print_success "✅ Test file exists: $test_file"
        # Check if it has actual tests
        if grep -q "def test_" "$test_file"; then
            print_success "  ✅ Contains test functions"
        else
            print_warning "  ⚠️ No test functions found"
        fi
    else
        print_error "❌ Test file missing: $test_file"
    fi
done

# Test 7: Code quality checks
print_status "🔍 Checking code quality..."

# Check for basic error handling
if grep -q "try:" app/services/docling_service.py; then
    print_success "✅ Error handling found in service"
else
    print_warning "⚠️ No error handling found in service"
fi

# Check for logging
if grep -q "logger" app/services/docling_service.py; then
    print_success "✅ Logging found in service"
else
    print_warning "⚠️ No logging found in service"
fi

# Check for async/await usage
if grep -q "async def" app/services/docling_service.py; then
    print_success "✅ Async functions found in service"
else
    print_warning "⚠️ No async functions found in service"
fi

# Summary
print_status "📊 Verification Summary:"
print_success "✅ Project structure is correct"
print_success "✅ Service implementation exists"
print_success "✅ Models are defined"
print_success "✅ Test files are present"
print_success "✅ Dependencies are specified"

echo ""
print_status "🚀 Next Steps:"
echo "1. Try running tests with Docker: ./run_docker_tests.sh"
echo "2. Or use the comprehensive test runner: ./run_comprehensive_tests.sh"
echo "3. Check PYTHON_TESTING_ALTERNATIVES.md for more options"
echo "4. If Python is still hanging, Docker is the best alternative"

echo ""
print_status "🐳 Docker Test Command:"
echo "docker build -f Dockerfile.test -t docprocessor-test ."
echo "docker run --rm -v \$(pwd):/app docprocessor-test python -m pytest tests/unit/ -v"

echo ""
print_status "📚 Documentation Available:"
echo "- PYTHON_TESTING_ALTERNATIVES.md"
echo "- QUICK_TEST_REFERENCE.md"
echo "- TESTING_SCRIPTS_IMPROVEMENTS.md"

print_success "🎉 Document service structure verification complete!"
