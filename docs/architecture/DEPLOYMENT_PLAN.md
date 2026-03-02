# FetchText Platform - Comprehensive Deployment Plan

## Executive Summary

FetchText is a complex multi-service AI platform consisting of ~30 Docker containers orchestrated via Docker Compose. The platform requires significant resources and careful consideration for production deployment. This plan outlines deployment options, phased approaches, and recommendations for different use cases.

## System Architecture Overview

### Core Services
- **Frontend**: React/TypeScript (localai-admin-dashboard) on port 5174
- **API Backend**: Python FastAPI (document-processor) on port 8090
- **Authentication/Database**: Supabase stack (8 containers)
- **Workflow Engine**: N8N on port 5678
- **AI Services**: 
  - Ollama (local LLMs) on port 11434
  - Azure OpenAI integration (cloud option)
- **Storage**: MinIO S3-compatible storage
- **Databases**: PostgreSQL (x2), Redis, ClickHouse, Neo4j, Qdrant
- **Monitoring**: Langfuse, Prometheus, Grafana
- **Reverse Proxy**: Caddy with SSL termination

### Resource Requirements

#### Minimum Requirements
- **CPU**: 8 cores (16+ recommended)
- **RAM**: 32GB (64GB recommended for Ollama models)
- **Storage**: 200GB SSD (500GB+ recommended)
- **Network**: 100Mbps+ bandwidth
- **GPU**: Optional but recommended for faster LLM inference

#### Container Resource Usage
- Ollama: 8-16GB RAM per model
- PostgreSQL instances: 2-4GB RAM each
- ClickHouse: 4-8GB RAM
- Neo4j: 2-4GB RAM
- Document processor: 2-4GB RAM
- Frontend/services: ~1GB each

## Deployment Platform Recommendations

### 1. **Cloud VPS (Recommended for Most Users)**

#### Best Options:
- **Hetzner Cloud**: CCX53 (32 vCPUs, 128GB RAM) ~€200/month
- **DigitalOcean**: Memory-Optimized 32GB+ droplet ~$320/month
- **Vultr**: High Frequency 32GB+ instance ~$320/month
- **OVH**: Dedicated server (better value) ~€150/month

#### Pros:
- Full control over environment
- Easy Docker installation
- Persistent storage
- Fixed pricing
- Good for development and small-medium production

#### Cons:
- Manual management required
- No built-in scaling
- Need to handle backups manually

### 2. **AWS/Azure/GCP (Enterprise Production)**

#### Architecture:
- **EKS/AKS/GKE** for Kubernetes orchestration
- **RDS** for managed PostgreSQL
- **ElastiCache** for Redis
- **S3/Blob Storage** instead of MinIO
- **Application Load Balancer** instead of Caddy
- **Fargate/Cloud Run** for serverless containers

#### Estimated Costs:
- Development: $500-800/month
- Production: $1,500-3,000/month
- Enterprise: $5,000+/month

#### Pros:
- Fully managed services
- Auto-scaling capabilities
- Enterprise-grade reliability
- Built-in monitoring and logging
- Geographic distribution

#### Cons:
- Complex setup
- Higher costs
- Vendor lock-in
- Requires cloud expertise

### 3. **Kubernetes Platforms (Scalable Production)**

#### Options:
- **Digital Ocean Kubernetes**: $200-500/month
- **Linode Kubernetes**: $200-500/month
- **Google Kubernetes Engine**: $300-800/month

#### Pros:
- Container orchestration
- Easy scaling
- Self-healing
- Good for microservices

#### Cons:
- Requires Kubernetes expertise
- More complex than Docker Compose
- Higher operational overhead

### 4. **Bare Metal Server (Cost-Effective)**

#### Providers:
- **Hetzner Dedicated**: AX102 (AMD EPYC, 128GB RAM) ~€150/month
- **OVH Dedicated**: Advance servers ~€200/month
- **Scaleway Dedibox**: ~€100-200/month

#### Pros:
- Best performance per dollar
- Full hardware control
- No virtualization overhead
- Great for resource-intensive workloads

#### Cons:
- Hardware failures are your responsibility
- No quick scaling
- Requires more DevOps expertise

### 5. **Hybrid Approach (Recommended for Production)**

Combine multiple platforms:
- **Core Services**: Managed cloud (RDS, ElastiCache)
- **AI/Compute**: Dedicated server or GPU instance
- **Frontend/API**: Container service (ECS, Cloud Run)
- **Storage**: S3/Blob storage

## Phased Deployment Approach

### Phase 1: Development/Testing (Week 1-2)
1. **Single VPS Deployment** (16GB+ RAM)
   ```bash
   # Basic setup
   git clone [repository]
   cd local-ai-packaged
   cp .env.example .env
   # Configure all secrets in .env
   python start_services.py --profile cpu
   ```

2. **Configure DNS and SSL**
   - Point domain to server IP
   - Update Caddy environment variables
   - Enable Let's Encrypt

3. **Basic Testing**
   - Verify all services are running
   - Test document upload/processing
   - Configure Azure OpenAI (optional)

### Phase 2: Production Preparation (Week 3-4)
1. **Security Hardening**
   - Change all default passwords
   - Configure firewall rules
   - Enable fail2ban
   - Set up VPN for admin access

2. **Backup Strategy**
   - Automated PostgreSQL backups
   - MinIO replication
   - Configuration backups
   - Disaster recovery plan

3. **Monitoring Setup**
   - Configure Prometheus alerts
   - Set up Grafana dashboards
   - Enable application logging
   - Configure uptime monitoring

