#!/bin/bash
# Production Deployment Verification Script
# Checks all production services: Supabase, Azure, GitHub Actions, Local Docker

# Don't use set -e as it breaks arithmetic operations and curl checks
# We handle errors manually with check_fail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Configuration
SUPABASE_PROJECT_ID="your-project-id"
SUPABASE_URL="https://${SUPABASE_PROJECT_ID}.supabase.co"
GITHUB_REPO="nickyeager/fetchtext"
LOCAL_BACKEND_URL="http://localhost:8090"

# Load environment variables if .env exists
if [ -f ".env" ]; then
    while IFS='=' read -r key value; do
        # Skip comments and empty lines
        [[ "$key" =~ ^[[:space:]]*# ]] && continue
        [[ -z "$key" ]] && continue
        # Remove surrounding quotes from value
        value="${value%\"}"
        value="${value#\"}"
        value="${value%\'}"
        value="${value#\'}"
        # Export the variable
        export "$key=$value" 2>/dev/null || true
    done < .env
fi

# Status tracking
TOTAL_CHECKS=0
PASSED_CHECKS=0
FAILED_CHECKS=0
WARNINGS=0

print_header() {
    echo ""
    echo -e "${CYAN}═══════════════════════════════════════════════════════════════${NC}"
    echo -e "${CYAN}  $1${NC}"
    echo -e "${CYAN}═══════════════════════════════════════════════════════════════${NC}"
}

print_section() {
    echo ""
    echo -e "${BLUE}▶ $1${NC}"
    echo -e "${BLUE}─────────────────────────────────────────────────────────────────${NC}"
}

check_pass() {
    echo -e "  ${GREEN}✓${NC} $1"
    PASSED_CHECKS=$((PASSED_CHECKS + 1))
    TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
}

check_fail() {
    echo -e "  ${RED}✗${NC} $1"
    FAILED_CHECKS=$((FAILED_CHECKS + 1))
    TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
}

check_warn() {
    echo -e "  ${YELLOW}⚠${NC} $1"
    WARNINGS=$((WARNINGS + 1))
    TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
}

check_info() {
    echo -e "  ${CYAN}ℹ${NC} $1"
}

# ============================================================================
# SUPABASE CHECKS
# ============================================================================
check_supabase() {
    print_section "Managed Supabase (${SUPABASE_PROJECT_ID})"

    # Check if Supabase URL is reachable (401 means reachable but needs auth - that's OK)
    REST_STATUS=$(curl -s --connect-timeout 5 -o /dev/null -w "%{http_code}" "${SUPABASE_URL}/rest/v1/" 2>&1)
    if [ "$REST_STATUS" = "401" ] || [ "$REST_STATUS" = "200" ]; then
        check_pass "Supabase REST API reachable (HTTP ${REST_STATUS})"
    elif [ "$REST_STATUS" = "000" ]; then
        check_fail "Supabase REST API unreachable (connection failed)"
    else
        check_warn "Supabase REST API returned HTTP ${REST_STATUS}"
    fi

    # Check auth endpoint
    AUTH_STATUS=$(curl -s --connect-timeout 5 -o /dev/null -w "%{http_code}" "${SUPABASE_URL}/auth/v1/health" 2>&1)
    if [ "$AUTH_STATUS" = "200" ]; then
        check_pass "Supabase Auth service healthy (HTTP ${AUTH_STATUS})"
    elif [ "$AUTH_STATUS" = "401" ] || [ "$AUTH_STATUS" = "403" ]; then
        check_pass "Supabase Auth service reachable (HTTP ${AUTH_STATUS} - auth required)"
    elif [ "$AUTH_STATUS" = "000" ]; then
        check_fail "Supabase Auth service unreachable"
    else
        check_warn "Supabase Auth returned HTTP ${AUTH_STATUS}"
    fi

    # Check storage endpoint (use /status for health check)
    STORAGE_STATUS=$(curl -s --connect-timeout 5 -o /dev/null -w "%{http_code}" "${SUPABASE_URL}/storage/v1/status" 2>&1)
    if [ "$STORAGE_STATUS" = "200" ]; then
        check_pass "Supabase Storage service healthy (HTTP ${STORAGE_STATUS})"
    elif [ "$STORAGE_STATUS" = "401" ] || [ "$STORAGE_STATUS" = "400" ]; then
        check_pass "Supabase Storage service reachable (HTTP ${STORAGE_STATUS})"
    elif [ "$STORAGE_STATUS" = "000" ]; then
        check_fail "Supabase Storage unreachable"
    else
        check_warn "Supabase Storage returned HTTP ${STORAGE_STATUS}"
    fi

    # Check if we can list tables (requires ANON_KEY)
    if [ -n "$VITE_SUPABASE_ANON_KEY" ] || [ -n "$ANON_KEY" ]; then
        KEY="${VITE_SUPABASE_ANON_KEY:-$ANON_KEY}"
        TABLES_RESPONSE=$(curl -s --connect-timeout 10 \
            "${SUPABASE_URL}/rest/v1/smart_templates?select=id&limit=1" \
            -H "apikey: ${KEY}" \
            -H "Authorization: Bearer ${KEY}" 2>&1)

        if echo "$TABLES_RESPONSE" | grep -q "id"; then
            check_pass "Database tables accessible (smart_templates)"
        elif echo "$TABLES_RESPONSE" | grep -q "permission denied"; then
            check_warn "RLS blocking access (expected for anon)"
        else
            check_fail "Database query failed: ${TABLES_RESPONSE:0:100}"
        fi
    else
        check_warn "No ANON_KEY found - skipping database checks"
    fi

    check_info "Dashboard: https://app.supabase.com/project/${SUPABASE_PROJECT_ID}"
}

# ============================================================================
# GITHUB ACTIONS CHECKS
# ============================================================================
check_github_actions() {
    print_section "GitHub Actions Deployments"

    # Check if gh CLI is available
    if ! command -v gh &> /dev/null; then
        check_warn "GitHub CLI (gh) not installed - using API directly"

        # Use API directly
        DASHBOARD_RUNS=$(curl -s "https://api.github.com/repos/${GITHUB_REPO}/actions/workflows/deploy-dashboard.yml/runs?per_page=1" 2>&1)
        BACKEND_RUNS=$(curl -s "https://api.github.com/repos/${GITHUB_REPO}/actions/workflows/deploy-container-app.yml/runs?per_page=1" 2>&1)

        if echo "$DASHBOARD_RUNS" | grep -q '"conclusion":"success"'; then
            check_pass "Dashboard deployment: SUCCESS"
            DASH_DATE=$(echo "$DASHBOARD_RUNS" | grep -o '"created_at":"[^"]*"' | head -1 | cut -d'"' -f4)
            check_info "Last deployed: ${DASH_DATE}"
        elif echo "$DASHBOARD_RUNS" | grep -q '"conclusion":"failure"'; then
            check_fail "Dashboard deployment: FAILED"
        else
            check_warn "Dashboard deployment status unknown"
        fi

        if echo "$BACKEND_RUNS" | grep -q '"conclusion":"success"'; then
            check_pass "Backend deployment: SUCCESS"
            BACK_DATE=$(echo "$BACKEND_RUNS" | grep -o '"created_at":"[^"]*"' | head -1 | cut -d'"' -f4)
            check_info "Last deployed: ${BACK_DATE}"
        elif echo "$BACKEND_RUNS" | grep -q '"conclusion":"failure"'; then
            check_fail "Backend deployment: FAILED"
        else
            check_warn "Backend deployment status unknown"
        fi
    else
        # Use gh CLI
        echo "  Checking workflow runs..."

        DASH_STATUS=$(gh run list --repo "${GITHUB_REPO}" --workflow "deploy-dashboard.yml" --limit 1 --json status,conclusion,createdAt 2>&1)
        if echo "$DASH_STATUS" | grep -q '"conclusion":"success"'; then
            check_pass "Dashboard deployment: SUCCESS"
        elif echo "$DASH_STATUS" | grep -q '"conclusion":"failure"'; then
            check_fail "Dashboard deployment: FAILED"
        else
            check_warn "Dashboard deployment: ${DASH_STATUS:0:50}"
        fi

        BACK_STATUS=$(gh run list --repo "${GITHUB_REPO}" --workflow "deploy-container-app.yml" --limit 1 --json status,conclusion,createdAt 2>&1)
        if echo "$BACK_STATUS" | grep -q '"conclusion":"success"'; then
            check_pass "Backend deployment: SUCCESS"
        elif echo "$BACK_STATUS" | grep -q '"conclusion":"failure"'; then
            check_fail "Backend deployment: FAILED"
        else
            check_warn "Backend deployment: ${BACK_STATUS:0:50}"
        fi
    fi

    check_info "Actions: https://github.com/${GITHUB_REPO}/actions"
}

# ============================================================================
# AZURE SERVICES CHECKS
# ============================================================================
check_azure_services() {
    print_section "Azure Cloud Services"

    # Check if Azure CLI is available and logged in
    if command -v az &> /dev/null; then
        if az account show > /dev/null 2>&1; then
            check_pass "Azure CLI authenticated"

            # Check Container App
            if [ -n "$AZURE_CONTAINERAPP_NAME" ] && [ -n "$AZURE_CONTAINERAPPS_RESOURCE_GROUP" ]; then
                APP_STATUS=$(az containerapp show \
                    --name "$AZURE_CONTAINERAPP_NAME" \
                    --resource-group "$AZURE_CONTAINERAPPS_RESOURCE_GROUP" \
                    --query "properties.runningStatus" -o tsv 2>&1)

                if [ "$APP_STATUS" = "Running" ]; then
                    check_pass "Container App: Running"
                else
                    check_fail "Container App: ${APP_STATUS}"
                fi

                # Get Container App URL
                APP_URL=$(az containerapp show \
                    --name "$AZURE_CONTAINERAPP_NAME" \
                    --resource-group "$AZURE_CONTAINERAPPS_RESOURCE_GROUP" \
                    --query "properties.configuration.ingress.fqdn" -o tsv 2>&1)

                if [ -n "$APP_URL" ]; then
                    check_info "Backend URL: https://${APP_URL}"

                    # Check basic health endpoint
                    HEALTH=$(curl -s --connect-timeout 10 "https://${APP_URL}/health" 2>&1)
                    if echo "$HEALTH" | grep -qi "healthy\|ok\|status"; then
                        check_pass "Backend health endpoint responding"
                    else
                        check_warn "Backend health check: ${HEALTH:0:50}"
                    fi

                    # Check readiness endpoint for service dependencies
                    READY=$(curl -s --connect-timeout 15 "https://${APP_URL}/health/ready" 2>&1)
                    if echo "$READY" | grep -q '"status"'; then
                        READY_STATUS=$(echo "$READY" | grep -o '"status":"[^"]*"' | head -1 | cut -d'"' -f4)
                        if [ "$READY_STATUS" = "ready" ]; then
                            check_pass "All backend services ready"
                        elif [ "$READY_STATUS" = "degraded" ]; then
                            check_warn "Backend degraded: some services unavailable"
                        else
                            check_fail "Backend not ready: $READY_STATUS"
                        fi

                        # Check Azure OpenAI specifically
                        if echo "$READY" | grep -q '"azure_openai":true'; then
                            check_pass "Azure OpenAI: configured"
                        else
                            MISSING=$(echo "$READY" | grep -o '"azure_openai_missing":\[[^]]*\]' || echo "")
                            check_fail "Azure OpenAI: NOT configured ${MISSING}"
                        fi

                        # Check database
                        if echo "$READY" | grep -q '"database":true'; then
                            check_pass "Database (Supabase): connected"
                        else
                            check_fail "Database (Supabase): NOT connected"
                        fi

                        # Check Qdrant (optional)
                        if echo "$READY" | grep -q '"qdrant":true'; then
                            check_pass "Qdrant vector search: available"
                        else
                            check_info "Qdrant vector search: unavailable (optional)"
                        fi
                    else
                        check_warn "Readiness endpoint not responding: ${READY:0:80}"
                    fi
                fi
            else
                check_warn "Container App env vars not set (AZURE_CONTAINERAPP_NAME, AZURE_CONTAINERAPPS_RESOURCE_GROUP)"
            fi

            # Check Static Web App
            if [ -n "$AZURE_STATIC_WEB_APP_NAME" ]; then
                SWA_STATUS=$(az staticwebapp show \
                    --name "$AZURE_STATIC_WEB_APP_NAME" \
                    --query "sku.tier" -o tsv 2>&1)

                if [ -n "$SWA_STATUS" ]; then
                    check_pass "Static Web App: Active (${SWA_STATUS})"
                else
                    check_warn "Static Web App status check failed"
                fi
            else
                check_warn "AZURE_STATIC_WEB_APP_NAME not set - skipping SWA check"
            fi

            # List Azure OpenAI resources (for provisioned instances)
            echo ""
            echo "  Checking Azure OpenAI provisioned instances..."
            OPENAI_RESOURCES=$(az cognitiveservices account list \
                --query "[?kind=='OpenAI'].{name:name,location:location,sku:sku.name}" \
                -o table 2>&1)

            if echo "$OPENAI_RESOURCES" | grep -q "Name"; then
                check_pass "Azure OpenAI resources found"
                echo "$OPENAI_RESOURCES" | while read -r line; do
                    check_info "$line"
                done
            else
                check_info "No Azure OpenAI resources provisioned (or no permissions)"
            fi

        else
            check_warn "Azure CLI not logged in - run 'az login'"
        fi
    else
        check_warn "Azure CLI not installed - skipping Azure checks"
        check_info "Install with: brew install azure-cli"
    fi
}

# ============================================================================
# LOCAL DOCKER SERVICES CHECKS
# ============================================================================
check_local_docker() {
    print_section "Local Docker Services"

    if ! command -v docker &> /dev/null; then
        check_warn "Docker not installed"
        return
    fi

    if ! docker info > /dev/null 2>&1; then
        check_warn "Docker not running"
        return
    fi

    # Check if localai project containers are running
    CONTAINERS=$(docker compose -p localai ps --format json 2>/dev/null || echo "")

    if [ -z "$CONTAINERS" ]; then
        check_info "No local Docker services running (localai project)"
        return
    fi

    # Check key services
    for SERVICE in "document-processor" "supabase-kong" "supabase-db" "ollama" "n8n"; do
        STATUS=$(docker compose -p localai ps "$SERVICE" --format "{{.Status}}" 2>/dev/null || echo "")

        if echo "$STATUS" | grep -qi "up\|running\|healthy"; then
            check_pass "Local $SERVICE: Running"
        elif [ -z "$STATUS" ]; then
            check_info "Local $SERVICE: Not deployed"
        else
            check_fail "Local $SERVICE: ${STATUS}"
        fi
    done

    # Check local document processor health
    HEALTH=$(curl -s --connect-timeout 5 "${LOCAL_BACKEND_URL}/health" 2>&1)
    if echo "$HEALTH" | grep -qi "healthy\|ok"; then
        check_pass "Local backend health: OK"
    elif [ -n "$HEALTH" ]; then
        check_warn "Local backend: ${HEALTH:0:50}"
    fi
}

# ============================================================================
# DATABASE MIGRATION SYNC CHECK
# ============================================================================
check_migration_sync() {
    print_section "Database Migration Sync"

    # Count local migration files
    LOCAL_MIGRATIONS=$(ls -1 supabase/migrations/*.sql 2>/dev/null | wc -l | tr -d ' ')
    check_info "Local migration files: ${LOCAL_MIGRATIONS}"

    # Check deployment log
    if [ -f "docs/supabase-deployment-log.md" ]; then
        DEPLOYED=$(grep -c "\[x\].*Applied to Supabase" docs/supabase-deployment-log.md 2>/dev/null || echo "0")
        check_info "Documented deployments: ${DEPLOYED}"

        # Find latest migration in deployment log
        LATEST_DEPLOYED=$(grep -o "[0-9]\{3\}_[a-z_]*\.sql" docs/supabase-deployment-log.md | tail -1 || echo "unknown")
        check_info "Latest documented migration: ${LATEST_DEPLOYED}"
    else
        check_warn "Deployment log not found (docs/supabase-deployment-log.md)"
    fi

    # List pending migrations
    LATEST_LOCAL=$(ls -1 supabase/migrations/*.sql 2>/dev/null | tail -1 | xargs basename 2>/dev/null || echo "none")
    check_info "Latest local migration: ${LATEST_LOCAL}"

    if [ "$LATEST_LOCAL" != "$LATEST_DEPLOYED" ] && [ "$LATEST_DEPLOYED" != "unknown" ]; then
        check_warn "Potential migration drift detected - check deployment log"
    fi
}

# ============================================================================
# SECRETS VERIFICATION
# ============================================================================
check_secrets() {
    print_section "Environment & Secrets"

    # Check .env file
    if [ -f ".env" ]; then
        check_pass ".env file exists"
    else
        check_fail ".env file missing"
    fi

    # Check frontend env
    if [ -f "dashboard/.env.local" ]; then
        check_pass "Frontend .env.local exists"
    else
        check_warn "Frontend .env.local missing"
    fi

    # Check critical env vars
    REQUIRED_VARS=(
        "ANON_KEY"
        "JWT_SECRET"
        "POSTGRES_PASSWORD"
    )

    for VAR in "${REQUIRED_VARS[@]}"; do
        if [ -n "${!VAR}" ]; then
            check_pass "$VAR is set"
        else
            check_warn "$VAR not set in environment"
        fi
    done

    # Check Azure vars (optional)
    AZURE_VARS=(
        "AZURE_OPENAI_API_KEY"
        "AZURE_OPENAI_ENDPOINT"
    )

    for VAR in "${AZURE_VARS[@]}"; do
        if [ -n "${!VAR}" ]; then
            check_pass "$VAR is configured"
        else
            check_info "$VAR not set (optional for Azure OpenAI)"
        fi
    done
}

# ============================================================================
# MAIN
# ============================================================================
main() {
    print_header "FetchText Production Verification"
    echo -e "  ${CYAN}Timestamp:${NC} $(date '+%Y-%m-%d %H:%M:%S %Z')"
    echo -e "  ${CYAN}Project:${NC} ${GITHUB_REPO}"

    check_supabase
    check_github_actions
    check_azure_services
    check_local_docker
    check_migration_sync
    check_secrets

    # Summary
    print_header "Verification Summary"
    echo -e "  ${GREEN}Passed:${NC}   ${PASSED_CHECKS}"
    echo -e "  ${RED}Failed:${NC}   ${FAILED_CHECKS}"
    echo -e "  ${YELLOW}Warnings:${NC} ${WARNINGS}"
    echo -e "  ${CYAN}Total:${NC}    ${TOTAL_CHECKS}"
    echo ""

    if [ "$FAILED_CHECKS" -gt 0 ]; then
        echo -e "${RED}⚠ Some checks failed - review above for details${NC}"
        exit 1
    elif [ "$WARNINGS" -gt 0 ]; then
        echo -e "${YELLOW}⚡ All critical checks passed with warnings${NC}"
        exit 0
    else
        echo -e "${GREEN}✓ All checks passed!${NC}"
        exit 0
    fi
}

# Run with optional flags
case "${1:-}" in
    --supabase)
        check_supabase
        ;;
    --github)
        check_github_actions
        ;;
    --azure)
        check_azure_services
        ;;
    --docker)
        check_local_docker
        ;;
    --migrations)
        check_migration_sync
        ;;
    --secrets)
        check_secrets
        ;;
    --help|-h)
        echo "Usage: $0 [--supabase|--github|--azure|--docker|--migrations|--secrets|--help]"
        echo ""
        echo "Options:"
        echo "  --supabase    Check managed Supabase instance only"
        echo "  --github      Check GitHub Actions deployments only"
        echo "  --azure       Check Azure cloud services only"
        echo "  --docker      Check local Docker services only"
        echo "  --migrations  Check database migration sync only"
        echo "  --secrets     Check environment variables only"
        echo "  --help        Show this help message"
        echo ""
        echo "Run without options to check everything."
        ;;
    *)
        main
        ;;
esac
