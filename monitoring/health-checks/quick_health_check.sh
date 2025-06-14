#!/bin/bash
# Quick LocalAI Stack Health Check
# Usage: ./quick_health_check.sh

echo "🏥 LocalAI Stack Quick Health Check"
echo "=================================="
echo "$(date)"
echo ""

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to check if a service is accessible
check_service() {
    local name=$1
    local url=$2
    local expected_code=${3:-200}
    
    if curl -s -o /dev/null -w "%{http_code}" --connect-timeout 3 "$url" | grep -q "$expected_code"; then
        echo -e "${GREEN}✅ $name${NC} - $url"
        return 0
    else
        echo -e "${RED}❌ $name${NC} - $url"
        return 1
    fi
}

# Function to check if a port is open
check_port() {
    local name=$1
    local host=$2
    local port=$3
    
    if nc -z "$host" "$port" 2>/dev/null; then
        echo -e "${GREEN}✅ $name${NC} - $host:$port"
        return 0
    else
        echo -e "${RED}❌ $name${NC} - $host:$port"
        return 1
    fi
}

# Function to count running containers
count_containers() {
    local total=$(docker ps -a --filter "name=localai\|n8n\|ollama\|flowise\|open-webui\|qdrant\|searxng\|caddy\|supabase" --format "{{.Names}}" | wc -l)
    local running=$(docker ps --filter "name=localai\|n8n\|ollama\|flowise\|open-webui\|qdrant\|searxng\|caddy\|supabase" --format "{{.Names}}" | wc -l)
    
    echo -e "${BLUE}📊 Containers:${NC} $running/$total running"
    
    if [ "$running" -eq "$total" ]; then
        echo -e "${GREEN}✅ All containers are running${NC}"
    else
        echo -e "${YELLOW}⚠️  Some containers are not running${NC}"
        echo -e "${BLUE}Stopped containers:${NC}"
        docker ps -a --filter "name=localai\|n8n\|ollama\|flowise\|open-webui\|qdrant\|searxng\|caddy\|supabase" --format "table {{.Names}}\t{{.Status}}" | grep -v "Up "
    fi
}

echo "🐳 Container Status:"
count_containers
echo ""

echo "🌐 Web Services:"
check_service "N8N" "http://localhost:5679"
check_service "Open-WebUI" "http://localhost:8080"
check_service "Flowise" "http://localhost:3001"
check_service "SearXNG" "http://localhost:8082"
check_service "Neo4j Browser" "http://localhost:7474"
check_service "Langfuse" "http://localhost:3000"
check_service "MinIO Console" "http://localhost:9011"
echo ""

echo "🔌 API Services:"
check_service "Ollama API" "http://localhost:11435/api/version"
check_service "Qdrant" "http://localhost:6333"
check_service "ClickHouse" "http://localhost:8123/ping"
echo ""

echo "🗃️  Database Ports:"
check_port "PostgreSQL" "localhost" "5433"
check_port "Redis" "localhost" "6380"
echo ""

echo "🔗 Internal Connectivity (Docker Network):"
if docker exec n8n wget -qO- --timeout=3 http://ollama:11434/api/tags > /dev/null 2>&1; then
    echo -e "${GREEN}✅ N8N → Ollama${NC}"
else
    echo -e "${RED}❌ N8N → Ollama${NC}"
fi

if docker exec n8n wget -qO- --timeout=3 http://postgres:5432 2>&1 | grep -q "temporarily unavailable"; then
    echo -e "${GREEN}✅ N8N → PostgreSQL${NC}"
else
    echo -e "${RED}❌ N8N → PostgreSQL${NC}"
fi
echo ""

echo "💾 Resource Usage (Top 5 by CPU):"
docker stats --no-stream --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}" | head -6
echo ""

# Check if any containers are restarting frequently
echo "🔄 Container Health Issues:"
unhealthy=$(docker ps --filter "health=unhealthy" --format "{{.Names}}" | wc -l)
if [ "$unhealthy" -gt 0 ]; then
    echo -e "${RED}❌ Unhealthy containers found:${NC}"
    docker ps --filter "health=unhealthy" --format "table {{.Names}}\t{{.Status}}"
else
    echo -e "${GREEN}✅ No unhealthy containers detected${NC}"
fi

# Quick restart detection
restarting=$(docker ps --format "{{.Names}}\t{{.Status}}" | grep -c "Restarting\|Up.*second")
if [ "$restarting" -gt 0 ]; then
    echo -e "${YELLOW}⚠️  Recently restarted containers:${NC}"
    docker ps --format "table {{.Names}}\t{{.Status}}" | grep "Restarting\|Up.*second"
fi

echo ""
echo "🎯 Quick Actions:"
echo "   View all containers: docker ps"
echo "   View logs: docker logs <container_name>"
echo "   Restart service: docker compose restart <service_name>"
echo "   Full monitoring: python monitor_services.py"
echo ""
echo "✨ Health check complete!"
