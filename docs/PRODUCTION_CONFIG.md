# Production Configuration Reference

This document describes the required configuration for deploying FetchText to production. **Actual values are stored in GitHub Secrets and Azure Portal - not in this file.**

## Required GitHub Secrets

### Frontend Build (Static Web App)

| Secret | Description | Where to Find |
|--------|-------------|---------------|
| `VITE_SUPABASE_URL` | Supabase API URL | Supabase Dashboard → Settings → API |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon key | Supabase Dashboard → Settings → API |
| `VITE_DOCUMENT_PROCESSOR_URL` | Document processor API URL | Azure Portal → Container App → Overview → Application URL |
| `VITE_N8N_URL` | N8N webhook base URL | Azure Portal → Container App → Overview → Application URL |
| `VITE_OLLAMA_URL` | Ollama API URL (optional) | Only for local LLM deployments |
| `AZURE_STATIC_WEB_APPS_API_TOKEN` | SWA deployment token | Azure Portal → Static Web App → Manage deployment token |

### Backend Build (Container App)

| Secret | Description | Where to Find |
|--------|-------------|---------------|
| `AZURE_CREDENTIALS` | Azure service principal JSON | `az ad sp create-for-rbac --sdk-auth` |
| `AZURE_ACR_NAME` | Container registry name | Azure Portal → Container Registry → Overview |
| `AZURE_ACR_USERNAME` | ACR username | Azure Portal → Container Registry → Access keys |
| `AZURE_ACR_PASSWORD` | ACR password | Azure Portal → Container Registry → Access keys |
| `AZURE_CONTAINERAPPS_RESOURCE_GROUP` | Resource group name | Azure Portal → Resource Groups |
| `AZURE_CONTAINERAPP_NAME` | Container app name | Azure Portal → Container Apps → Overview |
| `AZURE_OPENAI_API_KEY` | Azure OpenAI API key | Azure Portal → Azure OpenAI → Keys and Endpoint |
| `AZURE_OPENAI_ENDPOINT` | Azure OpenAI endpoint URL | Azure Portal → Azure OpenAI → Keys and Endpoint |
| `AZURE_OPENAI_DEPLOYMENT_NAME` | Model deployment name | Azure OpenAI Studio → Deployments |
| `AZURE_OPENAI_API_VERSION` | API version (e.g., 2025-01-01-preview) | Azure OpenAI documentation |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key | Supabase Dashboard → Settings → API |

---

## Architecture Overview

```
┌─────────────────┐     ┌──────────────────────┐     ┌─────────────────┐
│   fetchtext.io  │────▶│  Document Processor  │────▶│    Supabase     │
│  (Static Web)   │     │   (Container App)    │     │   (Managed)     │
└─────────────────┘     └──────────────────────┘     └─────────────────┘
                               │
                               ▼
                        ┌──────────────────────┐
                        │   Azure OpenAI       │
                        │   (LLM Provider)     │
                        └──────────────────────┘
```

---

## Deployment Workflows

| Workflow | Triggers | Deploys To |
|----------|----------|------------|
| `deploy-dashboard.yml` | Push to `localai-admin-dashboard/**` | Azure Static Web App |
| `deploy-container-app.yml` | Push to `document-processor/**` | Azure Container App |

---

## Local Development

For local development, copy `.env.example` files and configure:

```bash
# Frontend
cp localai-admin-dashboard/.env.example localai-admin-dashboard/.env.local

# Backend
cp .env.example .env
```

See README.md for full development setup instructions.

---

## Health Check Endpoints

- **Document Processor:** `{DOCUMENT_PROCESSOR_URL}/health`
- **N8N:** `{N8N_URL}/healthz`
- **Frontend:** `https://fetchtext.io`

---

## Last Updated
- **Date:** 2025-02-10
