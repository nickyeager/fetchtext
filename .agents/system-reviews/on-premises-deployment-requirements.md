# On-Premises Deployment Requirements for FetchText

**Date**: 2025-01-25
**Analysis Type**: Deployment Architecture Review
**Purpose**: Identify requirements for fully on-premises deployment

---

## Executive Summary

FetchText can be deployed **100% on-premises** with minimal modifications. The architecture is already Docker-based and self-hosted by design. The main changes involve replacing managed cloud services with self-hosted alternatives.

**Current Cloud Dependencies:**
| Service | Current | On-Premises Alternative |
|---------|---------|------------------------|
| Supabase Database | Managed (rawhmcrtzfdhryyfovee.supabase.co) | Local Docker (already included) |
| Azure OpenAI | Cloud API | Ollama (included) or vLLM |
| Azure Provisioning | Cloud automation | Not needed (direct config) |
| Email (SendGrid) | Cloud | Self-hosted SMTP (Postal, Mailcow) |

**Effort Estimate**: 1-2 days for basic on-premises; 1 week for enterprise-hardened deployment

---

## Phase 1: Core Infrastructure (Day 1)

### 1.1 Database: Use Docker Supabase Instead of Managed

**Current State**: Production uses managed Supabase at `rawhmcrtzfdhryyfovee.supabase.co`

**On-Premises Change**: Use the existing Docker Supabase stack (already in docker-compose.yml)

```bash
# Already included in docker-compose.yml:
# - supabase-db (PostgreSQL 15.6)
# - supabase-kong (API Gateway)
# - supabase-auth (GoTrue authentication)
# - supabase-rest (PostgREST)
# - supabase-realtime (WebSockets)
# - supabase-storage (File storage)
# - supabase-studio (Admin UI)
```

**Configuration Changes**:

```bash
# .env file - switch to local Supabase
SUPABASE_URL=http://supabase-kong:8000
SUPABASE_ANON_KEY=<generated-local-anon-key>
SUPABASE_SERVICE_ROLE_KEY=<generated-local-service-key>

# localai-admin-dashboard/.env.local
VITE_SUPABASE_URL=http://localhost:8000
VITE_SUPABASE_ANON_KEY=<same-local-anon-key>
```

**Action Items**:
- [ ] Generate new JWT secrets using `openssl rand -base64 32`
- [ ] Apply all migrations from `supabase/migrations/` to local instance
- [ ] Configure backup strategy for PostgreSQL data volume

### 1.2 AI Models: Use Ollama (Already Included)

**Current State**: Azure OpenAI is the fast option; Ollama is the local fallback

**On-Premises Change**: Use Ollama as primary, with optional GPU acceleration

```bash
# Start with GPU support for best performance
python start_services.py --profile gpu-nvidia --environment private

# Or CPU-only (slower, but no special hardware needed)
python start_services.py --profile cpu --environment private
```

**Recommended On-Premises Models**:
| Use Case | Model | VRAM Required |
|----------|-------|---------------|
| Document Extraction | `qwen2.5:7b-instruct-q4_K_M` | 6GB |
| General Chat | `llama3.1:8b-instruct-q4_K_M` | 6GB |
| Code/Technical | `codellama:13b-instruct-q4_K_M` | 10GB |
| High Quality | `mixtral:8x7b-instruct-v0.1-q4_K_M` | 26GB |

**Configuration Changes**:

```python
# document-processor/app/config/settings.py
# Set Ollama as default provider
DEFAULT_LLM_PROVIDER = "ollama"
AZURE_OPENAI_ENABLED = False
```

**Action Items**:
- [ ] Download required models: `ollama pull qwen2.5:7b-instruct-q4_K_M`
- [ ] Configure GPU passthrough if using NVIDIA/AMD
- [ ] Set organization_llm_configs.tier = "self_hosted" for all orgs

### 1.3 Object Storage: MinIO (Already Included)

**Current State**: MinIO already used for S3-compatible storage

**On-Premises**: No changes needed - MinIO runs locally

```yaml
# Already in docker-compose.yml
minio:
  image: minio/minio
  ports:
    - "9010:9000"
    - "9011:9001"
  volumes:
    - minio_data:/data
```

**Action Items**:
- [ ] Configure backup for MinIO data volume
- [ ] Set strong MINIO_ROOT_PASSWORD in .env

---

## Phase 2: Remove Cloud Dependencies (Day 1-2)

### 2.1 Disable Azure OpenAI Integration

**Files to Modify**:

```python
# document-processor/app/config/settings.py
# Comment out or set empty:
AZURE_OPENAI_API_KEY = ""
AZURE_OPENAI_ENDPOINT = ""
AZURE_OPENAI_ENABLED = False
```