### Phase 3: Production Deployment (Week 5-6)
1. **Infrastructure Scaling**
   - Move databases to managed services
   - Set up load balancer
   - Configure CDN for static assets
   - Enable horizontal scaling

2. **Performance Optimization**
   - Enable caching layers
   - Optimize database queries
   - Configure resource limits
   - Tune Ollama models

3. **High Availability**
   - Database replication
   - Service redundancy
   - Multi-region deployment (optional)

### Phase 4: Enterprise Features (Month 2+)
1. **Advanced Features**
   - SSO integration
   - API rate limiting
   - Multi-tenancy
   - Audit logging

2. **Compliance**
   - GDPR compliance
   - Data encryption at rest
   - Compliance reporting
   - Security audits

## Deployment Decision Matrix

| Use Case | Recommended Platform | Estimated Cost | Complexity |
|----------|---------------------|----------------|------------|
| Personal/Dev | VPS (16GB) | $80-150/mo | Low |
| Small Business | VPS (32-64GB) | $200-400/mo | Medium |
| Medium Business | Kubernetes + Managed DB | $500-1000/mo | High |
| Enterprise | Cloud Native (AWS/Azure) | $2000+/mo | Very High |
| Cost-Conscious | Bare Metal | $150-300/mo | Medium |

## Critical Deployment Considerations

### 1. **Environment Variables**
All secrets MUST be configured before deployment:
- Database passwords (strong, unique)
- JWT secrets (32+ characters)
- API keys (Azure OpenAI, etc.)
- Service credentials
- PostHog analytics: `VITE_POSTHOG_KEY`, `VITE_POSTHOG_HOST`

**Important:** Frontend `VITE_*` variables are embedded at **build time** by Vite, not at runtime. They must be set as GitHub Secrets and passed in the `deploy-dashboard.yml` workflow. If a key is missing during the build, that feature will be silently disabled in production.

### 2. **Storage Persistence**
Ensure persistent volumes for:
- PostgreSQL data
- Document uploads
- Ollama models
- MinIO storage

### 3. **Network Security**
- Use private networks for inter-service communication
- Expose only necessary ports
- Enable SSL/TLS everywhere
- Configure proper CORS headers

### 4. **Resource Limits**
Set Docker resource limits to prevent runaway containers:
```yaml
deploy:
  resources:
    limits:
      cpus: '2'
      memory: 4G
```

### 5. **Monitoring and Alerts**
- CPU/Memory usage > 80%
- Disk usage > 80%
- Service health checks failing
- Response time degradation

## Quick Start Commands

### For Development (VPS/Local)
```bash
# Clone and setup
git clone [repository]
cd local-ai-packaged
cp .env.example .env
# Edit .env with your values

# Start services
python start_services.py --profile cpu --environment development

# Check health
docker ps
./monitoring/health-checks/quick_health_check.sh
```

### For Production
```bash
# Start with GPU support
python start_services.py --profile gpu-nvidia --environment public

# Enable monitoring
docker compose -f monitoring/docker-compose.optimized.yml up -d

# Backup databases
docker exec supabase-db pg_dump -U postgres > backup.sql
```

## Current Production Architecture (Hybrid)

FetchText production uses a hybrid deployment:

| Component | Hosting | Details |
|-----------|---------|---------|
| Frontend | Azure Static Web Apps | `fetchtext.io` - deployed via `deploy-dashboard.yml` |
| Document Processor | Azure Container App | FastAPI backend - deployed via `deploy-container-app.yml` |
| Database / Auth | Managed Supabase | `rawhmcrtzfdhryyfovee.supabase.co` |
| N8N, Qdrant, Ollama, Neo4j, etc. | Azure VM | Full docker-compose stack at `/srv/supabase` - deployed via `deploy-vm.yml` |

### Qdrant in Production
Qdrant runs on the Azure VM as part of the Docker Compose stack. However, the Document Processor (Azure Container App) currently **cannot reach Qdrant** because:
- No `QDRANT_HOST`/`QDRANT_PORT` env vars are set in the Container App deployment
- Qdrant is not exposed through Caddy (internal Docker network only)
- The code gracefully degrades (vector search disabled) but Template-RAG is non-functional

To enable Template-RAG in production, Qdrant needs to be reachable from the Container App. Options:
1. Expose Qdrant via Caddy with a subdomain (e.g., `qdrant.fetchtext.io`) and API key auth
2. Use Qdrant Cloud (managed, free tier available)
3. Deploy Qdrant as a separate Azure Container App

## Cost Optimization Tips

1. **Use Ollama CPU models** instead of GPU for development
2. **Disable unused services** (Neo4j if not needed for graph queries)
3. **Use external PostgreSQL** shared instance
4. **Implement aggressive caching**
5. **Use CDN for static assets**
6. **Schedule non-critical tasks** during off-peak hours

## Support and Maintenance

### Daily Tasks
- Monitor service health
- Check disk usage
- Review error logs

### Weekly Tasks
- Update Docker images
- Run security scans
- Backup verification
- Performance review

### Monthly Tasks
- Security patches
- Capacity planning
- Cost optimization
- User access review

## Conclusion

FetchText is a resource-intensive platform requiring careful planning for production deployment. For most users, starting with a capable VPS (32-64GB RAM) provides the best balance of cost, control, and complexity. As usage grows, consider migrating to managed services or Kubernetes for better scalability.

Key success factors:
1. Start small and scale gradually
2. Monitor everything from day one
3. Automate backups and updates
4. Plan for growth before you need it
5. Keep security as top priority

The modular architecture allows for flexible deployment strategies - you can start with everything on one server and gradually distribute services as needed.