#!/usr/bin/env bash

# Simple E2E Test Runner - Compatible with older bash versions
# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo "🚀 Document Processing E2E Test Runner"
echo "======================================"

# Check if Docker is running
echo "🐳 Checking Docker status..."
if ! docker info > /dev/null 2>&1; then
    echo -e "${RED}✗ Docker is not running. Please start Docker and try again.${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Docker is running${NC}"

# Function to check service
check_service() {
    local service_name="$1"
    local port="$2"
    local endpoint="$3"
    
    echo -n "  Checking $service_name ($port)... "
    
    if curl -s --max-time 10 "http://localhost:${port}${endpoint}" > /dev/null 2>&1; then
        echo -e "${GREEN}✓${NC}"
        return 0
    else
        echo -e "${RED}✗${NC}"
        return 1
    fi
}

# Check core services
echo ""
echo "🔍 Checking service availability..."

all_good=true

# Check N8N
if ! check_service "N8N" "5678" "/healthz"; then
    all_good=false
fi

# Check Ollama
if ! check_service "Ollama" "11434" "/api/tags"; then
    all_good=false
fi

# Check Admin Dashboard
if ! check_service "Admin Dashboard" "5174" "/"; then
    all_good=false
fi

# Check Supabase (Kong Gateway)
if ! check_service "Supabase" "8000" "/rest/v1/"; then
    all_good=false
fi

echo ""

if [ "$all_good" = false ]; then
    echo -e "${YELLOW}⚠️  Some services are not responding. Tests may fail.${NC}"
    echo ""
    read -p "Continue anyway? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Exiting..."
        exit 1
    fi
else
    echo -e "${GREEN}✓ All core services are responding${NC}"
fi

# Run E2E tests
echo ""
echo "🧪 Running E2E tests..."
echo "========================"

if npm test -- --run src/__tests__/e2e/document-processing-e2e.test.tsx; then
    echo ""
    echo -e "${GREEN}🎉 All E2E tests passed!${NC}"
    echo ""
    echo "📋 Test Summary:"
    echo "  ✓ Service health checks"
    echo "  ✓ N8N workflow integration"
    echo "  ✓ Ollama model availability"
    echo "  ✓ Admin dashboard accessibility"
    echo "  ✓ Supabase connectivity"
    exit 0
else
    echo ""
    echo -e "${RED}❌ Some E2E tests failed!${NC}"
    echo ""
    echo "🔧 Troubleshooting tips:"
    echo "  • Check if all Docker services are running: docker compose ps"
    echo "  • Verify service logs: docker compose logs [service-name]"
    echo "  • Ensure N8N workflows are imported and active"
    echo "  • Check Ollama models: curl http://localhost:11434/api/tags"
    exit 1
fi