```python
# document-processor/app/services/llm_service.py
# Ensure fallback to Ollama when Azure unavailable
async def get_llm_provider(org_id: str = None):
    # Skip Azure lookup, return Ollama directly
    return OllamaProvider(model="qwen2.5:7b-instruct-q4_K_M")
```

### 2.2 Disable Azure Provisioning

**Files to Modify**:

```python
# document-processor/app/services/azure_provisioning_service.py
# Mark as disabled or remove from deployment

# document-processor/app/config/settings.py
AZURE_PROVISIONING_ENABLED = False
```

**Database Changes**:
```sql
-- Set all organizations to self-hosted tier
UPDATE organization_llm_configs
SET tier = 'self_hosted',
    provider_type = 'self_hosted',
    deployment_model = NULL
WHERE tier IN ('professional', 'enterprise');
```

### 2.3 Email: Self-Hosted SMTP

**Current State**: N8N workflows send via SendGrid

**On-Premises Options**:

| Solution | Complexity | Features |
|----------|------------|----------|
| **Postal** | Medium | Full MTA, webhooks, tracking |
| **Mailcow** | Medium | Full email suite with UI |
| **Local SMTP Relay** | Low | Forward to corporate SMTP |
| **MailHog (dev)** | Very Low | Testing only, captures emails |

**Option A: Local SMTP Relay (Recommended for Corporate)**

```yaml
# Add to docker-compose.yml
smtp-relay:
  image: namshi/smtp
  environment:
    - RELAY_HOST=mail.corporate.local
    - RELAY_PORT=587
    - RELAY_USERNAME=service@corporate.local
    - RELAY_PASSWORD=${SMTP_PASSWORD}
  networks:
    - local-ai
```

**N8N Configuration**:
- Update N8N SMTP credentials to use `smtp-relay:25`
- Or configure N8N to use corporate SMTP directly

**Option B: Postal (Full-Featured)**

```yaml
# Add Postal stack (separate docker-compose)
postal:
  image: ghcr.io/postalserver/postal:latest
  ports:
    - "8004:5000"
  environment:
    - POSTAL_WEB_HOST=mail.internal.local
  volumes:
    - postal_data:/opt/postal/data
```

---

## Phase 3: Network Configuration (Day 2)

### 3.1 Internal DNS/Hostname Resolution

**On-Premises Requirements**:
- Internal DNS server or `/etc/hosts` entries
- SSL certificates (self-signed or internal CA)

```bash
# /etc/hosts on all servers
192.168.1.100  fetchtext.internal
192.168.1.100  api.fetchtext.internal
192.168.1.100  mail.fetchtext.internal
```

### 3.2 SSL/TLS Configuration

**Option A: Internal Certificate Authority (Recommended)**

```bash
# Generate root CA
openssl genrsa -out ca.key 4096
openssl req -x509 -new -nodes -key ca.key -sha256 -days 3650 -out ca.crt

# Generate server certificate
openssl genrsa -out server.key 2048
openssl req -new -key server.key -out server.csr
openssl x509 -req -in server.csr -CA ca.crt -CAkey ca.key -CAcreateserial -out server.crt -days 365
```

**Update Caddyfile**:
```
fetchtext.internal {
    tls /etc/caddy/certs/server.crt /etc/caddy/certs/server.key
    reverse_proxy localhost:5174
}

api.fetchtext.internal {
    tls /etc/caddy/certs/server.crt /etc/caddy/certs/server.key
    reverse_proxy supabase-kong:8000
}
```

**Option B: Self-Signed (Development Only)**

```bash
# Caddy can generate self-signed automatically
# Update .env
ENABLE_HTTPS=true
HTTPS_MODE=self_signed
```

### 3.3 Firewall Rules

```bash
# Required ports for on-premises deployment
# Web UI
80/tcp    # HTTP redirect
443/tcp   # HTTPS (main UI)

# API Gateway
8000/tcp  # Supabase Kong (internal or external)

# Document Processor
8090/tcp  # FastAPI (internal)

# Admin Services (restrict to admin network)
5173/tcp  # Admin Dashboard
8005/tcp  # Supabase Studio
5678/tcp  # N8N (workflow automation)
8007/tcp  # Langfuse (AI observability)

# Database (internal only)
5432/tcp  # PostgreSQL (BLOCK from external)
6379/tcp  # Redis (BLOCK from external)
6333/tcp  # Qdrant (BLOCK from external)
```

---

## Phase 4: Enterprise Hardening (Week 1)

### 4.1 Authentication Integration

**Option A: LDAP/Active Directory**

```python
# document-processor/app/services/ldap_auth_service.py
import ldap3

async def authenticate_ldap(username: str, password: str) -> dict:
    server = ldap3.Server('ldap://dc.corporate.local', get_info=ldap3.ALL)
    conn = ldap3.Connection(server, f'cn={username},ou=users,dc=corporate,dc=local', password)
    if conn.bind():
        return {"user": username, "groups": get_user_groups(conn, username)}
    raise AuthenticationError("Invalid credentials")
```

