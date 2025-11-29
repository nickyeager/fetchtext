# FetchText Stack Setup Verification Complete ✅

**Date**: June 7, 2025  
**Status**: All services running successfully with port conflicts resolved

## ✅ Completed Tasks

### 1. Port Conflict Resolution
- **Ollama**: Moved from port 11434 → 11435 (system conflict resolved)
- **N8N**: Moved from port 5678 → 5679 (port conflict resolved)
- **Redis**: Moved from port 6379 → 6380 (port conflict resolved)
- **SearXNG**: Moved from port 8081 → 8082 (port conflict resolved)

### 2. Environment Variables Configuration
- ✅ Added port mapping variables to `.env`
- ✅ Updated N8N webhook URL configuration
- ✅ Added Flowise authentication credentials
- ✅ Verified internal Docker networking maintains original ports

### 3. Service Connectivity Verification
- ✅ **N8N**: Accessible at http://localhost:5679
- ✅ **Ollama API**: Working at http://localhost:11435 (version: 0.9.0)
- ✅ **Flowise**: Accessible at http://localhost:3001
- ✅ **Open-WebUI**: Accessible at http://localhost:8080
- ✅ **SearXNG**: Accessible at http://localhost:8082
- ✅ **All Supabase services**: Running correctly (14 containers)

### 4. Internal Docker Network Communication
- ✅ **N8N → Ollama**: Chat completions API working via `http://ollama:11434/v1/chat/completions`
- ✅ **N8N → Ollama**: Embeddings API working via `http://ollama:11434/v1/embeddings`
- ✅ **N8N → PostgreSQL**: Database connectivity verified
- ✅ **All models loaded**: qwen2.5:7b-instruct-q4_K_M, qwen2.5:3b-instruct-q4_K_M, nomic-embed-text

### 5. Workflow Environment Variables
- ✅ **Existing workflows compatible**: Internal Docker networking unchanged
- ✅ **External access configured**: New port mappings for development tools
- ✅ **VS Code Copilot**: Configured for Ollama on port 11435

## 🎯 Service Access URLs

### Primary Workflow Services
- **N8N Workflow Editor**: http://localhost:5679
- **Ollama API**: http://localhost:11435
- **Open-WebUI (Chat Interface)**: http://localhost:8080
- **Flowise (AI Chatflow Builder)**: http://localhost:3001

### Supporting Services
- **Supabase Studio**: http://localhost:8005 (via Caddy)
- **Neo4j Browser**: http://localhost:7474
- **Qdrant**: http://localhost:6333
- **SearXNG**: http://localhost:8082
- **Langfuse**: http://localhost:3000
- **MinIO Console**: http://localhost:9011

## 📚 Comprehensive Local Endpoint Reference

Use this table whenever you need to know which localhost port or vanity hostname corresponds to a specific service. “Via Caddy” values refer to the default listener ports defined by the `Caddyfile` fallbacks (e.g., `N8N_HOSTNAME=${N8N_HOSTNAME:-":8001"}`) and will switch to custom hostnames autom  atically if you set those env vars.

| Service | Purpose | Direct URL / Port | Via Caddy / Notes |
| --- | --- | --- | --- |
| N8N | Workflow editor + webhook receiver | `http://localhost:5679` (`N8N_WEBHOOK_BASE_URL`) | `http://localhost:8001`; webhooks stay on `http://localhost:5679/webhook/...` |
| Open WebUI | Chat interface for local models | `http://localhost:8080` | `http://localhost:8002` |
| Flowise | Visual LLM/chatflow builder | `http://localhost:3001` | `http://localhost:8003` |
| Document Processor API | Upload + extraction pipeline | `http://localhost:8090` | `http://localhost:8009` |
| Admin Dashboard | Local admin UI (Vite dev server) | `http://localhost:5174` | — |
| Ollama API | Host-managed model runtime | `http://localhost:11435` | —; containers reference `http://ollama:11434` |
| Supabase Kong (API + Studio entry) | REST/auth/storage gateway plus Studio UI | `http://localhost:8000` · `https://localhost:8443` | `http://localhost:8005`; same host serves Supabase Studio under `/project/...` |
| Supabase Inbucket (Web) | Fake SMTP inbox UI | `http://localhost:19000` | — |
| Qdrant | Vector database | `http://localhost:6333` (REST)<br>`grpc://localhost:6334` | — |
| Neo4j | Graph DB + browser | `http://localhost:7474` (browser)<br>`neo4j://localhost:7687` (Bolt) | `http://localhost:8008` |
| Langfuse UI | LLM observability dashboard | `http://localhost:3000` | `http://localhost:8007`; worker queue listens on `http://localhost:3030` |
| MinIO | Object storage backing Langfuse | `http://localhost:9010` (S3 API)<br>`http://localhost:9011` (console) | — |
| ClickHouse | Langfuse analytics store | `http://localhost:8123` (HTTP)<br>`clickhouse://localhost:9100` (native) | —; metrics at `tcp://localhost:9009` |
| Langfuse Postgres | Langfuse relational DB | `postgresql://localhost:5433/postgres` | — |
| Redis / Valkey | Shared cache + queue | `redis://localhost:6380` | — |
| SearXNG | Metasearch service | `http://localhost:8082` | `http://localhost:8006` (if `SEARXNG_HOSTNAME` exported) |
| Supabase Inbucket SMTP | Receives auth emails | `smtp://localhost:2500` | — |

