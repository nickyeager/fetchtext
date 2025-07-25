# Python Testing Alternatives Guide

## Issue Description
The current Python environment appears to be hanging when running tests or Python commands. This guide provides multiple alternative approaches to set up and run Python tests.

## Alternative 1: Virtual Environment (Recommended)

### Create and Activate Virtual Environment
```bash
# Navigate to project directory
cd /Users/nickyeager/Code/agents/local-ai-packaged/document-processor

# Create virtual environment
python3 -m venv venv

# Activate virtual environment (macOS/Linux)
source venv/bin/activate

# Upgrade pip
pip install --upgrade pip

# Install dependencies
pip install -r requirements.txt
```

### Run Tests in Virtual Environment
```bash
# With virtual environment activated
pytest tests/
pytest tests/unit/
pytest tests/integration/
pytest tests/test_api.py

# Or run specific test files
pytest tests/unit/test_docling_converter.py -v
pytest tests/integration/test_docling_integration.py -v
```

## Alternative 2: Conda Environment

### Create Conda Environment
```bash
# Create conda environment
conda create -n docprocessor python=3.11

# Activate conda environment
conda activate docprocessor

# Install pip packages
pip install -r requirements.txt

# Or install with conda where possible
conda install fastapi uvicorn pytest httpx
pip install docling  # Not available in conda
```

### Run Tests in Conda Environment
```bash
# With conda environment activated
pytest tests/
python -m pytest tests/unit/
python -m pytest tests/integration/ -v
```

## Alternative 3: Docker-Based Testing

### Create Docker Testing Container
```bash
# Build test container
docker build -t docprocessor-test .

# Run tests in container
docker run --rm -v $(pwd):/app docprocessor-test pytest tests/

# Interactive testing
docker run --rm -it -v $(pwd):/app docprocessor-test bash
# Inside container: pytest tests/
```

## Alternative 4: Poetry Environment

### Install Poetry and Set Up Environment
```bash
# Install poetry (if not installed)
curl -sSL https://install.python-poetry.org | python3 -

# Initialize poetry project (if pyproject.toml doesn't have poetry config)
poetry init

# Install dependencies
poetry install

# Run tests
poetry run pytest tests/
poetry run python -m pytest tests/unit/ -v
```

## Alternative 5: Direct Python Module Execution

### Run Tests as Python Modules
```bash
# Run pytest as module
python -m pytest tests/
python -m pytest tests/unit/test_docling_converter.py
python -m pytest tests/integration/ -v

# Run specific test functions
python -m pytest tests/unit/test_docling_converter.py::test_converter_initialization -v
```

## Alternative 6: System Python with User Installation

### Install to User Directory
```bash
# Install packages to user directory
pip install --user -r requirements.txt

# Run tests
python -m pytest tests/
~/.local/bin/pytest tests/
```

## Alternative 7: Pyenv for Python Version Management

### Install and Use Pyenv
```bash
# Install pyenv (if not installed)
curl https://pyenv.run | bash

# Install Python version
pyenv install 3.11.7
pyenv local 3.11.7

# Install dependencies
pip install -r requirements.txt

# Run tests
pytest tests/
```

## Troubleshooting Commands

### Debug Python Environment
```bash
# Check Python version and location
python --version
which python
python -c "import sys; print(sys.executable)"

# Check pip packages
pip list
pip show pytest

# Check Python path
python -c "import sys; print('\n'.join(sys.path))"

# Test pytest installation
python -c "import pytest; print(pytest.__version__)"
```

### Test Basic Functionality
```bash
# Test basic Python execution
python -c "print('Hello World')"

# Test imports
python -c "import pytest; import docling; print('All imports successful')"

# Test pytest discovery
python -m pytest --collect-only tests/
```

## Alternative Test Runners

### Using unittest (Built-in)
```bash
# Convert pytest tests to unittest if needed
python -m unittest discover tests/
```

### Using nose2
```bash
pip install nose2
nose2 tests/
```

### Using tox (Multiple Environments)
```bash
pip install tox
tox  # Runs tests in multiple Python versions
```

## CI/CD Ready Commands

### GitHub Actions / CI
```yaml
# .github/workflows/test.yml
- name: Set up Python
  uses: actions/setup-python@v4
  with:
    python-version: '3.11'

- name: Install dependencies
  run: |
    python -m pip install --upgrade pip
    pip install -r requirements.txt

- name: Run tests
  run: |
    python -m pytest tests/ --cov=app --cov-report=xml
```

### Make Commands
Create a `Makefile`:
```makefile
.PHONY: test test-unit test-integration test-api

test:
	python -m pytest tests/

test-unit:
	python -m pytest tests/unit/

test-integration:
	python -m pytest tests/integration/

test-api:
	python -m pytest tests/test_api.py

install:
	pip install -r requirements.txt

setup-dev:
	python -m venv venv
	source venv/bin/activate && pip install -r requirements.txt
```

## Quick Start Recommendations

1. **Start with Virtual Environment**: Most reliable and isolated
2. **Use Docker**: If local Python is problematic
3. **Try Conda**: If you're already using Anaconda/Miniconda
4. **Use Poetry**: For modern dependency management

## Next Steps

1. Choose one of the alternatives above
2. Set up the environment
3. Run a simple test: `python -c "import pytest; print('OK')"`
4. Run basic tests: `pytest tests/unit/test_models.py -v`
5. Gradually run more complex tests

The virtual environment approach is recommended as it provides the cleanest isolation and is most commonly used in Python development.
