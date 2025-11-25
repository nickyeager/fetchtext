# Azure VM Auto-Deployment

This document describes the automated deployment workflow for the Azure VM running the self-hosted Docker Compose stack.

## Overview

When you push changes to the `main` branch, GitHub Actions automatically deploys updates to the Azure VM, which runs the complete FetchText stack including:

- **Supabase** (PostgreSQL, Auth, Storage, Kong gateway)
- **N8N** (Workflow automation)
- **Ollama** (Local LLMs)
- **Document Processor** (FastAPI backend)
- **Admin Dashboard** (React frontend)

## Workflow File

- **Location**: [.github/workflows/deploy-vm.yml](../.github/workflows/deploy-vm.yml)
- **Triggers**:
  - Push to `main` branch (with relevant file changes)
  - Manual trigger via `workflow_dispatch`

## Required GitHub Secrets

Configure these secrets in your GitHub repository settings (`Settings` → `Secrets and variables` → `Actions`):

### 1. `VM_PUBLIC_IP`
- **Description**: Public IP address of the Azure VM
- **Example**: `20.185.123.45`
- **How to find**:
  ```bash
  az vm show -g <resource-group> -n <vm-name> -d --query publicIps -o tsv
  ```

### 2. `VM_SSH_USER`
- **Description**: SSH username for the VM
- **Example**: `supabaseadmin`
- **Note**: This is the `adminUsername` you used when deploying the VM

### 3. `VM_SSH_PRIVATE_KEY`
- **Description**: Private SSH key for authentication
- **Format**: Complete private key including headers
- **Example**:
  ```
  -----BEGIN OPENSSH PRIVATE KEY-----
  b3BlbnNzaC1rZXktdjEAAAAABG5vbmUAAAAEbm9uZQAAAAAAAAABAAAAMwAAAAtzc2gtZW
  ... (your key content) ...
  -----END OPENSSH PRIVATE KEY-----
  ```
- **How to get**:
  ```bash
  cat ~/.ssh/id_ed25519  # or your key file
  ```

## Setting Up GitHub Secrets

### Via GitHub Web Interface

1. Go to your repository on GitHub
2. Click **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret**
4. Add each secret:
   - Name: `VM_PUBLIC_IP`
   - Value: `<your-vm-ip>`
   - Click **Add secret**
5. Repeat for `VM_SSH_USER` and `VM_SSH_PRIVATE_KEY`

### Via GitHub CLI

```bash
# Set VM_PUBLIC_IP
gh secret set VM_PUBLIC_IP --body "20.185.123.45"

# Set VM_SSH_USER
gh secret set VM_SSH_USER --body "supabaseadmin"

# Set VM_SSH_PRIVATE_KEY from file
gh secret set VM_SSH_PRIVATE_KEY < ~/.ssh/id_ed25519
```

## Deployment Workflow

### Automatic Deployment (on push to main)

```bash
git add .
git commit -m "Update document processor"
git push origin main
```

GitHub Actions will:
1. ✅ **Connect** to the VM via SSH
2. ✅ **Backup** the database (optional)
3. ✅ **Pull** latest code from `main` branch
4. ✅ **Build** and restart Docker services
5. ✅ **Health check** Supabase Kong and Document Processor
6. ✅ **Report** deployment status
7. ❌ **Rollback** automatically if health checks fail

### Manual Deployment

Trigger manually from GitHub Actions UI:

1. Go to **Actions** tab
2. Select **Deploy to Azure VM** workflow
3. Click **Run workflow**
4. Optional: Check "Skip database backup" if needed
5. Click **Run workflow**

## Deployment Process Details

### 1. Pre-Deployment Backup

By default, the workflow creates a database backup before deploying:

```bash
cd /srv/supabase
sudo bash scripts/backup/run-supabase-backup.sh
```

To skip backup (faster deployments):
- Manual trigger: Check "Skip database backup"
- In workflow: Modify `skip_backup` input

### 2. Code Update

```bash
cd /srv/supabase
git fetch origin
git reset --hard origin/main
```

### 3. Docker Image Update

```bash
docker compose pull
docker compose up -d --build --remove-orphans
docker image prune -f
```

### 4. Health Checks

The workflow verifies services are healthy:

- **Supabase Kong**: `http://localhost:8000/health` (5-minute timeout)
- **Document Processor**: `http://localhost:8090/health` (5-minute timeout)

### 5. Automatic Rollback

If health checks fail:

```bash
git reset --hard HEAD@{1}  # Revert to previous commit
docker compose up -d --build
```

