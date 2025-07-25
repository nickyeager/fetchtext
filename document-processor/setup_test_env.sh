#!/bin/bash

# Quick Test Environment Setup Script
# This script sets up a virtual environment and runs tests

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
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

# Function to handle errors
handle_error() {
    print_error "Script failed at: $1"
    print_error "You can try the following alternatives:"
    echo "  1. Docker approach: ./run_docker_tests.sh"
    echo "  2. Direct Python: python -m pytest tests/"
    echo "  3. User install: pip install --user -r requirements.txt"
    echo "  4. Check PYTHON_TESTING_ALTERNATIVES.md for more options"
    exit 1
}

# Set up error handling
trap 'handle_error "Line $LINENO"' ERR

# Detect project directory (works if run from anywhere)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$SCRIPT_DIR"
VENV_DIR="$PROJECT_DIR/venv"

print_status "🐍 Setting up Python testing environment..."
print_status "📁 Project directory: $PROJECT_DIR"

# Check if we're in the right directory
if [ ! -f "$PROJECT_DIR/requirements.txt" ]; then
    print_error "requirements.txt not found in $PROJECT_DIR"
    print_error "Please run this script from the document-processor directory"
    exit 1
fi

cd "$PROJECT_DIR"

# Check Python installation
print_status "🔍 Checking Python installation..."
if ! command -v python3 &> /dev/null; then
    print_error "python3 not found. Please install Python 3.11+"
    exit 1
fi

PYTHON_VERSION=$(python3 --version 2>&1 | cut -d' ' -f2)
print_status "📍 Using Python version: $PYTHON_VERSION"

# Create virtual environment if it doesn't exist
if [ ! -d "$VENV_DIR" ]; then
    print_status "📦 Creating virtual environment..."
    python3 -m venv venv || handle_error "Failed to create virtual environment"
else
    print_warning "📦 Virtual environment already exists, using existing one"
fi

# Check if virtual environment was created successfully
if [ ! -f "$VENV_DIR/bin/activate" ]; then
    print_error "Virtual environment creation failed"
    print_error "Trying alternative approaches..."
    
    # Try with different Python versions
    if command -v python3.11 &> /dev/null; then
        print_status "🔄 Trying with python3.11..."
        python3.11 -m venv venv || handle_error "Failed with python3.11"
    elif command -v python3.10 &> /dev/null; then
        print_status "🔄 Trying with python3.10..."
        python3.10 -m venv venv || handle_error "Failed with python3.10"
    else
        handle_error "No suitable Python version found"
    fi
fi

# Activate virtual environment
print_status "🔄 Activating virtual environment..."
source venv/bin/activate || handle_error "Failed to activate virtual environment"

# Verify activation
if [ -z "$VIRTUAL_ENV" ]; then
    print_error "Virtual environment activation failed"
    handle_error "Virtual environment not activated"
fi

print_success "✅ Virtual environment activated: $VIRTUAL_ENV"

# Upgrade pip with timeout
print_status "⬆️ Upgrading pip..."
timeout 60 pip install --upgrade pip || {
    print_warning "Pip upgrade timed out or failed, continuing anyway"
}

# Install dependencies with timeout and retry
print_status "📥 Installing dependencies..."
for i in {1..3}; do
    print_status "📦 Installation attempt $i/3..."
    if timeout 300 pip install -r requirements.txt; then
        print_success "✅ Dependencies installed successfully"
        break
    else
        print_warning "Installation attempt $i failed"
        if [ $i -eq 3 ]; then
            print_error "All installation attempts failed"
            print_error "Try running: pip install --user -r requirements.txt"
            handle_error "Dependency installation failed"
        fi
        sleep 5
    fi
done

# Verify installation
print_status "🔍 Verifying installation..."
if python -c "import pytest; print('✅ pytest available')" 2>/dev/null; then
    print_success "✅ pytest is available"
else
    print_error "pytest not available"
    handle_error "pytest installation verification failed"
fi

# Test docling import (optional)
if python -c "import docling; print('✅ docling available')" 2>/dev/null; then
    print_success "✅ docling is available"
else
    print_warning "⚠️ docling might not be available (will try to install)"
    pip install docling || print_warning "docling installation failed, continuing anyway"
fi

# Check if tests directory exists
if [ ! -d "tests" ]; then
    print_error "tests directory not found"
    handle_error "No tests directory found"
fi

# Run a basic test to verify everything works
print_status "🧪 Running basic verification tests..."

# Test pytest discovery first
if python -m pytest --collect-only tests/ >/dev/null 2>&1; then
    print_success "✅ Test discovery successful"
else
    print_warning "⚠️ Test discovery failed, but continuing"
fi

# Try to run a simple test
TEST_FILES=("tests/unit/test_models.py" "tests/conftest.py" "tests/unit/" "tests/")

for test_file in "${TEST_FILES[@]}"; do
    if [ -f "$test_file" ] || [ -d "$test_file" ]; then
        print_status "🧪 Running test: $test_file"
        if timeout 60 python -m pytest "$test_file" -v --tb=short --maxfail=1; then
            print_success "✅ Basic test passed: $test_file"
            break
        else
            print_warning "⚠️ Test failed or timed out: $test_file"
        fi
    fi
done

print_success "🎉 Setup complete!"
print_status "📝 You can now run tests with:"
echo "  source venv/bin/activate"
echo "  pytest tests/"
echo "  pytest tests/unit/"
echo "  pytest tests/integration/"
echo "  pytest tests/test_api.py"
echo ""
print_status "🚀 Quick test commands:"
echo "  make test              # Run all tests"
echo "  make test-unit         # Run unit tests"
echo "  make test-integration  # Run integration tests"
echo "  make test-api          # Run API tests"
echo ""
print_status "📚 For more options, see:"
echo "  PYTHON_TESTING_ALTERNATIVES.md"
echo "  QUICK_TEST_REFERENCE.md"
