# Deployment Verification Checklist

Use this checklist after deploying to production to ensure all systems are operational.

## Frontend (Azure Static Web App)

**URL:** https://[your-static-web-app].azurestaticapps.net

- [ ] Site loads without errors
- [ ] Login page accessible
- [ ] Can authenticate with test user
- [ ] Dashboard displays correctly
- [ ] Document upload page loads
- [ ] Template gallery displays templates

**Test Commands:**
```bash
# Check deployment status
gh run list --workflow="Deploy Dashboard" --limit 1

# Test site accessibility
curl -I https://[your-site].azurestaticapps.net
```

## Backend (Azure Container App)

**URL:** https://[your-container-app].azurecontainerapps.io

- [ ] Health endpoint responds: `/health`
- [ ] API documentation accessible: `/docs`
- [ ] Can process document upload
- [ ] Template matching works
- [ ] Field extraction completes

**Test Commands:**
```bash
# Check deployment status
gh run list --workflow="Deploy Document Processor" --limit 1

# Test health endpoint
curl https://[your-app].azurecontainerapps.io/health

# View logs
az containerapp logs show \
  --name [app-name] \
  --resource-group [rg-name] \
  --tail 50
```

## Managed Supabase Database

**URL:** https://rawhmcrtzfdhryyfovee.supabase.co

- [ ] Database schema matches local migrations
- [ ] RLS policies enabled on all tables
- [ ] Storage bucket `documents` exists
- [ ] Can authenticate via frontend
- [ ] Can query tables via PostgREST
- [ ] Template data seeded correctly

**Test Commands (SQL Editor):**
```sql
-- Verify tables exist
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public';

-- Check RLS enabled
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public';

-- Verify template data
SELECT COUNT(*) FROM smart_templates;
-- Expected: 8 or more

-- Test storage bucket
SELECT * FROM storage.buckets WHERE name = 'documents';
```

## Integration Tests

- [ ] Upload document via frontend
- [ ] Verify document appears in dashboard
- [ ] Check document processing status updates
- [ ] Verify extracted fields display
- [ ] Test template selection workflow
- [ ] Verify user authentication flow

## Rollback Readiness

- [ ] Previous deployment SHA recorded
- [ ] Database backup exists (Supabase PITR enabled)
- [ ] Rollback commands documented below

**Rollback Commands:**
```bash
# Rollback frontend
gh workflow run deploy-dashboard.yml

# Rollback backend
az containerapp revision list \
  --name [app-name] \
  --resource-group [rg-name] \
  -o table

az containerapp revision activate \
  --name [app-name] \
  --resource-group [rg-name] \
  --revision [previous-revision-name]
```

## Post-Deployment

- [ ] Deployment logged in `docs/supabase-deployment-log.md`
- [ ] Team notified of deployment
- [ ] Monitoring dashboards checked
- [ ] Error tracking reviewed (next 1 hour)

---

**Deployment Date:** _______________
**Deployed By:** _______________
**All Checks Passed:** [ ] Yes [ ] No
**Issues Encountered:** _______________
