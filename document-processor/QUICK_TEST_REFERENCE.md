# Quick Test Execution Reference

## Problem
Python environment hanging when running tests or Python commands.

## ⚡ Quick Solutions (Choose One)

### 1. Comprehensive Approach (Recommended)
```bash
# Try all approaches automatically
./run_comprehensive_tests.sh
```

### 2. Virtual Environment (Most Common)
```bash
# Run improved setup script
./setup_test_env.sh

# Or manual setup
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
pytest tests/
```

### 3. Docker-Based Testing (Most Reliable)
```bash
# Run improved Docker tests
./run_docker_tests.sh

# Or manual Docker
docker build -f Dockerfile.test -t docprocessor-test .
docker run --rm -v $(pwd):/app docprocessor-test pytest tests/
```

### 4. Make Commands (Easy)
```bash
# Setup and test in one go
make setup
make test

# Or quick test with fallbacks
make test-quick

# Or specific test types
make test-unit
make test-integration
make test-api
```

### 5. Direct Python Module Execution
```bash
# If you already have dependencies installed
python -m pytest tests/
python -m pytest tests/unit/ -v
python -m pytest tests/integration/ -v
```

## 🔧 Available Scripts

### Setup and Verification
- `verify_test_setup.sh` - **START HERE** - Verifies your environment is ready
- `setup_test_env.sh` - Sets up virtual environment with error handling
- `run_docker_tests.sh` - Runs all tests in Docker container
- `run_comprehensive_tests.sh` - Tries all approaches until one works

### Test Execution
- `Makefile` - Provides make commands for common tasks
- Individual pytest commands for specific needs

## 🚀 Step-by-Step Quick Start

### Step 1: Verify Environment
```bash
# Check if your environment is ready
./verify_test_setup.sh
```

### Step 2: Choose Your Approach
```bash
# Option A: Let the script decide
./run_comprehensive_tests.sh

# Option B: Virtual environment (if verify passed)
./setup_test_env.sh

# Option C: Docker (if Docker is available)
./run_docker_tests.sh

# Option D: Make commands
make test-comprehensive
```

### Step 3: Run Specific Tests
```bash
# After setup, run specific test categories
make test-unit              # Unit tests
make test-integration       # Integration tests  
make test-api              # API tests
make test-effectiveness    # Accuracy tests
```

## Test Categories

- **Unit Tests**: `tests/unit/` - Individual component tests
- **Integration Tests**: `tests/integration/` - End-to-end workflow tests
- **API Tests**: `tests/test_api.py` - FastAPI endpoint tests
- **Effectiveness Tests**: `tests/test_extraction_effectiveness.py` - Accuracy tests

## Common Commands

```bash
# Run specific test file
pytest tests/unit/test_docling_converter.py -v

# Run with coverage
pytest tests/ --cov=app --cov-report=html

# Run specific test function
pytest tests/unit/test_models.py::test_document_metadata_creation -v

# Run tests with output
pytest tests/ -v -s

# Run tests and stop on first failure
pytest tests/ -x
```

## Troubleshooting

1. **If Python hangs**: Use Docker approach
2. **If imports fail**: Check virtual environment activation
3. **If tests hang**: Try pytest with `-x` flag to stop on first failure
4. **If dependencies missing**: Re-run pip install or use Docker

## Next Steps

1. Choose one of the above approaches
2. Verify basic functionality: `python -c "import pytest; print('OK')"`
3. Run a simple test: `pytest tests/unit/test_models.py -v`
4. Run full test suite once basic tests work
