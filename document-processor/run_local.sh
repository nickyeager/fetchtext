#!/bin/bash
# Quick script to run FastAPI locally for testing
# Install dependencies first: pip install -r requirements.txt

echo "🚀 Starting FastAPI development server..."
echo "📝 API docs will be available at: http://localhost:8000/docs"
echo "🔍 Health check: http://localhost:8000/health"
echo ""

cd "$(dirname "$0")"
export PYTHONPATH="$(pwd):$PYTHONPATH"
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
