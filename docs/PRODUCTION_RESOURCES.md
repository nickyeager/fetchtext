# Production Resources

This document is the single source of truth for all production infrastructure URLs, credentials locations, and service configurations.

**Last Updated:** 2026-02-03

---

## Quick Reference

| Service | Production URL | Local URL |
|---------|---------------|-----------|
| **Frontend (Dashboard)** | `https://kind-island-00cd78710.3.azurestaticapps.net` | `http://localhost:5173` |
| **Backend (Document Processor)** | `https://ft-dev-document-processor-uhqrm5.graystone-50b6fbc2.eastus2.azurecontainerapps.io` | `http://localhost:8090` |
| **Supabase (Database/Auth)** | `https://rawhmcrtzfdhryyfovee.supabase.co` | `http://localhost:8000` |
| **N8N (Self-hosted)** | `https://n8n.fetchtext.io` | `http://localhost:5678` |
| **N8N (Azure Container App)** | `https://ft-n8n.delightfulcliff-32bc35f3.eastus2.azurecontainerapps.io` | - |
| **Supabase Studio** | `https://app.supabase.com/project/rawhmcrtzfdhryyfovee` | `http://localhost:8005` |

---

## 1. Managed Supabase

| Property | Value |
|----------|-------|
| **Project ID** | `rawhmcrtzfdhryyfovee` |
| **Region** | `us-west-2` |
| **API URL** | `https://rawhmcrtzfdhryyfovee.supabase.co` |
| **Dashboard** | https://app.supabase.com/project/rawhmcrtzfdhryyfovee |
| **SQL Editor** | https://app.supabase.com/project/rawhmcrtzfdhryyfovee/sql/new |
| **Storage** | https://app.supabase.com/project/rawhmcrtzfdhryyfovee/storage/buckets |
| **Auth Settings** | https://app.supabase.com/project/rawhmcrtzfdhryyfovee/auth/users |

**Credentials Location:** Supabase Dashboard → Settings → API

---

## 2. N8N (Workflow Automation)

### Self-Hosted N8N (Primary)

| Property | Value |
|----------|-------|
| **Production URL** | `https://n8n.fetchtext.io` |
| **Local URL** | `http://localhost:5678` (internal) / `http://localhost:8001` (via Caddy) |
| **Webhook Base** | `https://n8n.fetchtext.io/webhook/` |

### Azure Container App N8N (Backup)

| Property | Value |
|----------|-------|
| **URL** | `https://ft-n8n.delightfulcliff-32bc35f3.eastus2.azurecontainerapps.io` |
| **Note** | Alternative deployment, may not have all workflows |

### Active Webhooks

| Webhook | Production URL | Purpose |
|---------|---------------|---------|
| Stripe Subscription | `https://n8n.fetchtext.io/webhook/stripe-subscription` | Handle Stripe events |
| Password Reset | `https://n8n.fetchtext.io/webhook/password-reset-email` | Send password reset emails |
| Welcome Email | `https://n8n.fetchtext.io/webhook/welcome-email` | Send welcome emails |
| Two-Factor | `https://n8n.fetchtext.io/webhook/two-factor-email` | Send 2FA codes |

### Required Credentials in N8N

- **Supabase API** - Service role key for database operations
- **SendGrid API** - For email delivery
- **Stripe API** - For payment webhooks (configure webhook secret)

---

## 3. Azure Services

### Azure Static Web App (Frontend)

| Property | Value |
|----------|-------|
| **App Name** | `documentprocessor` |
| **URL** | `https://kind-island-00cd78710.3.azurestaticapps.net` |
| **GitHub Workflow** | `.github/workflows/deploy-dashboard.yml` |
| **Deployment Trigger** | Push to `main` with changes in `localai-admin-dashboard/` |

**Previous Dashboard (deprecated):**
- Name: `ft-dev-dashboard-uhqrm5`
- URL: `https://red-river-0904afd10.3.azurestaticapps.net`

### Azure Container App (Backend)

| Property | Value |
|----------|-------|
| **App Name** | `ft-dev-document-processor-uhqrm5` |
| **Resource Group** | `nickcyeager-rg` |
| **URL** | `https://ft-dev-document-processor-uhqrm5.graystone-50b6fbc2.eastus2.azurecontainerapps.io` |
| **Health Endpoint** | `https://ft-dev-document-processor-uhqrm5.graystone-50b6fbc2.eastus2.azurecontainerapps.io/health` |
| **API Docs** | `https://ft-dev-document-processor-uhqrm5.graystone-50b6fbc2.eastus2.azurecontainerapps.io/docs` |
| **GitHub Workflow** | `.github/workflows/deploy-container-app.yml` |
| **Deployment Trigger** | Push to `main` with changes in `document-processor/` |

### Azure Container App (N8N)

| Property | Value |
|----------|-------|
| **App Name** | `ft-n8n` |
| **URL** | `https://ft-n8n.delightfulcliff-32bc35f3.eastus2.azurecontainerapps.io` |
| **Note** | Alternative to self-hosted N8N at `n8n.fetchtext.io` |

### Azure Container Registry

| Property | Value |
|----------|-------|
| **Registry Name** | `ftdevuhqrm5acr` |
| **Login Server** | `ftdevuhqrm5acr.azurecr.io` |
| **Image** | `ftdevuhqrm5acr.azurecr.io/document-processor:latest` |

### Azure OpenAI (Shared Instance)

| Property | Value |
|----------|-------|
| **Endpoint** | See `.env` or Azure Key Vault |
| **Region** | `eastus` |
| **Note** | API key stored in GitHub secret `AZURE_OPENAI_API_KEY` |

### Azure Identity

