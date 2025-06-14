# Production Deployment Strategy for Shadcn-Admin Extension

## 🏗️ **Current Production Architecture Analysis**

Based on the local-ai-packaged README and configuration, here's how production deployment works and how we'll integrate our shadcn-admin extension:

### **Existing Production Strategy**

1. **Caddy Reverse Proxy**
   - Automatic HTTPS with Let's Encrypt
   - Domain-based routing to services
   - Single entry point (ports 80/443 only)

2. **Environment-Based Configuration**
   - `--environment public` closes all ports except 80/443
   - All services communicate via internal Docker network
   - Domain names configured via environment variables

3. **Security Model**
   - UFW firewall (ports 80, 443 only)
   - All traffic routed through Caddy
   - Docker services not directly exposed

---

## 🚀 **Shadcn-Admin Production Integration Plan**

### **Step 1: Environment Configuration**

#### **Add to .env file for production:**
```bash
############
# Shadcn Admin Dashboard
############
ADMIN_DASHBOARD_HOSTNAME=admin.yourdomain.com
ADMIN_DASHBOARD_PORT=3005
```

#### **Update Caddyfile:**
```caddyfile
# Add to existing Caddyfile
# Shadcn Admin Dashboard
{$ADMIN_DASHBOARD_HOSTNAME} {
    reverse_proxy shadcn-admin:3005
    
    # Optional: Add authentication
    # basicauth {
    #     admin $2a$14$...hashed_password...
    # }
    
    # Security headers
    header {
        X-Frame-Options "DENY"
        X-Content-Type-Options "nosniff"
        Referrer-Policy "strict-origin-when-cross-origin"
        Permissions-Policy "geolocation=(), microphone=(), camera=()"
    }
}
```

### **Step 2: Docker Integration**

#### **Add to docker-compose.yml:**
```yaml
services:
  # ... existing services ...

  shadcn-admin:
    build: ./localai-admin-dashboard
    container_name: shadcn-admin
    restart: unless-stopped
    expose:
      - 3005/tcp
    environment:
      # Production API endpoints (internal Docker network)
      - VITE_API_BASE_URL=https://${ADMIN_DASHBOARD_HOSTNAME}
      - VITE_OLLAMA_API=http://ollama:11434/api
      - VITE_N8N_API=http://n8n:5678/api/v1
      - VITE_SUPABASE_URL=http://kong:8000
      - VITE_QDRANT_URL=http://qdrant:6333
      - VITE_NEO4J_URL=http://neo4j:7474
      - VITE_MONITORING_WS=ws://localhost:8888/ws
      - NODE_ENV=production
    volumes:
      - ./shared:/app/shared:ro  # Access to shared files
    networks:
      - default
    depends_on:
      - n8n
      - ollama-cpu  # or ollama-gpu variants
      - postgres
      - kong
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3005/health"]
      interval: 30s
      timeout: 10s
      retries: 3
```

#### **Add to docker-compose.override.public.yml:**
```yaml
services:
  shadcn-admin:
    ports: !reset null  # Remove port mapping for production
```

### **Step 3: Production Build Configuration**

#### **Create production Dockerfile:**
```dockerfile
# Multi-stage build for production
FROM node:18-alpine AS builder

WORKDIR /app

# Install pnpm
RUN npm install -g pnpm

# Copy package files
COPY package.json pnpm-lock.yaml ./

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source code
COPY . .

# Build for production
RUN pnpm run build

# Production stage
FROM nginx:alpine

# Copy built assets
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy nginx configuration
COPY nginx.conf /etc/nginx/nginx.conf

# Add health check endpoint
RUN echo '{"status":"healthy"}' > /usr/share/nginx/html/health

# Security: Run as non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nextjs -u 1001 && \
    chown -R nextjs:nodejs /usr/share/nginx/html

USER nextjs

EXPOSE 3005

CMD ["nginx", "-g", "daemon off;"]
```