**Supabase Custom Auth Provider**:
```sql
-- Add custom auth hook
CREATE OR REPLACE FUNCTION auth.custom_access_token_hook(event jsonb)
RETURNS jsonb AS $$
  -- Add LDAP group claims to JWT
  SELECT jsonb_set(event, '{claims,groups}',
    (SELECT jsonb_agg(group_name) FROM ldap_user_groups WHERE user_id = (event->>'user_id')::uuid)
  );
$$ LANGUAGE sql;
```

**Option B: SAML/SSO**

```yaml
# .env additions for SAML
GOTRUE_EXTERNAL_SAML_ENABLED=true
GOTRUE_EXTERNAL_SAML_METADATA_URL=https://idp.corporate.local/metadata
GOTRUE_EXTERNAL_SAML_SIGNING_CERT=/etc/supabase/saml-cert.pem
```

### 4.2 Backup & Disaster Recovery

**Database Backup Script**:
```bash
#!/bin/bash
# /opt/fetchtext/scripts/backup.sh

BACKUP_DIR="/backups/fetchtext"
DATE=$(date +%Y%m%d_%H%M%S)

# PostgreSQL backup
docker exec supabase-db pg_dump -U postgres > "${BACKUP_DIR}/db_${DATE}.sql"

# MinIO backup
docker run --rm -v minio_data:/data -v ${BACKUP_DIR}:/backup alpine tar -czf /backup/minio_${DATE}.tar.gz /data

# Compress and encrypt
tar -czf "${BACKUP_DIR}/full_backup_${DATE}.tar.gz" "${BACKUP_DIR}"/db_${DATE}.sql "${BACKUP_DIR}"/minio_${DATE}.tar.gz
gpg --encrypt --recipient backup@corporate.local "${BACKUP_DIR}/full_backup_${DATE}.tar.gz"

# Cleanup
rm "${BACKUP_DIR}"/db_${DATE}.sql "${BACKUP_DIR}"/minio_${DATE}.tar.gz
find ${BACKUP_DIR} -name "*.tar.gz" -mtime +30 -delete
```

**Cron Schedule**:
```bash
# /etc/cron.d/fetchtext-backup
0 2 * * * root /opt/fetchtext/scripts/backup.sh
```

### 4.3 High Availability (Optional)

**PostgreSQL Replication**:
```yaml
# docker-compose.ha.yml
postgres-primary:
  image: postgres:15.6
  environment:
    POSTGRES_REPLICATION_MODE: master
    POSTGRES_REPLICATION_USER: replicator
    POSTGRES_REPLICATION_PASSWORD: ${REPLICATION_PASSWORD}

postgres-replica:
  image: postgres:15.6
  environment:
    POSTGRES_REPLICATION_MODE: slave
    POSTGRES_MASTER_HOST: postgres-primary
    POSTGRES_MASTER_PORT_NUMBER: 5432
```

**Load Balancer** (HAProxy):
```
frontend http
    bind *:443 ssl crt /etc/haproxy/certs/
    default_backend fetchtext_servers

backend fetchtext_servers
    balance roundrobin
    server server1 192.168.1.101:443 check
    server server2 192.168.1.102:443 check backup
```

### 4.4 Audit Logging

**Enable PostgreSQL Audit Logging**:
```sql
-- Install pgAudit extension
CREATE EXTENSION IF NOT EXISTS pgaudit;

-- Configure audit logging
ALTER SYSTEM SET pgaudit.log = 'write, ddl';
ALTER SYSTEM SET pgaudit.log_catalog = off;
SELECT pg_reload_conf();
```

**Application-Level Audit**:
```python
# document-processor/app/middleware/audit.py
from datetime import datetime

async def audit_middleware(request, call_next):
    response = await call_next(request)

    # Log to audit table
    await db.execute("""
        INSERT INTO audit_log (timestamp, user_id, action, resource, ip_address, status_code)
        VALUES ($1, $2, $3, $4, $5, $6)
    """, datetime.utcnow(), request.user.id, request.method, request.url.path,
        request.client.host, response.status_code)

    return response
```

---

## Phase 5: Air-Gapped Deployment (If Required)

For completely isolated networks with no internet access:

### 5.1 Pre-Download All Docker Images

```bash
# Save all images to tar files
docker save -o fetchtext-images.tar \
  postgres:15.6 \
  kong:2.8.1 \
  supabase/gotrue:v2.99.0 \
  supabase/postgrest:v11.2.0 \
  supabase/realtime:v2.25.50 \
  supabase/storage-api:v0.43.11 \
  supabase/studio:20240101-8e4a094 \
  ollama/ollama:latest \
  minio/minio:latest \
  caddy:2-alpine \
  redis:7-alpine \
  n8nio/n8n:latest \
  ghcr.io/open-webui/open-webui:main \
  flowise:latest

# Transfer to air-gapped network
# Then load:
docker load -i fetchtext-images.tar
```

