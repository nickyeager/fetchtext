.PHONY: help setup test test-unit test-integration test-api test-docker test-comprehensive clean

help:
	@echo "Available commands:"
	@echo "  setup         - Set up virtual environment and install dependencies"
	@echo "  test          - Run all tests (virtual environment)"
	@echo "  test-unit     - Run unit tests only"
	@echo "  test-integration - Run integration tests only"
	@echo "  test-api      - Run API tests only"
	@echo "  test-effectiveness - Run effectiveness tests only"
	@echo "  test-docker   - Run tests in Docker container"
	@echo "  test-comprehensive - Try all testing approaches"
	@echo "  clean         - Remove virtual environment and cache files"
	@echo ""
	@echo "Quick setup commands:"
	@echo "  make setup-quick  - Quick setup with timeout protection"
	@echo "  make test-quick   - Quick test with fallback options"

setup:
	./setup_test_env.sh

setup-quick:
	python3 -m venv venv || echo "Virtual env creation failed"
	./venv/bin/pip install --upgrade pip || echo "Pip upgrade failed"
	./venv/bin/pip install -r requirements.txt || echo "Requirements install failed"

test:
	./venv/bin/python -m pytest tests/ -v

test-unit:
	./venv/bin/python -m pytest tests/unit/ -v

test-integration:
	./venv/bin/python -m pytest tests/integration/ -v

test-api:
	./venv/bin/python -m pytest tests/test_api.py -v

test-effectiveness:
	./venv/bin/python -m pytest tests/test_extraction_effectiveness.py -v

test-docker:
	./run_docker_tests.sh

test-comprehensive:
	./run_comprehensive_tests.sh

test-coverage:
	./venv/bin/python -m pytest tests/ --cov=app --cov-report=html --cov-report=term-missing

clean:
	rm -rf venv/
	rm -rf __pycache__/
	rm -rf .pytest_cache/
	rm -rf htmlcov/
	rm -rf .coverage
	find . -name "*.pyc" -delete
	find . -name "__pycache__" -type d -exec rm -rf {} +
	docker rmi docprocessor-test 2>/dev/null || true

# Alternative commands for when venv activation is problematic
test-direct:
	python -m pytest tests/ -v

test-quick:
	python -m pytest tests/unit/test_models.py -v --tb=short || \
	python3 -m pytest tests/unit/test_models.py -v --tb=short || \
	./run_docker_tests.sh

test-user:
	python -m pytest tests/ -v --tb=short

install-user:
	pip install --user -r requirements.txt

# Docker-specific commands
docker-build:
	docker build -f Dockerfile.test -t docprocessor-test .

docker-run:
	docker run --rm -it -v $(shell pwd):/app docprocessor-test bash

docker-test-unit:
	docker run --rm -v $(shell pwd):/app docprocessor-test python -m pytest tests/unit/ -v

docker-test-integration:
	docker run --rm -v $(shell pwd):/app docprocessor-test python -m pytest tests/integration/ -v
