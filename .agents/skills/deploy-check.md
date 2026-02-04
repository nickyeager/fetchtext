---
name: deploy-check
description: Verify all production services are up to date and healthy. Checks Supabase, Azure, GitHub Actions, and local Docker.
---

# Production Deployment Verification

This skill checks all production infrastructure components and reports their status.

## What This Skill Checks

| Service | Check Type | Details |
|---------|-----------|---------|
| **Managed Supabase** | Health, Tables, RLS | Instance: `rawhmcrtzfdhryyfovee` |
| **Azure Container App** | Running status, Health endpoint | Document Processor backend |
| **Azure Static Web App** | Active status | Frontend dashboard |
| **GitHub Actions** | Last deployment status | Both dashboard and backend workflows |
| **Azure OpenAI** | Provisioned instances | Enterprise customer resources |
| **Local Docker** | Container status | Development environment |
| **Migrations** | Sync status | Local vs production schema |

## Execution Steps

### 1. Run the Verification Script

```bash
# Full verification (all services)
./scripts/verify-production.sh

# Or check specific services:
./scripts/verify-production.sh --supabase
./scripts/verify-production.sh --github
./scripts/verify-production.sh --azure
./scripts/verify-production.sh --docker
./scripts/verify-production.sh --migrations
```

### 2. Check Supabase Directly (MCP)

Use the Supabase MCP tool to verify the managed instance:

```
# List tables
mcp__supabase__list_tables(project_id="rawhmcrtzfdhryyfovee", schemas=["public"])

# List migrations
mcp__supabase__list_migrations(project_id="rawhmcrtzfdhryyfovee")

# Check for security issues
mcp__supabase__get_advisors(project_id="rawhmcrtzfdhryyfovee", type="security")

# Check for performance issues
mcp__supabase__get_advisors(project_id="rawhmcrtzfdhryyfovee", type="performance")
```

### 3. Check GitHub Actions Status

```bash
# Using gh CLI
gh run list --repo nickyeager/fetchtext --workflow deploy-dashboard.yml --limit 3
gh run list --repo nickyeager/fetchtext --workflow deploy-container-app.yml --limit 3

# View specific run
gh run view --repo nickyeager/fetchtext [RUN_ID]
```

### 4. Check Azure Services (requires az CLI)

```bash
# Login if needed
az login

# Check Container App
az containerapp show --name $AZURE_CONTAINERAPP_NAME --resource-group $AZURE_CONTAINERAPPS_RESOURCE_GROUP

# List Azure OpenAI resources
az cognitiveservices account list --query "[?kind=='OpenAI']"
```

### 5. Check Local Docker Services

```bash
# List running containers
docker compose -p localai ps

# Check document processor health
curl http://localhost:8090/health

# Check logs
docker compose -p localai logs document-processor --tail=20
```

## Expected Output

A healthy production environment shows:

```
═══════════════════════════════════════════════════════════════
  FetchText Production Verification
═══════════════════════════════════════════════════════════════

▶ Managed Supabase (rawhmcrtzfdhryyfovee)
─────────────────────────────────────────────────────────────────
  ✓ Supabase REST API reachable
  ✓ Supabase Auth service healthy
  ✓ Supabase Storage service reachable
  ✓ Database tables accessible (smart_templates)

▶ GitHub Actions Deployments
─────────────────────────────────────────────────────────────────
  ✓ Dashboard deployment: SUCCESS
  ✓ Backend deployment: SUCCESS

▶ Azure Cloud Services
─────────────────────────────────────────────────────────────────
  ✓ Azure CLI authenticated
  ✓ Container App: Running
  ✓ Backend health endpoint responding

═══════════════════════════════════════════════════════════════
  Verification Summary
═══════════════════════════════════════════════════════════════
  Passed:   12
  Failed:   0
  Warnings: 2
  Total:    14

✓ All checks passed!
```

## Troubleshooting Common Issues

### Supabase REST API Unreachable
- Check if managed Supabase is paused (free tier auto-pauses)
- Verify network connectivity
- Check Supabase status page: https://status.supabase.com/

### GitHub Actions Deployment Failed
- Check workflow logs: `gh run view --log`
- Verify secrets are configured in repo settings
- Check for merge conflicts or build errors

### Azure Container App Not Running
- Check Container App logs in Azure Portal
- Verify image was pushed to ACR
- Check environment variables/secrets

### Migration Drift Detected
- Compare `supabase/migrations/` with `docs/supabase-deployment-log.md`
- Apply missing migrations to production via SQL Editor
- Document in deployment log

## Quick Commands Reference

```bash
# Full production check
./scripts/verify-production.sh

# Trigger new deployment
git push origin main

# Monitor deployment
./scripts/monitor-deployment.sh

# Apply migration to production
# 1. Copy SQL from supabase/migrations/XXX_*.sql
# 2. Go to https://app.supabase.com/project/rawhmcrtzfdhryyfovee/sql/new
# 3. Paste and execute
# 4. Document in docs/supabase-deployment-log.md
```

## Related Files

- Script: `scripts/verify-production.sh`
- Deployment log: `docs/supabase-deployment-log.md`
- Verification checklist: `docs/deployment-verification-checklist.md`
- GitHub workflows: `.github/workflows/deploy-*.yml`