## Monitoring Deployments

### View Deployment Logs

1. Go to **Actions** tab in GitHub
2. Click on the latest **Deploy to Azure VM** run
3. Expand steps to see detailed logs

### Check Service Status on VM

```bash
ssh supabaseadmin@<vm-ip>
cd /srv/supabase
docker compose ps
docker compose logs -f --tail=100
```

### View Deployment Summary

After each deployment, GitHub Actions creates a summary showing:
- Deployment status
- VM IP
- Commit SHA
- Services deployed/failed

## Troubleshooting

### Deployment Fails with SSH Connection Error

**Problem**: Cannot connect to VM

**Solutions**:
1. Verify VM is running:
   ```bash
   az vm get-instance-view -g <resource-group> -n <vm-name> --query instanceView.statuses
   ```

2. Check NSG allows GitHub Actions IPs:
   ```bash
   az network nsg rule list -g <resource-group> --nsg-name <nsg-name> -o table
   ```

3. Verify SSH key matches:
   ```bash
   ssh-keygen -l -f ~/.ssh/id_ed25519.pub  # Local
   ssh supabaseadmin@<vm-ip> "cat ~/.ssh/authorized_keys"  # VM
   ```

### Health Check Timeout

**Problem**: Services don't respond within 5 minutes

**Solutions**:
1. Check service logs on VM:
   ```bash
   docker compose logs supabase-kong
   docker compose logs document-processor
   ```

2. Increase timeout in workflow:
   ```yaml
   env:
     HEALTH_CHECK_TIMEOUT: 600  # 10 minutes
   ```

3. Verify services are actually running:
   ```bash
   docker compose ps
   curl http://localhost:8000/health
   ```

### Rollback Doesn't Fix Issue

**Problem**: Rollback succeeds but services still broken

**Solutions**:
1. SSH into VM and check Docker state:
   ```bash
   docker compose down
   docker system prune -af
   docker compose up -d
   ```

2. Check disk space:
   ```bash
   df -h
   docker system df
   ```

3. Review Docker logs:
   ```bash
   docker compose logs --tail=200
   ```

## File Change Triggers

The workflow only runs when specific files change:

- `docker-compose.yml` or `docker-compose.*.yml` - Service configuration
- `document-processor/**` - Backend API changes
- `localai-admin-dashboard/**` - Frontend changes
- `supabase/**` - Database migrations
- `.env.example` - Environment template
- `.github/workflows/deploy-vm.yml` - Workflow itself

To force deployment without file changes:
- Use **Manual Deployment** from GitHub Actions UI
- Create an empty commit: `git commit --allow-empty -m "Trigger deployment"`

## Security Best Practices

1. **SSH Key Rotation**:
   - Rotate SSH keys every 90 days
   - Update `VM_SSH_PRIVATE_KEY` secret after rotation
   - Remove old keys from VM's `authorized_keys`

2. **Network Security**:
   - Restrict VM NSG to only necessary IPs
   - Use Azure Bastion for admin access
   - Consider private IP deployment with VPN

3. **Secret Management**:
   - Never commit `.env` files with real secrets
   - Use Azure Key Vault for production secrets
   - Rotate Supabase keys regularly

## Integration with Other Workflows

The VM deployment is part of a hybrid architecture:

### Production Deployments

| Component | Deployment Target | Workflow |
|-----------|------------------|----------|
| Frontend Dashboard | Azure Static Web Apps | [deploy-dashboard.yml](../.github/workflows/deploy-dashboard.yml) |
| Document Processor (Cloud) | Azure Container Apps | [deploy-container-app.yml](../.github/workflows/deploy-container-app.yml) |
| Full Stack (Self-hosted) | Azure VM | [deploy-vm.yml](../.github/workflows/deploy-vm.yml) |

### Deployment Strategy

- **Cloud services** use managed Supabase and Azure PaaS
- **VM deployment** runs the complete self-hosted stack
- Both can run simultaneously for redundancy/testing

## Next Steps

- [ ] Set up monitoring alerts for deployment failures
- [ ] Configure blue-green deployment for zero-downtime updates
- [ ] Add integration tests before deployment
- [ ] Set up automatic database backups to Azure Storage

## Related Documentation

- [Azure VM Infrastructure](../infra/vm/README.md)
- [Docker Compose Setup](../README.md)
- [Backup Strategy](../scripts/backup/README.md)
- [GitHub Actions Overview](https://docs.github.com/en/actions)
