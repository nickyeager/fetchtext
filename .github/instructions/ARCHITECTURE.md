# Local AI Packaged - System Architecture

## Overview
This document provides a comprehensive overview of all services, their ports, and how they interconnect in the Local AI Packaged system.

## Service Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    Internet/Browser                         │
└─────────────────────┬───────────────────────────────────────┘
                      │
              ┌───────▼───────┐
              │     Caddy     │  Reverse Proxy & SSL
              │   :80, :443   │  (Ports 80/443)
              └───────┬───────┘
                      │
        ┌─────────────┼─────────────┐
        │             │             │
    ┌───▼───┐    ┌────▼────┐   ┌────▼────┐
    │ N8N   │    │ WebUI   │   │ Others  │
    │:8001  │    │ :8002   │   │ :8003+  │
    └───────┘    └─────────┘   └─────────┘
```

## External Access Ports (via Caddy Reverse Proxy)

### Primary Web Interfaces
| Service | External Port | Internal Container:Port | Description |
|---------|---------------|------------------------|-------------|
| **N8N Workflow Automation** | `:8001` | `n8n:5678` | Workflow automation platform |
| **Open WebUI (ChatGPT-like)** | `:8002` | `open-webui:8080` | AI chat interface |
| **Flowise (Low-code AI)** | `:8003` | `flowise:3001` | Visual AI workflow builder |
| **Supabase Studio** | `:8005` | `http://localhost:8000` (host) / `http://supabase-kong:8000` (internal) | Database & Auth management |
| **Langfuse (AI Observability)** | `:8007` | `langfuse-web:3000` | AI monitoring & analytics |
| **Neo4j Browser** | `:8008` | `neo4j:7474` | Graph database interface |
| **Document Processor** | `:8009` | `document-processor:8090` | Document processing API |

### Administrative Interfaces
| Service | External Port | Internal Container:Port | Description |
|---------|---------------|------------------------|-------------|
| **LocalAI Admin Dashboard** | `:5174` | `localai-admin-dashboard:3005` | Main admin interface |
| **SearXNG Search** | `:8006` | `searxng:8080` | Private search engine |

## Direct Access Ports (Not behind Caddy)

### AI & ML Services
| Service | Port | Container | Description |
|---------|------|-----------|-------------|
| **Ollama API** | `11434` | `ollama-cpu/gpu:11434` | Local LLM API server |
| **Document Processor API** | `8090` | `document-processor:8090` | Document processing service |

## Internal Services (Container-to-Container Only)

### Database Services
| Service | Internal Port | Container | Description |
|---------|---------------|-----------|-------------|
| **PostgreSQL** | `5432` | `localai-postgres-1:5432` | Primary database |
| **Redis/Valkey** | `6379` | `localai-redis:6379` | Cache & session store |
| **Qdrant Vector DB** | `6333, 6334` | `qdrant:6333/6334` | Vector similarity search |
| **ClickHouse** | `8123, 9000, 9009` | `localai-clickhouse-1` | Analytics database |

### Storage Services
| Service | Internal Port | Container | Description |
|---------|---------------|-----------|-------------|
| **MinIO S3** | `9000, 9001` | `localai-minio-1` | Object storage |

### Supabase Internal Services
| Service | Internal Port | Container | Description |
|---------|---------------|-----------|-------------|
| **Kong API Gateway** | `8000` | `supabase-kong` | API gateway for Supabase |
| **Supabase Studio** | `3000` | `supabase-studio` | Admin interface |
| **PostgREST** | `3000` | `supabase-rest` | Auto-generated REST API |
| **GoTrue Auth** | `9999` | `supabase-auth` | Authentication service |
| **Realtime** | `4000` | `supabase-realtime` | Real-time subscriptions |
| **Storage** | `5000` | `supabase-storage` | File storage service |
| **Meta** | `8080` | `supabase-meta` | Database metadata API |
| **Analytics** | `4000` | `supabase-analytics` | Usage analytics |

### Background Workers
| Service | Internal Port | Container | Description |
|---------|---------------|-----------|-------------|
| **Langfuse Worker** | `3030` | `localai-langfuse-worker-1` | Background job processor |
| **N8N Import** | N/A | `n8n-import` | One-time import utility |

## Data Flow Architecture

### Authentication Flow
```
Browser → Caddy (:8005) → Kong (:8000) → GoTrue (:9999) → PostgreSQL (:5432)
```

