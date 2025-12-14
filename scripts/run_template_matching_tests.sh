#!/bin/bash

# Template Matching E2E Test Runner
# This script starts services and runs comprehensive template matching tests

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Project root
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"

echo -e "${BLUE}🔧 Template Matching E2E Test Runner${NC}"
echo "Project root: $PROJECT_ROOT"

# Function to check if services are running
check_services() {
    echo -e "\n${BLUE}🔍 Checking service status...${NC}"
    
    # Check Document Processor
    if curl -s http://localhost:8090/health > /dev/null 2>&1; then
        echo -e "   Document Processor: ${GREEN}✅ Running${NC}"
        DOCUMENT_PROCESSOR_OK=true
    else
        echo -e "   Document Processor: ${RED}❌ Not running${NC}"
        DOCUMENT_PROCESSOR_OK=false
    fi
    
    # Check Admin Dashboard
    if curl -s http://localhost:5173 > /dev/null 2>&1; then
        echo -e "   Admin Dashboard: ${GREEN}✅ Running${NC}"
        ADMIN_DASHBOARD_OK=true
    else
        echo -e "   Admin Dashboard: ${RED}❌ Not running${NC}"
        ADMIN_DASHBOARD_OK=false
    fi
    
    # Check Supabase (optional)
    if curl -s http://localhost:8000/health > /dev/null 2>&1; then
        echo -e "   Supabase: ${GREEN}✅ Running${NC}"
        SUPABASE_OK=true
    else
        echo -e "   Supabase: ${YELLOW}⚠️ Not running (optional)${NC}"
        SUPABASE_OK=false
    fi
}

# Function to start services
start_services() {
    echo -e "\n${BLUE}🚀 Starting services...${NC}"
    
    # Check if Python script exists
    if [ ! -f "start_services.py" ]; then
        echo -e "${RED}❌ start_services.py not found. Please run from project root.${NC}"
        exit 1
    fi
    
    # Start services with CPU profile
    echo -e "Starting services with CPU profile..."
    python start_services.py --profile cpu --environment local &
    START_SERVICES_PID=$!
    
    # Wait for services to start
    echo -e "Waiting for services to start up..."
    sleep 30
    
    # Check if services are now running
    check_services
    
    if [ "$DOCUMENT_PROCESSOR_OK" = false ]; then
        echo -e "${RED}❌ Document processor failed to start. Check logs.${NC}"
        return 1
    fi
    
    echo -e "${GREEN}✅ Services started successfully${NC}"
    return 0
}

# Function to run template matching tests
run_template_tests() {
    echo -e "\n${BLUE}🧪 Running Template Matching Tests...${NC}"
    
    # Run Python E2E tests
    if [ -f "run_template_matching_e2e.py" ]; then
        echo -e "Running comprehensive Python E2E tests..."
        python run_template_matching_e2e.py
    else
        echo -e "${YELLOW}⚠️ Python E2E script not found, running Vitest tests...${NC}"
    fi
    
    # Run Vitest E2E tests if available
    if [ -d "localai-admin-dashboard" ]; then
        echo -e "\n${BLUE}🎭 Running Frontend E2E Tests...${NC}"
        cd localai-admin-dashboard
        
        # Check if the E2E test exists
        if [ -f "tests/e2e/template-matching-e2e.spec.ts" ]; then
            pnpm test tests/e2e/template-matching-e2e.spec.ts
        else
            echo -e "${YELLOW}⚠️ Frontend E2E test not found${NC}"
        fi
        
        cd "$PROJECT_ROOT"
    fi
    
    # Run backend integration tests
    if [ -d "document-processor" ]; then
        echo -e "\n${BLUE}🔬 Running Backend Integration Tests...${NC}"
        cd document-processor
        
        if [ -f "test_template_matching_integration.py" ]; then
            python test_template_matching_integration.py
        else
            echo -e "${YELLOW}⚠️ Backend integration test not found${NC}"
        fi
        
        cd "$PROJECT_ROOT"
    fi
}

# Function to show test data info
show_test_data() {
    echo -e "\n${BLUE}📄 Test Documents Available:${NC}"
    
    if [ -d "data" ]; then
        echo "Sample documents:"
        for file in data/sample_*.txt; do
            if [ -f "$file" ]; then
                filename=$(basename "$file")
                echo -e "   📄 $filename"
            fi
        done
        
        echo "Real documents:"
        for file in data/*.pdf; do
            if [ -f "$file" ]; then
                filename=$(basename "$file")
                echo -e "   📎 $filename"
            fi
        done
    else
        echo -e "${RED}❌ Data directory not found${NC}"
    fi
}

# Function to run manual test
run_manual_test() {
    echo -e "\n${BLUE}🧪 Running Manual Template Matching Test...${NC}"
    
    if [ ! -f "data/sample_invoice.txt" ]; then
        echo -e "${RED}❌ Test document not found: data/sample_invoice.txt${NC}"
        return 1
    fi
    
    echo "Testing invoice document with template matching..."
    
    # Use curl to test the API directly
    curl -X POST \
        -F "file=@data/sample_invoice.txt" \
        http://localhost:8090/api/enhanced-documents/evaluate-document-type \
        -H "Content-Type: multipart/form-data" \
        | jq '.' 2>/dev/null || echo "Response received (install jq for formatted output)"
}

# Main execution
main() {
    echo -e "${BLUE}🎯 Template Matching E2E Test Suite${NC}"
    echo "This script will:"
    echo "1. Check service status"
    echo "2. Start services if needed"
    echo "3. Run comprehensive template matching tests"
    echo "4. Show test results and analysis"
    
    # Parse command line arguments
    SKIP_SERVICE_START=false
    MANUAL_TEST_ONLY=false
    
    for arg in "$@"; do
        case $arg in
            --skip-start)
                SKIP_SERVICE_START=true
                shift
                ;;
            --manual-only)
                MANUAL_TEST_ONLY=true
                shift
                ;;
            --help|-h)
                echo -e "\nUsage: $0 [OPTIONS]"
                echo "Options:"
                echo "  --skip-start    Skip starting services (assume already running)"
                echo "  --manual-only   Run only manual curl test"
                echo "  --help          Show this help"
                exit 0
                ;;
        esac
    done
    
    # Show test data info
    show_test_data
    
    # Check current service status
    check_services
    
    # Start services if needed
    if [ "$SKIP_SERVICE_START" = false ] && [ "$DOCUMENT_PROCESSOR_OK" = false ]; then
        echo -e "\n${YELLOW}⚠️ Document processor not running. Starting services...${NC}"
        if ! start_services; then
            echo -e "${RED}❌ Failed to start services${NC}"
            exit 1
        fi
    fi
    
    # Run tests based on mode
    if [ "$MANUAL_TEST_ONLY" = true ]; then
        run_manual_test
    else
        # Check services are ready
        if [ "$DOCUMENT_PROCESSOR_OK" = false ]; then
            echo -e "${RED}❌ Document processor is not running. Cannot run tests.${NC}"
            echo -e "Try running: ${BLUE}$0${NC} (without --skip-start)"
            exit 1
        fi
        
        run_template_tests
    fi
    
    echo -e "\n${GREEN}🎉 Template Matching E2E Tests Complete!${NC}"
}

# Cleanup function
cleanup() {
    echo -e "\n${YELLOW}🧹 Cleaning up...${NC}"
    if [ ! -z "${START_SERVICES_PID:-}" ]; then
        echo "Stopping services..."
        kill $START_SERVICES_PID 2>/dev/null || true
    fi
}

# Set trap for cleanup
trap cleanup EXIT

# Run main function
main "$@"