## 🌐 Remote Deployment Access (Azure)

These endpoints are live in the dev subscription today. Update the URLs if azd redeploys to a new hostname (see `.azure/<env>/.env`).

| Component | Remote URL / Command | Notes |
| --- | --- | --- |
| Admin Dashboard (Static Web App) | https://kind-island-00cd78710.3.azurestaticapps.net<br>(Previous: https://red-river-0904afd10.3.azurestaticapps.net) | Uses managed Supabase env vars injected via `azd`. Rebuild after rotating Supabase keys. |
| Document Processor (Container App) | https://ft-dev-document-processor-uhqrm5.graystone-50b6fbc2.eastus2.azurecontainerapps.io | Proxied through Azure Container Apps; expects `SUPABASE_URL` + service key from Key Vault. |
| Supabase VM (Docker stack) | `ssh supabaseadmin@128.24.73.54` | Run `docker compose --profile supabase ps` to check Postgres/auth/rest/storage/realtime status. |
| Supabase API via Kong | http://128.24.73.54:8000 | Frontend/dev services can target this when testing the VM stack remotely. |
| Inbucket (SMTP sink) | http://128.24.73.54:9000 | Capture password reset emails sent by GoTrue on the VM. |

> **Tip:** Keep `documentation/supabase.md` updated when rotating the VM IP, and mirror any endpoint changes above so operators know where to reach each environment.

## 🔧 Configuration Files Updated

1. **`docker-compose.override.private.yml`** - Port mappings
2. **`.env`** - Environment variables and credentials
3. **`docker-compose.yml`** - N8N webhook URL configuration
4. **`.vscode/settings.json`** - VS Code Copilot endpoint
5. **`PORT_CONFIGURATION.md`** - Documentation

## ⚡ Quick Start Commands

```bash
# View all running services
docker ps

# Access N8N workflows
open http://localhost:5679

# Access Open-WebUI for chat
open http://localhost:8080

# Test Ollama API
curl http://localhost:11435/api/tags

# View service logs
docker logs n8n
docker logs ollama
```

## 🎉 What's Working

1. **Complete AI Stack**: All 25+ containers running successfully
2. **RAG Workflows**: N8N can execute AI workflows with Ollama embeddings and chat
3. **External Tools**: VS Code Copilot configured for local Ollama
4. **Vector Database**: Qdrant ready for knowledge storage
5. **Database Access**: PostgreSQL and Neo4j available for data storage
6. **Search Integration**: SearXNG for web search capabilities

## 🚀 Next Steps

1. **Import N8N Workflows**:
   - Access N8N at http://localhost:5679
   - Import the V3 Local Agentic RAG AI Agent workflow
   - Configure Ollama credentials in N8N (use `http://ollama:11434/v1` as base URL)

2. **Test RAG Functionality**:
   - Upload documents via the workflow

## Managed Supabase Admin Seeding

Once the managed Supabase project is provisioned and secrets are stored in Key Vault, seed an admin account directly against the hosted instance. Example (replace Key Vault name + email/password as appropriate):

```bash
SUPABASE_URL="$(az keyvault secret show --vault-name ft-dev-kv --name supabase-url --query value -o tsv)"
SERVICE_ROLE_KEY="$(az keyvault secret show --vault-name ft-dev-kv --name supabase-service-role --query value -o tsv)"

python scripts/seed_supabase_user.py \
   --email admin@fetchtext.local \
   --password '***REMOVED-TEST-PASSWORD***' \
   --supabase-url "$SUPABASE_URL" \
   --service-role-key "$SERVICE_ROLE_KEY"
```

Re-run the script whenever you rotate Supabase credentials or need to bootstrap additional admin accounts.
