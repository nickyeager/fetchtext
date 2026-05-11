#!/usr/bin/env bash

# E2E Test Runner for Document Processing
# This script ensures all required services are running before executing E2E tests

set -e

echo "🚀 Document Processing E2E Test Runner"
echo "======================================"

# Configuration
SERVICES=(
    "n8n:5678:/health"
    "ollama:11434:/api/tags"
    "admin-dashboard:5174:/"
    "supabase:8000:/health"
)

REQUIRED_SERVICES=("n8n" "ollama" "admin-dashboard")
OPTIONAL_SERVICES=("supabase")

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Service health check function
check_service() {
    local service_name=$1
    local port=$2
    local endpoint=$3
    local url="http://localhost:${port}${endpoint}"
    
    echo -n "  Checking ${service_name}... "
    
    if curl -s --max-time 5 --fail "${url}" > /dev/null 2>&1; then
        echo -e "${GREEN}✓ Running${NC}"
        return 0
    else
        echo -e "${RED}✗ Not responding${NC}"
        return 1
    fi
}

# Check if Docker is running
echo "🐳 Checking Docker status..."
if ! docker info > /dev/null 2>&1; then
    echo -e "${RED}✗ Docker is not running. Please start Docker and try again.${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Docker is running${NC}"

# Check if services are up
echo ""
echo "🔍 Checking service availability..."

declare -A service_status
all_required_up=true

for service_info in "${SERVICES[@]}"; do
    IFS=':' read -r service_name port endpoint <<< "$service_info"
    
    if check_service "$service_name" "$port" "$endpoint"; then
        service_status[$service_name]="up"
    else
        service_status[$service_name]="down"
        
        # Check if this is a required service
        if [[ " ${REQUIRED_SERVICES[@]} " =~ " ${service_name} " ]]; then
            all_required_up=false
        fi
    fi
done

echo ""

# Start services if needed
if [ "$all_required_up" = false ]; then
    echo -e "${YELLOW}⚠️  Some required services are not running.${NC}"
    echo ""
    
    read -p "Would you like to start the services automatically? (y/N): " -n 1 -r
    echo
    
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "🔄 Starting services with docker compose..."
        cd "$(dirname "$0")/../../.." # Go to project root
        
        if docker compose up -d; then
            echo -e "${GREEN}✓ Services started successfully${NC}"
            echo ""
            echo "⏳ Waiting 30 seconds for services to be ready..."
            sleep 30
            
            # Re-check services
            echo "🔍 Re-checking service availability..."
            all_required_up=true
            for service_info in "${SERVICES[@]}"; do
                IFS=':' read -r service_name port endpoint <<< "$service_info"
                
                if check_service "$service_name" "$port" "$endpoint"; then
                    service_status[$service_name]="up"
                else
                    service_status[$service_name]="down"
                    if [[ " ${REQUIRED_SERVICES[@]} " =~ " ${service_name} " ]]; then
                        all_required_up=false
                    fi
                fi
            done
        else
            echo -e "${RED}✗ Failed to start services${NC}"
            exit 1
        fi
    else
        echo ""
        echo -e "${YELLOW}Please start the required services manually:${NC}"
        echo "  cd $(dirname "$0")/../../.. && docker compose up -d"
        echo ""
        echo "Required services:"
        for service in "${REQUIRED_SERVICES[@]}"; do
            if [[ "${service_status[$service]}" == "down" ]]; then
                echo -e "  ${RED}✗ $service${NC}"
            else
                echo -e "  ${GREEN}✓ $service${NC}"
            fi
        done
        exit 1
    fi
fi

# Final service status
echo ""
echo "📊 Final Service Status:"
for service_info in "${SERVICES[@]}"; do
    IFS=':' read -r service_name port endpoint <<< "$service_info"
    status="${service_status[$service_name]}"
    
    if [[ "$status" == "up" ]]; then
        echo -e "  ${GREEN}✓ $service_name${NC} (http://localhost:$port)"
    else
        is_required=false
        if [[ " ${REQUIRED_SERVICES[@]} " =~ " ${service_name} " ]]; then
            is_required=true
        fi
        
        if [ "$is_required" = true ]; then
            echo -e "  ${RED}✗ $service_name${NC} (REQUIRED - http://localhost:$port)"
        else
            echo -e "  ${YELLOW}⚠ $service_name${NC} (optional - http://localhost:$port)"
        fi
    fi
done

# Check if we can proceed
if [ "$all_required_up" = false ]; then
    echo ""
    echo -e "${RED}❌ Cannot proceed: Required services are not available${NC}"
    exit 1
fi

echo ""
echo -e "${GREEN}✅ All required services are running!${NC}"

# Ollama model check
echo ""
echo "🤖 Checking Ollama models..."
if models=$(curl -s "http://localhost:11434/api/tags" | jq -r '.models[].name' 2>/dev/null); then
    if [ -n "$models" ]; then
        echo -e "${GREEN}✓ Available models:${NC}"
        echo "$models" | sed 's/^/  - /'
    else
        echo -e "${YELLOW}⚠️  No models found. You may want to pull a model first:${NC}"
        echo "  docker exec ollama ollama pull qwen2.5:3b-instruct-q4_K_M"
    fi
else
    echo -e "${YELLOW}⚠️  Could not check Ollama models${NC}"
fi

# Run the tests
echo ""
echo "🧪 Running E2E Tests..."
echo "======================"

# Set environment variables for the test
export E2E_MODE=true
export NODE_ENV=test

# Run the E2E tests
cd "$(dirname "$0")/../.."

if npm run test -- src/__tests__/e2e/document-processing-e2e.test.tsx --reporter=verbose; then
    echo ""
    echo -e "${GREEN}🎉 E2E Tests completed successfully!${NC}"
else
    echo ""
    echo -e "${RED}❌ E2E Tests failed${NC}"
    exit 1
fi

echo ""
echo "📋 Test Summary:"
echo "  - Document upload: Tested"
echo "  - Service integration: Tested"  
echo "  - Error handling: Tested"
echo "  - UI workflow: Tested"

if [[ "${service_status[n8n]}" == "up" && "${service_status[ollama]}" == "up" ]]; then
    echo "  - AI extraction: Tested"
else
    echo "  - AI extraction: Skipped (services unavailable)"
fi

echo ""
echo -e "${BLUE}💡 To run tests manually:${NC}"
echo "  npm run test -- src/__tests__/e2e/document-processing-e2e.test.tsx --reporter=verbose"
echo ""
echo -e "${BLUE}💡 To view service logs:${NC}"
echo "  docker compose logs -f [service-name]"
