#!/bin/bash
# Comprehensive test runner for local-ai-packaged
# Run with: ./scripts/run-all-tests.sh

set -e

echo "======================================"
echo "🧪 Running All Tests - $(date)"
echo "======================================"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Track results
PYTHON_RESULT=0
E2E_RESULT=0

# 1. Python Integration Tests
echo ""
echo "🐍 Running Python Integration Tests..."
echo "--------------------------------------"
cd /Users/nickyeager/Code/agents/local-ai-packaged/document-processor

if python -m pytest tests/integration/ -v --tb=line 2>&1 | tee /tmp/python-test-results.txt; then
    echo -e "${GREEN}✅ Python integration tests passed${NC}"
else
    echo -e "${YELLOW}⚠️ Some Python integration tests failed${NC}"
    PYTHON_RESULT=1
fi

# Count results
PYTHON_PASSED=$(grep -c "PASSED" /tmp/python-test-results.txt 2>/dev/null || echo "0")
PYTHON_FAILED=$(grep -c "FAILED" /tmp/python-test-results.txt 2>/dev/null || echo "0")
echo "Python: $PYTHON_PASSED passed, $PYTHON_FAILED failed"

# 2. Playwright E2E Tests (critical paths only)
echo ""
echo "🎭 Running Critical Playwright E2E Tests..."
echo "--------------------------------------------"
cd /Users/nickyeager/Code/agents/local-ai-packaged/localai-admin-dashboard

export TEST_USER_EMAIL="admin@fetchtext.local"
export TEST_USER_PASSWORD="testpass123"

# Run auth and settings tests
if npx playwright test tests/e2e/auth/00-auth-smoke.pw.spec.ts tests/e2e/settings/org-llm-config.pw.spec.ts --reporter=line 2>&1 | tee /tmp/e2e-test-results.txt; then
    echo -e "${GREEN}✅ E2E tests passed${NC}"
else
    echo -e "${RED}❌ E2E tests failed${NC}"
    E2E_RESULT=1
fi

# Summary
echo ""
echo "======================================"
echo "📊 Test Summary"
echo "======================================"
echo "Python Integration: $PYTHON_PASSED passed, $PYTHON_FAILED failed"
grep -E "^\s+\d+ passed" /tmp/e2e-test-results.txt 2>/dev/null || echo "E2E: check logs above"

if [ $PYTHON_RESULT -eq 0 ] && [ $E2E_RESULT -eq 0 ]; then
    echo -e "${GREEN}✅ All critical tests passed!${NC}"
    exit 0
else
    echo -e "${YELLOW}⚠️ Some tests need attention${NC}"
    exit 1
fi
