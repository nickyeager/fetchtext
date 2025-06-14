# Paperspace Deployment Guide for Local AI Package

## 🎉 **Great Choice! Paperspace Setup Complete**

You've created your Paperspace machine! Now let's get your local-ai-packaged stack running. Follow these steps in order:

---

## 🚀 **Step 1: Access Your Paperspace Machine**

### **Connect to Your Machine:**
1. **Via Paperspace Console**: Use the browser-based terminal
2. **Via SSH** (if configured): 
   ```bash
   ssh paperspace@YOUR_MACHINE_IP
   ```
3. **Via VS Code** (recommended): Connect remotely for easier editing

### **Verify GPU Access:**
```bash
# Check if NVIDIA GPU is detected
nvidia-smi

# Should show your GPU (RTX A4000, M4000, etc.)
```

---

## 🔧 **Step 2: Prepare the Environment**

### **Update System & Install Dependencies:**
```bash
# Update package manager
sudo apt update && sudo apt upgrade -y

# Install essential tools
sudo apt install -y git curl wget nano htop

# Install Docker (if not already installed)
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Add user to docker group
sudo usermod -aG docker $USER

# Install Docker Compose
sudo apt install -y docker-compose-plugin

# Install Python and pip (usually pre-installed)
sudo apt install -y python3 python3-pip

# Verify installations
docker --version
docker compose version
python3 --version
```

### **Install NVIDIA Container Toolkit:**
```bash
# Add NVIDIA package repository
distribution=$(. /etc/os-release;echo $ID$VERSION_ID)
curl -s -L https://nvidia.github.io/nvidia-docker/gpgkey | sudo apt-key add -
curl -s -L https://nvidia.github.io/nvidia-docker/$distribution/nvidia-docker.list | sudo tee /etc/apt/sources.list.d/nvidia-docker.list

# Install nvidia-docker2
sudo apt update
sudo apt install -y nvidia-docker2

# Restart Docker daemon
sudo systemctl restart docker

# Test GPU access in Docker
docker run --rm --gpus all nvidia/cuda:11.8-runtime-ubuntu20.04 nvidia-smi
```

---

## 📁 **Step 3: Clone and Setup Your Project**

### **Clone the Repository:**
```bash
# Clone the local-ai-packaged repository
git clone -b stable https://github.com/coleam00/local-ai-packaged.git
cd local-ai-packaged

# Verify you're in the right directory
ls -la
# Should see: docker-compose.yml, start_services.py, README.md, etc.
```

### **Get Your Machine's Public IP:**
```bash
# Get your Paperspace machine's public IP
curl -s ifconfig.me
# Note this IP - you'll need it for DNS setup
```

---

## ⚙️ **Step 4: Configure Environment Variables**

### **Create Environment File:**
```bash
# Copy the example environment file
cp .env.example .env

# Edit the environment file
nano .env
```

### **Essential .env Configuration:**

#### **For Development/Testing (localhost access):**
```bash
############
# N8N Configuration
############
N8N_ENCRYPTION_KEY=your_random_32_char_key_here
N8N_USER_MANAGEMENT_JWT_SECRET=your_jwt_secret_here

############
# Supabase Secrets
############
POSTGRES_PASSWORD=your_secure_postgres_password
JWT_SECRET=your_jwt_secret_32_chars_minimum
ANON_KEY=your_anon_key_here
SERVICE_ROLE_KEY=your_service_role_key_here
DASHBOARD_USERNAME=admin
DASHBOARD_PASSWORD=your_dashboard_password
POOLER_TENANT_ID=your_tenant_id

############
# Neo4j Secrets
############   
NEO4J_AUTH=neo4j/your_neo4j_password

############
# Langfuse credentials
############
CLICKHOUSE_PASSWORD=your_clickhouse_password
MINIO_ROOT_PASSWORD=your_minio_password
LANGFUSE_SALT=your_langfuse_salt
NEXTAUTH_SECRET=your_nextauth_secret
ENCRYPTION_KEY=your_encryption_key

############
# Caddy Config (for production with custom domains)
############
# Uncomment and configure these for custom domains:
# N8N_HOSTNAME=n8n.yourdomain.com
# WEBUI_HOSTNAME=chat.yourdomain.com
# FLOWISE_HOSTNAME=flowise.yourdomain.com
# SUPABASE_HOSTNAME=supabase.yourdomain.com
# NEO4J_HOSTNAME=neo4j.yourdomain.com
# LANGFUSE_HOSTNAME=langfuse.yourdomain.com
# LETSENCRYPT_EMAIL=your-email@domain.com
```

### **Generate Secure Keys:**
```bash
# Generate random keys for your .env file
echo "N8N_ENCRYPTION_KEY=$(openssl rand -hex 16)"
echo "JWT_SECRET=$(openssl rand -hex 32)"
echo "POSTGRES_PASSWORD=$(openssl rand -hex 16)"
echo "NEXTAUTH_SECRET=$(openssl rand -hex 32)"
echo "LANGFUSE_SALT=$(openssl rand -hex 16)"
```

---

## 🚀 **Step 5: Deploy Your Stack**

### **For Development (Local IP Access):**
```bash
# Deploy with GPU support
python3 start_services.py --profile gpu-nvidia --environment private

# This will:
# 1. Clone Supabase repository
# 2. Start all services with GPU acceleration
# 3. Download Ollama models (this takes time!)
```