### AI Chat Flow
```
Browser → Caddy (:8002) → Open WebUI (:8080) → Ollama (:11434) → LLM Models
```

### Workflow Automation Flow
```
Browser → Caddy (:8001) → N8N (:5678) → PostgreSQL (:5432)
                                     → External APIs
                                     → Shared Volume
```

### Document Processing Flow
```
Browser → Document Processor (:8090) → Shared Volume → Background Processing
```

### AI Observability Flow
```
AI Services → Langfuse Web (:3000) → ClickHouse (:8123) → MinIO (:9000)
                                  → PostgreSQL (:5432)
```

## Volume Mounts & Shared Storage

### Application Data
- `n8n_storage`: N8N workflows and credentials
- `open-webui`: Open WebUI user data and conversations
- `flowise`: Flowise workflows and configurations
- `ollama_storage`: Downloaded AI models and configs

### Database Storage
- `langfuse_postgres_data`: Langfuse PostgreSQL data
- `langfuse_clickhouse_data`: ClickHouse analytical data
- `langfuse_clickhouse_logs`: ClickHouse logs
- `qdrant_storage`: Vector embeddings and indices

### File Storage
- `langfuse_minio_data`: Object storage for Langfuse
- `document_uploads`: Uploaded documents for processing
- `document_processed`: Processed document outputs
- `document_temp`: Temporary processing files
- `./shared`: Shared volume between services

### Configuration & Cache
- `caddy-data`: SSL certificates and Caddy data
- `caddy-config`: Caddy configuration cache
- `valkey-data`: Redis/Valkey cache data

## Environment Variables & Configuration

### Core Services
```env
# Database
POSTGRES_PASSWORD=your_secure_password

# Authentication
JWT_SECRET=your_jwt_secret
ANON_KEY=your_anon_key
SERVICE_ROLE_KEY=your_service_role_key

# Langfuse
LANGFUSE_SALT=your_langfuse_salt
NEXTAUTH_SECRET=your_nextauth_secret

# MinIO
MINIO_ROOT_PASSWORD=your_minio_password

# Flowise
FLOWISE_USERNAME=admin
FLOWISE_PASSWORD=your_flowise_password
```

### Hostname Configuration (for custom domains)
```env
N8N_HOSTNAME=n8n.yourdomain.com
WEBUI_HOSTNAME=chat.yourdomain.com
FLOWISE_HOSTNAME=flowise.yourdomain.com
SUPABASE_HOSTNAME=api.yourdomain.com
LANGFUSE_HOSTNAME=langfuse.yourdomain.com
```

## Security Considerations

### Network Security
- All external traffic goes through Caddy reverse proxy
- Internal services communicate via Docker network
- No direct database access from external networks
- SSL/TLS termination at Caddy level

### Authentication
- Supabase provides centralized authentication
- JWT-based authentication across services
- Role-based access control where applicable

### Data Protection
- Database passwords and secrets via environment variables
- Volume-based persistence for critical data
- Backup capabilities for all data volumes

## Monitoring & Health Checks

### Health Check Endpoints
- Langfuse: `/api/public/health`
- Document Processor: `/health`
- Supabase components: Various internal health checks
- PostgreSQL: `pg_isready`
- Redis: `redis-cli ping`
- ClickHouse: `/ping`

### Logging
- Centralized logging via Docker logging drivers
- Log rotation configured for production use
- JSON structured logs for better parsing

## Deployment Profiles

### CPU-Only Profile (Default)
```bash
docker compose up
```

### GPU-Enabled (NVIDIA)
```bash
docker compose --profile gpu-nvidia up
```

### GPU-Enabled (AMD ROCm)
```bash
docker compose --profile gpu-amd up
```

## Quick Reference Commands

### Service Management
```bash
# Start all services
docker compose up -d

# Stop all services
docker compose down

# Rebuild specific service
docker compose up -d --build localai-admin-dashboard

# View logs
docker compose logs -f [service_name]

# Check service status
docker compose ps
```

### Health Checks
```bash
# Quick health check script
./quick_health_check.sh

# Check specific service
curl http://localhost:8090/health  # Document processor
curl http://localhost:8007/api/public/health  # Langfuse
```

This architecture provides a comprehensive, scalable AI platform with proper separation of concerns, security, and monitoring capabilities.
