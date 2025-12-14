#!/bin/bash

# Comprehensive Test Runner
# Tries multiple approaches to run tests, starting with the most reliable

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

print_status "🚀 Comprehensive Test Runner Starting..."
print_status "📁 Project directory: $PROJECT_DIR"

cd "$PROJECT_DIR"

# Function to test an approach
test_approach() {
    local approach_name="$1"
    local test_command="$2"
    
    print_status "🧪 Trying approach: $approach_name"
    
    if eval "$test_command"; then
        print_success "✅ $approach_name succeeded!"
        return 0
    else
        print_warning "⚠️ $approach_name failed"
        return 1
    fi
}

# Approach 1: Docker (most reliable)
print_status "📋 Approach 1: Docker-based testing"
if command -v docker &> /dev/null && docker info >/dev/null 2>&1; then
    if test_approach "Docker tests" "./run_docker_tests.sh"; then
        print_success "🎉 Docker approach succeeded!"
        exit 0
    fi
else
    print_warning "⚠️ Docker not available, skipping Docker approach"
fi

# Approach 2: Virtual environment
print_status "📋 Approach 2: Virtual environment"
if test_approach "Virtual environment setup" "./setup_test_env.sh"; then
    print_success "🎉 Virtual environment approach succeeded!"
    exit 0
fi

# Approach 3: Make commands
print_status "📋 Approach 3: Make commands"
if command -v make &> /dev/null; then
    if test_approach "Make setup and test" "make setup && make test"; then
        print_success "🎉 Make approach succeeded!"
        exit 0
    fi
else
    print_warning "⚠️ Make not available, skipping Make approach"
fi

# Approach 4: Direct Python with user install
print_status "📋 Approach 4: Direct Python with user install"
if test_approach "User install and test" "pip install --user -r requirements.txt && python -m pytest tests/unit/test_models.py -v"; then
    print_success "🎉 Direct Python approach succeeded!"
    exit 0
fi

# Approach 5: System Python
print_status "📋 Approach 5: System Python"
if test_approach "System Python test" "python -m pytest tests/unit/test_models.py -v --tb=short"; then
    print_success "🎉 System Python approach succeeded!"
    exit 0
fi

# Approach 6: Python3 explicit
print_status "📋 Approach 6: Python3 explicit"
if test_approach "Python3 explicit test" "python3 -m pytest tests/unit/test_models.py -v --tb=short"; then
    print_success "🎉 Python3 explicit approach succeeded!"
    exit 0
fi

# If all approaches fail
print_error "❌ All testing approaches failed!"
print_error "🔧 Manual troubleshooting steps:"
echo "1. Check Python installation: python3 --version"
echo "2. Check pip: pip --version"
echo "3. Try manual install: pip install pytest"
echo "4. Check Docker: docker --version"
echo "5. See PYTHON_TESTING_ALTERNATIVES.md for more options"
echo ""
print_error "🏥 Emergency fallback commands:"
echo "  python -c \"import sys; print(sys.version)\""
echo "  python -c \"import pytest; print('pytest available')\""
echo "  ls -la tests/"
echo ""
print_error "📚 Documentation:"
echo "  PYTHON_TESTING_ALTERNATIVES.md"
echo "  QUICK_TEST_REFERENCE.md"

exit 1