#### **Create nginx.conf:**
```nginx
events {
    worker_connections 1024;
}

http {
    include       /etc/nginx/mime.types;
    default_type  application/octet-stream;
    
    # Security headers
    add_header X-Frame-Options "DENY" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    
    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types
        text/plain
        text/css
        text/xml
        text/javascript
        application/javascript
        application/xml+rss
        application/json;

    server {
        listen 3005;
        server_name _;
        root /usr/share/nginx/html;
        index index.html;

        # Handle React Router
        location / {
            try_files $uri $uri/ /index.html;
        }

        # Health check endpoint
        location /health {
            access_log off;
            return 200 '{"status":"healthy"}';
            add_header Content-Type application/json;
        }

        # Static assets caching
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
        }

        # Security: Hide nginx version
        server_tokens off;
    }
}
```

### **Step 4: Production Environment Variables**

#### **Complete .env production configuration:**
```bash
############
# Production Deployment
############
ENVIRONMENT=production

############
# Caddy Config (Production Domains)
############
N8N_HOSTNAME=n8n.yourdomain.com
WEBUI_HOSTNAME=chat.yourdomain.com
FLOWISE_HOSTNAME=flowise.yourdomain.com
SUPABASE_HOSTNAME=supabase.yourdomain.com
NEO4J_HOSTNAME=neo4j.yourdomain.com
LANGFUSE_HOSTNAME=langfuse.yourdomain.com
ADMIN_DASHBOARD_HOSTNAME=admin.yourdomain.com
LETSENCRYPT_EMAIL=admin@yourdomain.com

############
# Security Settings
############
ADMIN_BASIC_AUTH_USER=admin
ADMIN_BASIC_AUTH_PASS=secure_random_password_here

############
# API Configuration for Admin Dashboard
############
VITE_API_BASE_URL=https://admin.yourdomain.com
VITE_ENABLE_ANALYTICS=true
VITE_ENABLE_ERROR_REPORTING=true
```

### **Step 5: DNS Configuration**

#### **Required DNS A Records:**
```dns
; Point to your server's public IP
admin.yourdomain.com.     300    IN    A    YOUR_SERVER_IP
n8n.yourdomain.com.       300    IN    A    YOUR_SERVER_IP  
chat.yourdomain.com.      300    IN    A    YOUR_SERVER_IP
flowise.yourdomain.com.   300    IN    A    YOUR_SERVER_IP
supabase.yourdomain.com.  300    IN    A    YOUR_SERVER_IP
neo4j.yourdomain.com.     300    IN    A    YOUR_SERVER_IP
langfuse.yourdomain.com.  300    IN    A    YOUR_SERVER_IP
```

### **Step 6: Production Deployment Script**

#### **Create deploy-production.sh:**
```bash
#!/bin/bash

set -e

echo "🚀 Deploying Local AI Stack with Shadcn Admin to Production"

# Validate environment
if [ ! -f ".env" ]; then
    echo "❌ .env file not found. Please configure production environment."
    exit 1
fi

# Check required environment variables
required_vars=("ADMIN_DASHBOARD_HOSTNAME" "LETSENCRYPT_EMAIL" "POSTGRES_PASSWORD")
for var in "${required_vars[@]}"; do
    if [ -z "${!var}" ]; then
        echo "❌ Required environment variable $var not set"
        exit 1
    fi
done

# Build the admin dashboard
echo "🏗️ Building Shadcn Admin Dashboard..."
cd localai-admin-dashboard
pnpm install --frozen-lockfile
pnpm run build
cd ..

# Stop existing services
echo "🛑 Stopping existing services..."
python start_services.py --profile cpu --environment public down || true

# Pull latest images
echo "📦 Pulling latest container images..."
docker compose -p localai -f docker-compose.yml pull

# Start services in production mode
echo "🚀 Starting services in production mode..."
python start_services.py --profile gpu-nvidia --environment public

# Wait for services to be healthy
echo "⏳ Waiting for services to be healthy..."
sleep 30

# Check service health
echo "🔍 Checking service health..."
docker compose -p localai ps

echo "✅ Production deployment complete!"
echo "🌐 Admin Dashboard: https://${ADMIN_DASHBOARD_HOSTNAME}"
echo "🔧 N8N: https://${N8N_HOSTNAME}"
echo "💬 Chat: https://${WEBUI_HOSTNAME}"
```

