#!/bin/bash

# Test Verification Script
# Quick check to verify if the testing setup is working

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

# Detect project directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$SCRIPT_DIR"

print_status "🔍 Testing setup verification..."
print_status "📁 Project directory: $PROJECT_DIR"

cd "$PROJECT_DIR"

# Check 1: Basic Python
print_status "🐍 Checking Python installation..."
if command -v python3 &> /dev/null; then
    PYTHON_VERSION=$(python3 --version 2>&1)
    print_success "✅ Python3 available: $PYTHON_VERSION"
else
    print_error "❌ Python3 not found"
    exit 1
fi

# Check 2: Project structure
print_status "📂 Checking project structure..."
required_files=("requirements.txt" "pyproject.toml" "tests/")
missing_files=()

for file in "${required_files[@]}"; do
    if [[ -f "$file" || -d "$file" ]]; then
        print_success "✅ Found: $file"
    else
        print_error "❌ Missing: $file"
        missing_files+=("$file")
    fi
done

if [ ${#missing_files[@]} -gt 0 ]; then
    print_error "❌ Missing required files/directories"
    exit 1
fi

# Check 3: Docker availability
print_status "🐳 Checking Docker availability..."
if command -v docker &> /dev/null; then
    if docker info >/dev/null 2>&1; then
        print_success "✅ Docker is available and running"
    else
        print_warning "⚠️ Docker installed but not running"
    fi
else
    print_warning "⚠️ Docker not available"
fi

# Check 4: Test basic Python import
print_status "🧪 Testing basic Python functionality..."
if python3 -c "import sys; print('Python path:', sys.executable)" 2>/dev/null; then
    print_success "✅ Basic Python functionality works"
else
    print_error "❌ Basic Python functionality failed"
    exit 1
fi

# Check 5: Test if we can create a simple venv
print_status "🔧 Testing virtual environment creation..."
if python3 -c "import venv; print('venv module available')" 2>/dev/null; then
    print_success "✅ Virtual environment module available"
else
    print_warning "⚠️ Virtual environment module not available"
fi

# Check 6: Test pip availability
print_status "📦 Testing pip availability..."
if python3 -m pip --version >/dev/null 2>&1; then
    PIP_VERSION=$(python3 -m pip --version 2>&1)
    print_success "✅ Pip available: $PIP_VERSION"
else
    print_warning "⚠️ Pip not available through python3 -m pip"
fi

# Check 7: Test requirements.txt readability
print_status "📋 Testing requirements.txt..."
if python3 -c "
import sys
try:
    with open('requirements.txt', 'r') as f:
        lines = f.readlines()
    print(f'Found {len(lines)} requirements')
    for line in lines[:5]:  # Show first 5
        print(f'  - {line.strip()}')
    if len(lines) > 5:
        print(f'  ... and {len(lines) - 5} more')
except Exception as e:
    print(f'Error reading requirements.txt: {e}')
    sys.exit(1)
" 2>/dev/null; then
    print_success "✅ Requirements.txt is readable"
else
    print_error "❌ Requirements.txt is not readable"
    exit 1
fi

# Check 8: Test directory structure
print_status "📁 Testing test directory structure..."
if [ -d "tests" ]; then
    test_dirs=("tests/unit" "tests/integration" "tests/fixtures")
    for dir in "${test_dirs[@]}"; do
        if [ -d "$dir" ]; then
            print_success "✅ Found: $dir"
        else
            print_warning "⚠️ Missing: $dir"
        fi
    done
else
    print_error "❌ Tests directory not found"
    exit 1
fi

# Summary
print_status "📊 Verification Summary:"
print_success "✅ Basic setup verification completed successfully"
print_status "🚀 You can now try:"
echo "  ./setup_test_env.sh       # Virtual environment approach"
echo "  ./run_docker_tests.sh     # Docker approach"
echo "  ./run_comprehensive_tests.sh  # Try all approaches"
echo "  make test-quick           # Quick test with fallbacks"
echo ""
print_status "📚 For more options, see:"
echo "  PYTHON_TESTING_ALTERNATIVES.md"
echo "  QUICK_TEST_REFERENCE.md"