| Property | Value |
|----------|-------|
| **Tenant ID** | `ccb37c3a-9343-439f-b6cf-640d8a76b5f5` |
| **Subscription ID** | `9b59b2e8-2e75-459b-8632-b531c3bf5470` |
| **Service Principal Client ID** | `8137d884-7105-4f60-a229-abf6ddb5f818` |

---

## 4. Email Service (SendGrid)

| Property | Value |
|----------|-------|
| **Verified Sender** | `nick@fetchtext.io` |
| **From Name** | `FetchText` |
| **Dashboard** | https://app.sendgrid.com |

---

## 5. Stripe (Billing)

| Property | Value |
|----------|-------|
| **Dashboard** | https://dashboard.stripe.com |
| **Webhook Endpoint** | `https://n8n.fetchtext.io/webhook/stripe-subscription` |
| **Mode** | `[test/live - TODO]` |

### Products

| Tier | Price ID | Monthly |
|------|----------|---------|
| Starter (`non_managed`) | `price_[TODO]` | $29 |
| Professional | `price_[TODO]` | $99 |
| Enterprise | `price_[TODO]` | $499 |

---

## 6. Domain Configuration

| Domain | Purpose | DNS Provider |
|--------|---------|--------------|
| `fetchtext.io` | Main domain | [TODO] |
| `n8n.fetchtext.io` | N8N workflows | [TODO] |
| `app.fetchtext.io` | Dashboard (if using custom domain) | [TODO] |
| `api.fetchtext.io` | Backend API (if using custom domain) | [TODO] |

---

## 7. GitHub Configuration

### Repository

| Property | Value |
|----------|-------|
| **Repo** | `nickyeager/fetchtext` |
| **Actions** | https://github.com/nickyeager/fetchtext/actions |

### Required Secrets (as of 2026-02-03)

| Secret | Purpose | Set Date |
|--------|---------|----------|
| `AZURE_STATIC_WEB_APPS_API_TOKEN` | Deploy frontend | 2025-11-26 |
| `AZURE_CREDENTIALS` | Azure Service Principal JSON | 2025-11-29 |
| `AZURE_CONTAINERAPPS_RESOURCE_GROUP` | `nickcyeager-rg` | 2025-11-29 |
| `AZURE_CONTAINERAPP_NAME` | `ft-dev-document-processor-uhqrm5` | 2025-11-29 |
| `AZURE_ACR_NAME` | `ftdevuhqrm5acr` | 2025-11-29 |
| `AZURE_ACR_USERNAME` | ACR auth | 2025-12-01 |
| `AZURE_ACR_PASSWORD` | ACR auth | 2025-12-01 |
| `AZURE_CLIENT_ID` | Service Principal ID | 2025-11-29 |
| `AZURE_CLIENT_SECRET` | Service Principal secret | 2025-11-29 |
| `AZURE_TENANT_ID` | Azure AD tenant | 2025-11-29 |
| `AZURE_OPENAI_API_KEY` | Azure OpenAI key | 2025-12-01 |
| `VITE_SUPABASE_URL` | Supabase URL | 2025-12-06 |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon key | 2025-12-06 |
| `VITE_N8N_URL` | N8N webhook URL | 2025-12-04 |
| `SUPABASE_SERVICE_ROLE_KEY` | Backend service role | 2025-12-06 |
| `N8N_ENCRYPTION_KEY` | N8N encryption | 2025-12-07 |
| `N8N_JWT_SECRET` | N8N JWT secret | 2025-12-07 |
| `VM_NAME` | VM name | 2025-12-02 |
| `VM_PUBLIC_IP` | VM public IP | 2025-12-02 |
| `VM_RESOURCE_GROUP` | VM resource group | 2025-12-02 |
| `VM_SSH_PRIVATE_KEY` | VM SSH key | 2025-11-25 |
| `VM_SSH_USER` | VM SSH user | 2025-12-02 |

---

## 8. Environment Variable Mapping

### Local → Production

| Variable | Local Value | Production Value |
|----------|-------------|------------------|
| `VITE_SUPABASE_URL` | `http://localhost:8000` | `https://rawhmcrtzfdhryyfovee.supabase.co` |
| `VITE_N8N_URL` | `http://localhost:5678` | `https://n8n.fetchtext.io` |
| `VITE_DOCUMENT_PROCESSOR_URL` | `http://localhost:8090` | `https://ft-dev-document-processor-uhqrm5.graystone-50b6fbc2.eastus2.azurecontainerapps.io` |
| `FRONTEND_URL` | `http://localhost:5173` | `https://kind-island-00cd78710.3.azurestaticapps.net` |

---

## 9. Monitoring & Logs

| Service | Where to Find Logs |
|---------|-------------------|
| Frontend | Azure Portal → Static Web App → Logs |
| Backend | Azure Portal → Container App → Log stream |
| Database | Supabase Dashboard → Logs |
| N8N | N8N UI → Executions |
| Workflows | GitHub Actions tab |

---

## 10. Verification Script

Run the production verification script:

```bash
./scripts/verify-production.sh
```

Or check individual services:

```bash
./scripts/verify-production.sh --supabase
./scripts/verify-production.sh --github
./scripts/verify-production.sh --azure
```

---

## TODO: Fill in Missing Values

- [x] Azure Static Web App URL ✓
- [x] Azure Container App URL ✓
- [x] Azure Container Registry name ✓
- [ ] Azure OpenAI endpoint details (in Key Vault)
- [ ] Stripe Price IDs (after creating products in Stripe Dashboard)
- [ ] DNS provider information
- [ ] Clarify which N8N instance is primary (self-hosted vs Azure)

---

## Related Documentation

- [Deployment Verification Checklist](./deployment-verification-checklist.md)
- [Supabase Deployment Log](./supabase-deployment-log.md)
- [Architecture Overview](./architecture/ARCHITECTURE.md)
