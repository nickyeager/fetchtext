#!/bin/bash

# Docker Test Runner Script
# Use this when local Python environment is problematic

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
    print_error "Docker test failed at: $1"
    print_error "You can try the following alternatives:"
    echo "  1. Virtual environment: ./setup_test_env.sh"
    echo "  2. Direct Python: python -m pytest tests/"
    echo "  3. Make commands: make test"
    echo "  4. Check PYTHON_TESTING_ALTERNATIVES.md for more options"
    exit 1
}

# Set up error handling
trap 'handle_error "Line $LINENO"' ERR

# Detect project directory (works if run from anywhere)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$SCRIPT_DIR"
IMAGE_NAME="docprocessor-test"
DOCKERFILE="Dockerfile.test"

print_status "🐳 Docker-based testing setup..."
print_status "📁 Project directory: $PROJECT_DIR"

# Check if Docker is available
if ! command -v docker &> /dev/null; then
    print_error "Docker not found. Please install Docker first."
    print_error "Download from: https://www.docker.com/products/docker-desktop"
    exit 1
fi

# Check if Docker is running
if ! docker info >/dev/null 2>&1; then
    print_error "Docker is not running. Please start Docker Desktop."
    exit 1
fi

cd "$PROJECT_DIR"

# Check required files
if [ ! -f "$PROJECT_DIR/requirements.txt" ]; then
    print_error "requirements.txt not found in $PROJECT_DIR"
    exit 1
fi

if [ ! -f "$PROJECT_DIR/$DOCKERFILE" ]; then
    print_error "$DOCKERFILE not found in $PROJECT_DIR"
    print_error "Creating basic Dockerfile.test..."
    
    # Create a basic Dockerfile.test if it doesn't exist
    cat > "$DOCKERFILE" << 'EOF'
FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first for better caching
COPY requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Set environment variables
ENV PYTHONPATH=/app
ENV PYTHONUNBUFFERED=1

# Default command to run tests
CMD ["python", "-m", "pytest", "tests/", "-v"]
EOF
    print_success "✅ Created basic $DOCKERFILE"
fi

# Check if tests directory exists
if [ ! -d "tests" ]; then
    print_error "tests directory not found"
    exit 1
fi

# Clean up any existing containers
print_status "🧹 Cleaning up existing containers..."
docker rm -f "$(docker ps -aq --filter ancestor=$IMAGE_NAME)" 2>/dev/null || true

# Build test image
print_status "🏗️ Building test Docker image..."
if docker build -f "$DOCKERFILE" -t "$IMAGE_NAME" .; then
    print_success "✅ Docker image built successfully"
else
    print_error "Docker image build failed"
    handle_error "Docker build failed"
fi

# Function to run tests in Docker with proper error handling
run_docker_test() {
    local test_name="$1"
    local test_path="$2"
    local extra_args="$3"
    
    print_status "🧪 Running $test_name..."
    
    if docker run --rm -v "$(pwd):/app" "$IMAGE_NAME" python -m pytest "$test_path" -v $extra_args; then
        print_success "✅ $test_name passed"
        return 0
    else
        print_warning "⚠️ $test_name failed"
        return 1
    fi
}

# Track test results
PASSED_TESTS=0
FAILED_TESTS=0

# Run different test suites
print_status "🚀 Starting test execution..."

# Test 1: Unit tests
if [ -d "tests/unit" ]; then
    if run_docker_test "Unit tests" "tests/unit/" "--tb=short"; then
        ((PASSED_TESTS++))
    else
        ((FAILED_TESTS++))
    fi
else
    print_warning "⚠️ Unit tests directory not found, skipping"
fi

# Test 2: Integration tests
if [ -d "tests/integration" ]; then
    if run_docker_test "Integration tests" "tests/integration/" "--tb=short"; then
        ((PASSED_TESTS++))
    else
        ((FAILED_TESTS++))
    fi
else
    print_warning "⚠️ Integration tests directory not found, skipping"
fi

# Test 3: API tests
if [ -f "tests/test_api.py" ]; then
    if run_docker_test "API tests" "tests/test_api.py" "--tb=short"; then
        ((PASSED_TESTS++))
    else
        ((FAILED_TESTS++))
    fi
else
    print_warning "⚠️ API tests file not found, skipping"
fi

# Test 4: Effectiveness tests
if [ -f "tests/test_extraction_effectiveness.py" ]; then
    if run_docker_test "Effectiveness tests" "tests/test_extraction_effectiveness.py" "--tb=short"; then
        ((PASSED_TESTS++))
    else
        ((FAILED_TESTS++))
    fi
else
    print_warning "⚠️ Effectiveness tests file not found, skipping"
fi

# Test 5: All tests with coverage (optional)
print_status "📊 Running comprehensive test suite with coverage..."
if run_docker_test "All tests with coverage" "tests/" "--cov=app --cov-report=term-missing --tb=short"; then
    print_success "✅ Coverage analysis completed"
else
    print_warning "⚠️ Coverage analysis failed, but continuing"
fi

# Summary
print_status "📋 Test Summary:"
print_success "✅ Passed test suites: $PASSED_TESTS"
if [ $FAILED_TESTS -gt 0 ]; then
    print_error "❌ Failed test suites: $FAILED_TESTS"
else
    print_success "✅ Failed test suites: $FAILED_TESTS"
fi

if [ $FAILED_TESTS -eq 0 ]; then
    print_success "🎉 All Docker tests completed successfully!"
else
    print_warning "⚠️ Some tests failed, but Docker environment is working"
fi

print_status "📝 You can also run individual tests with:"
echo "  docker run --rm -v \$(pwd):/app $IMAGE_NAME python -m pytest tests/unit/ -v"
echo "  docker run --rm -v \$(pwd):/app $IMAGE_NAME python -m pytest tests/integration/ -v"
echo "  docker run --rm -v \$(pwd):/app $IMAGE_NAME python -m pytest tests/test_api.py -v"
echo ""
print_status "🚀 For interactive debugging:"
echo "  docker run --rm -it -v \$(pwd):/app $IMAGE_NAME bash"
echo ""
print_status "📚 For more options, see:"
echo "  PYTHON_TESTING_ALTERNATIVES.md"
echo "  QUICK_TEST_REFERENCE.md"

print_status "🧹 Cleaning up..."
docker image prune -f --filter label=stage=test 2>/dev/null || true