### 5.2 Pre-Download Ollama Models

```bash
# On internet-connected machine
ollama pull qwen2.5:7b-instruct-q4_K_M
ollama pull llama3.1:8b-instruct-q4_K_M

# Export model files
tar -czf ollama-models.tar.gz ~/.ollama/models/

# Transfer and extract on air-gapped machine
tar -xzf ollama-models.tar.gz -C /var/lib/ollama/
```

### 5.3 Offline Package Repository

```bash
# Create local npm/pip mirrors
# npm packages
npm pack @tanstack/react-router @supabase/supabase-js # etc.

# pip packages
pip download -d ./packages -r document-processor/requirements.txt
```

---

## Deployment Checklist

### Pre-Deployment
- [ ] Server meets minimum requirements (32GB RAM, 8 cores, 500GB SSD)
- [ ] GPU available if using GPU-accelerated LLM (NVIDIA 24GB+ recommended)
- [ ] Docker and Docker Compose installed
- [ ] Internal DNS configured
- [ ] SSL certificates generated (internal CA or self-signed)
- [ ] Firewall rules configured
- [ ] Backup storage provisioned

### Configuration
- [ ] Copy `.env.example` to `.env` and configure all secrets
- [ ] Generate new JWT secrets (do not use defaults)
- [ ] Configure SMTP settings (corporate relay or self-hosted)
- [ ] Set `AZURE_OPENAI_ENABLED=false` if not using cloud AI
- [ ] Configure organization_llm_configs for self-hosted tier

### Deployment
- [ ] Run `python start_services.py --profile [cpu|gpu-nvidia] --environment private`
- [ ] Apply database migrations: `docker exec supabase-db psql -f /migrations/*.sql`
- [ ] Download Ollama models: `docker exec ollama-cpu ollama pull qwen2.5:7b-instruct-q4_K_M`
- [ ] Test all services via health endpoints
- [ ] Create initial admin user via Supabase Studio

### Post-Deployment
- [ ] Configure backup schedule
- [ ] Set up monitoring alerts (Prometheus/Grafana)
- [ ] Document recovery procedures
- [ ] Train administrators on N8N workflow management
- [ ] Test disaster recovery from backup

---

## Hardware Requirements

### Minimum (Small Team, 5-20 users)
| Component | Specification |
|-----------|---------------|
| CPU | 8 cores (Intel Xeon / AMD EPYC) |
| RAM | 32GB |
| Storage | 500GB NVMe SSD |
| GPU | Optional (CPU inference acceptable) |
| Network | 1Gbps |

### Recommended (Medium Team, 20-100 users)
| Component | Specification |
|-----------|---------------|
| CPU | 16 cores |
| RAM | 64GB |
| Storage | 1TB NVMe SSD + 2TB HDD for backups |
| GPU | NVIDIA RTX 4090 (24GB) or A10 |
| Network | 10Gbps |

### Enterprise (100+ users, High Volume)
| Component | Specification |
|-----------|---------------|
| CPU | 32+ cores |
| RAM | 128GB+ |
| Storage | 2TB+ NVMe SSD RAID |
| GPU | NVIDIA A100 (80GB) or multiple A10s |
| Network | Redundant 10Gbps |
| HA | Load balancer + replica nodes |

---

## Cost Comparison

| Deployment Type | Monthly Cost | Notes |
|----------------|--------------|-------|
| **Cloud (Current)** | $300-500 | Managed Supabase + Azure OpenAI usage |
| **On-Premises (CPU)** | $0 | Existing server + electricity |
| **On-Premises (GPU)** | $0-100 | Hardware investment amortized |
| **Bare Metal Rental** | $150-300 | Dedicated server with GPU |

**One-Time Costs (On-Premises)**:
- Server hardware: $5,000-15,000
- GPU (if needed): $1,500-10,000
- Network equipment: $500-2,000

---

## Summary

FetchText is **designed for on-premises deployment**. The Docker-based architecture means:

1. **Database**: Already self-hosted (Docker Supabase) - just switch from managed
2. **AI Models**: Ollama included - download models, no cloud needed
3. **Storage**: MinIO already S3-compatible - no changes needed
4. **Email**: Configure corporate SMTP or self-host Postal

**Key Changes for On-Premises**:
1. Use Docker Supabase instead of managed instance
2. Set Ollama as default LLM provider
3. Disable Azure OpenAI and provisioning
4. Configure internal DNS and SSL
5. Set up backup procedures

The platform can be fully operational on-premises within 1-2 days, with enterprise hardening (LDAP, HA, audit logging) taking an additional week.