### **For Production (Custom Domains):**
```bash
# First configure your domains in .env file
# Then deploy with public environment
python3 start_services.py --profile gpu-nvidia --environment public
```

### **Monitor the Deployment:**
```bash
# Watch the logs during deployment
docker logs -f ollama

# Check all container status
docker ps

# Monitor resource usage
htop
nvidia-smi
```

---

## 🌐 **Step 6: Access Your Services**

### **With Private Environment (Development):**
Access via your Paperspace machine's public IP:

```
n8n:           http://YOUR_PAPERSPACE_IP:5678
Open WebUI:    http://YOUR_PAPERSPACE_IP:8080  
Flowise:       http://YOUR_PAPERSPACE_IP:3001
Supabase:      http://YOUR_PAPERSPACE_IP:8000
Neo4j:         http://YOUR_PAPERSPACE_IP:7474
Langfuse:      http://YOUR_PAPERSPACE_IP:3000
```

### **With Custom Domains (Production):**
If you configured domains in .env:
```
n8n:           https://n8n.yourdomain.com
Chat:          https://chat.yourdomain.com
Flowise:       https://flowise.yourdomain.com
Supabase:      https://supabase.yourdomain.com
```

---

## 🛠️ **Step 7: Initial Setup and Testing**

### **Setup n8n:**
1. Go to `http://YOUR_IP:5678`
2. Create your admin account (local only)
3. Import existing workflows from `/backup/workflows`
4. Configure credentials for Ollama: `http://ollama:11434`

### **Setup Open WebUI:**
1. Go to `http://YOUR_IP:8080`
2. Create your account (local only)
3. Verify Ollama connection
4. Test chat with your models

### **Test Ollama:**
```bash
# Check available models
docker exec ollama ollama list

# Test model directly
docker exec ollama ollama run qwen2.5:7b-instruct-q4_K_M "Hello, how are you?"
```

### **Verify Supabase:**
1. Go to `http://YOUR_IP:8000`
2. Access Supabase Studio
3. Check database connections

---

## 🔧 **Troubleshooting Common Issues**

### **If Services Won't Start:**
```bash
# Check Docker daemon
sudo systemctl status docker

# Check container logs
docker logs CONTAINER_NAME

# Restart specific service
docker restart CONTAINER_NAME
```

### **If GPU Not Detected:**
```bash
# Verify NVIDIA drivers
nvidia-smi

# Check Docker GPU access
docker run --rm --gpus all nvidia/cuda:11.8-runtime-ubuntu20.04 nvidia-smi

# Restart Docker if needed
sudo systemctl restart docker
```

### **If Models Download Slowly:**
```bash
# Check model download progress
docker logs ollama-pull-llama

# Monitor disk space
df -h

# Check network speed
speedtest-cli
```

---

## 📊 **Monitoring Your Deployment**

### **Check Resource Usage:**
```bash
# CPU and Memory
htop

# GPU usage
watch -n 1 nvidia-smi

# Docker stats
docker stats

# Disk usage
df -h
du -sh /var/lib/docker/
```

### **Health Monitoring:**
```bash
# Your existing health monitor
python3 monitor_services.py

# Check service status
python3 monitor_services.py --json
```

---

## 🎯 **Next Steps After Deployment**

### **Immediate Tasks:**
1. ✅ Verify all services are running
2. ✅ Test AI model inference
3. ✅ Create your first n8n workflow
4. ✅ Test the monitoring dashboard

### **Optional Enhancements:**
1. **Custom Domains**: Configure DNS and enable HTTPS
2. **Backup Strategy**: Set up automated backups
3. **Monitoring**: Configure alerts and logging
4. **Shadcn-Admin**: Deploy the custom dashboard we planned

### **Performance Optimization:**
```bash
# Optimize for your GPU
# In .env file:
OLLAMA_MAX_LOADED_MODELS=1
OLLAMA_NUM_PARALLEL=1
OLLAMA_CPU_THREADS=8
```

---

## 🔒 **Security Considerations**

### **Immediate Security Steps:**
```bash
# Change default passwords in .env
# Enable UFW firewall
sudo ufw enable
sudo ufw allow ssh
sudo ufw allow 80
sudo ufw allow 443

# If using private environment, allow specific ports
sudo ufw allow 5678  # n8n
sudo ufw allow 8080  # Open WebUI
sudo ufw allow 3001  # Flowise
```

### **For Production:**
- Configure custom domains with SSL
- Set up authentication for admin interfaces
- Regular security updates
- Monitor access logs

---

## 🎉 **You're All Set!**

Your Paperspace machine is now running a complete AI development environment with:
- ✅ GPU-accelerated Ollama
- ✅ n8n workflow automation
- ✅ Open WebUI for chat
- ✅ Supabase for data
- ✅ Vector databases and search
- ✅ Monitoring and observability

**Happy AI developing!** 🚀

---

## 📞 **Need Help?**

If you encounter issues:
1. Check the logs: `docker logs SERVICE_NAME`
2. Verify environment variables in `.env`
3. Ensure GPU drivers are working: `nvidia-smi`
4. Monitor resources: `htop` and `nvidia-smi`

Your Paperspace setup is perfect for this stack - it should deploy smoothly! 🎯 