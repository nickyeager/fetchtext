#!/bin/bash

# Copy and paste these commands one by one into your terminal

echo "🚀 Running Document Processor Tests"
echo "==================================="

# Navigate to project directory
cd /Users/nickyeager/Code/agents/local-ai-packaged/document-processor

# Option 1: Try Docker approach (recommended)
echo "📋 Option 1: Docker Testing"
echo "docker build -f Dockerfile.test -t docprocessor-test ."
echo "docker run --rm -v \$(pwd):/app docprocessor-test pytest tests/unit/ -v"

echo ""
echo "📋 Option 2: Direct Python (if Docker unavailable)"
echo "python3 -m pytest tests/unit/test_models.py -v"

echo ""
echo "📋 Option 3: Virtual Environment"
echo "python3 -m venv test_venv"
echo "source test_venv/bin/activate"
echo "pip install -r requirements.txt"
echo "pytest tests/"

echo ""
echo "📋 Option 4: Make commands"
echo "make test-docker"
echo "make test-unit"

echo ""
echo "📋 Quick Verification"
echo "python3 -c \"import sys; print('Python:', sys.version)\""
echo "python3 -c \"from pathlib import Path; print('Path works:', Path('.').exists())\""

echo ""
echo "🎯 Expected Results:"
echo "- Tests should run and show pass/fail status"
echo "- Service should initialize with or without Docling"
echo "- No import errors should occur"
echo "- Docker approach should work even if local Python fails"
