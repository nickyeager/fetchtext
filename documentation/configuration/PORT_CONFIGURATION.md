# Port Configuration Summary

This document outlines the port mappings for the LocalAI stack after resolving port conflicts with system-level services.

## Port Mappings

### Services with Updated External Ports

| Service | Internal Port | External Port | Previous Port | Reason for Change |
|---------|---------------|---------------|---------------|-------------------|
| Ollama | 11434 | 11435 | 11434 | Conflict with system Ollama |
| N8N | 5678 | 5679 | 5678 | Port conflict |
| Redis | 6379 | 6380 | 6379 | Port conflict |
| SearXNG | 8080 | 8082 | 8081 | Port conflict |

### Services with Standard External Ports

| Service | Internal Port | External Port | Access URL |
|---------|---------------|---------------|------------|
| Flowise | 3001 | 3001 | http://localhost:3001 |
| Open-WebUI | 8080 | 8080 | http://localhost:8080 |
| Qdrant | 6333-6334 | 6333-6334 | http://localhost:6333 |
| Neo4j | 7473-7474, 7687 | 7473-7474, 7687 | http://localhost:7474 |
| Langfuse Worker | 3030 | 3030 | http://localhost:3030 |
| Langfuse Web | 3000 | 3000 | http://localhost:3000 |
| ClickHouse | 8123, 9000, 9009 | 8123, 9100, 9009 | http://localhost:8123 |
| MinIO | 9000, 9001 | 9010, 9011 | http://localhost:9010 |
| PostgreSQL | 5432 | 5433 | localhost:5433 |

## Service URLs

### Updated Service URLs (Use These for External Access)

- **N8N**: http://localhost:5679
- **Ollama API**: http://localhost:11435
- **Redis**: localhost:6380
- **SearXNG**: http://localhost:8082

### Standard Service URLs

- **Flowise**: http://localhost:3001
- **Open-WebUI**: http://localhost:8080
- **Qdrant**: http://localhost:6333
- **Neo4j Browser**: http://localhost:7474
- **Langfuse**: http://localhost:3000
- **MinIO Console**: http://localhost:9011
- **ClickHouse**: http://localhost:8123

## Environment Variables

The following environment variables have been added to `.env` for workflow configuration:

```bash
# N8N webhook and external access
N8N_EXTERNAL_PORT=5679
N8N_WEBHOOK_BASE_URL=http://localhost:5679

# Ollama external access
OLLAMA_EXTERNAL_PORT=11435
OLLAMA_EXTERNAL_BASE_URL=http://localhost:11435

# Redis external access
REDIS_EXTERNAL_PORT=6380

# SearXNG external access
SEARXNG_EXTERNAL_PORT=8082
```

## Inter-Service Communication

### Important Notes for Workflow Configuration

1. **Docker Internal Networking**: Services communicate with each other using internal Docker network hostnames and original ports:
   - N8N → Ollama: `http://ollama:11434` (not 11435)
   - N8N → Redis: `redis:6379` (not 6380)
   - Services → PostgreSQL: `postgres:5432` (not 5433)

2. **External Access**: When accessing services from outside Docker (e.g., from VS Code, external applications), use the mapped external ports.

3. **N8N Workflows**: Existing workflows should continue to work because they use internal Docker networking which maintains original ports.

## VS Code Configuration

VS Code Copilot is configured to use the external Ollama port:

```json
{
    "github.copilot.chat.localhostRequestOptions": {
        "baseUrl": "http://localhost:11435"
    }
}
```

## Verification Commands

Test service accessibility:

```bash
# Test N8N
curl http://localhost:5679

# Test Ollama
curl http://localhost:11435/api/tags

# Test Redis
echo "PING" | nc localhost 6380

# Test SearXNG
curl http://localhost:8082

# Test internal Docker networking from N8N
docker exec -it n8n wget -qO- http://ollama:11434/api/tags
```

## Configuration Files Modified

1. **docker-compose.override.private.yml** - Port mappings
2. **.env** - Environment variables for external access
3. **docker-compose.yml** - N8N webhook URL configuration
4. **.vscode/settings.json** - VS Code Copilot Ollama endpoint

All services are now running without port conflicts and can communicate properly both internally and externally.