---

## 🔒 **Security Considerations**

### **Authentication & Authorization**

1. **Basic Auth for Admin Dashboard** (Recommended for Phase 1)
   ```caddyfile
   {$ADMIN_DASHBOARD_HOSTNAME} {
       basicauth {
           {$ADMIN_BASIC_AUTH_USER} {$ADMIN_BASIC_AUTH_PASS}
       }
       reverse_proxy shadcn-admin:3005
   }
   ```

2. **Supabase Auth Integration** (Phase 2)
   - Use existing Supabase auth
   - JWT token validation
   - Role-based access control

### **Network Security**

1. **Firewall Rules**
   ```bash
   # UFW configuration
   ufw enable
   ufw allow 80/tcp
   ufw allow 443/tcp
   ufw allow ssh
   ufw reload
   ```

2. **Docker Network Isolation**
   - All services communicate via internal network
   - No direct port exposure
   - Caddy as single entry point

### **Data Protection**

1. **SSL/TLS Encryption**
   - Automatic Let's Encrypt certificates
   - HSTS headers
   - Secure cookie settings

2. **Content Security Policy**
   ```nginx
   add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self' wss: https:;" always;
   ```

---

## 📊 **Monitoring & Observability**

### **Health Checks**

1. **Docker Health Checks**
   ```yaml
   healthcheck:
     test: ["CMD", "curl", "-f", "http://localhost:3005/health"]
     interval: 30s
     timeout: 10s
     retries: 3
     start_period: 40s
   ```

2. **External Monitoring**
   - Uptime monitoring services
   - SSL certificate expiration alerts
   - Performance monitoring

### **Logging**

1. **Centralized Logging**
   ```yaml
   logging:
     driver: "json-file"
     options:
       max-size: "10m"
       max-file: "3"
   ```

2. **Log Aggregation**
   - ELK Stack integration
   - Grafana Loki
   - Cloud logging services

---

## 🚀 **Deployment Commands**

### **Production Deployment**
```bash
# Initial deployment
git clone https://github.com/your-repo/local-ai-packaged.git
cd local-ai-packaged

# Configure environment
cp .env.example .env
# Edit .env with production values

# Deploy
chmod +x deploy-production.sh
./deploy-production.sh
```

### **Updates & Maintenance**
```bash
# Update containers
docker compose -p localai pull
python start_services.py --profile gpu-nvidia --environment public

# Update admin dashboard
cd localai-admin-dashboard
git pull
pnpm run build
docker compose -p localai restart shadcn-admin
```

### **Backup & Recovery**
```bash
# Backup data volumes
docker run --rm -v localai_postgres_data:/source -v $(pwd):/backup alpine tar czf /backup/postgres-backup.tar.gz -C /source .

# Backup configuration
tar czf config-backup.tar.gz .env docker-compose.yml Caddyfile
```

---

## 🎯 **Production Readiness Checklist**

### **Pre-Deployment**
- [ ] Domain names registered and DNS configured
- [ ] SSL certificates tested (Let's Encrypt)
- [ ] Environment variables configured
- [ ] Security settings applied
- [ ] Backup strategy implemented

### **Post-Deployment**
- [ ] All services accessible via HTTPS
- [ ] Admin dashboard authentication working
- [ ] API integrations functional
- [ ] Monitoring and alerts configured
- [ ] Performance benchmarks established

### **Ongoing Maintenance**
- [ ] Regular security updates
- [ ] SSL certificate renewal monitoring
- [ ] Backup verification
- [ ] Performance monitoring
- [ ] Log rotation and cleanup

---

## 🔄 **Rollback Strategy**

### **Quick Rollback**
```bash
# Stop current deployment
docker compose -p localai down

# Restore from backup
tar xzf config-backup.tar.gz
docker compose -p localai up -d
```

### **Blue-Green Deployment** (Future Enhancement)
- Parallel deployment environments
- Traffic switching via Caddy
- Zero-downtime updates

---

*This production deployment strategy ensures that the shadcn-admin extension integrates seamlessly with the existing local-ai-packaged infrastructure while maintaining security, scalability, and reliability standards.* 