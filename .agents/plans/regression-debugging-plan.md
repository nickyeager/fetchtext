# Regression Test Debugging Plan

**Date:** 2026-02-15
**Branch:** main (commit 3dda02e)
**Tested against:** Production (`ft-dev-document-processor-uhqrm5.graystone-50b6fbc2.eastus2.azurecontainerapps.io`)

---

## Test Results Summary

| Test Suite | Result | Pass | Fail |
|------------|--------|------|------|
| env-services-regression (vs prod) | **FAIL** | 29 | **2** |
| template-rag-performance (vs prod) | PASS | 3 | 0 |
| streaming-processing (vs prod) | PASS | 6 | 0 |
| document-id-validation (vs prod) | PASS | 7 | 0 |
| template-matching-regression (vs prod) | **FAIL** | 1 | **1** |
| Production Playwright e2e | PASS | 3 | 0 |
| Backend Python regression (vs local) | PASS | 7 | 0 |

**Total: 3 failures across 2 test suites**

---

## Failure #1: Production email not configured

**Test:** `env-services-regression > Backend Email Service Health > email health must report configured=true`
**Error:** `expected false to be true`

### Root Cause
Production `/api/email/health` returns:
```json
{
  "configured": false,
  "from_email": "nick@fetchtext.io",
  "app_url": ""
}
```

Two issues:
1. **`configured: false`** — `SENDGRID_API_KEY` env var is not set in the Azure Container App
2. **`app_url: ""`** — `APP_URL` env var is not set in the Azure Container App

### Evidence
- Local Docker has these vars via `docker-compose.yml` and root `.env` — passes locally
- `deploy-container-app.yml` does NOT pass `SENDGRID_API_KEY` or `APP_URL` as env vars to the container
- The workflow only sets: `AZURE_OPENAI_API_KEY`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SERVICE_ROLE_KEY`, `ALLOWED_ORIGINS`

### Fix
Add `SENDGRID_API_KEY`, `SENDGRID_FROM_EMAIL`, `SENDGRID_FROM_NAME`, and `APP_URL` to the `deploy-container-app.yml` workflow as secrets/env vars passed to the Azure Container App:

**File:** `.github/workflows/deploy-container-app.yml`
**Section:** `az containerapp update` step — add to `--set-env-vars`:
```
SENDGRID_API_KEY=secretref:sendgrid-api-key \
SENDGRID_FROM_EMAIL=nick@fetchtext.io \
SENDGRID_FROM_NAME=FetchText \
APP_URL=https://fetchtext.io
```
Also add `sendgrid-api-key` to the `az containerapp secret set` step using `${{ secrets.SENDGRID_API_KEY }}`.

### Impact
- Email invitations silently fail in production
- All email delivery (org invitations, notifications) is broken on production

---

## Failure #2: CORS header not returned for localhost origin against production

**Test:** `env-services-regression > CORS: Backend Returns CORS Headers > backend must return Access-Control-Allow-Origin for allowed origin`
**Error:** `expected null to be truthy`

### Root Cause
The test sends `Origin: http://localhost:5173` against production. Production's `ALLOWED_ORIGINS` only includes:
```json
["https://fetchtext.io", "https://www.fetchtext.io"]
```

So production correctly does NOT return CORS headers for `localhost`. This is **expected behavior** — production should not allow localhost origins.

### Fix
This is a **test bug**, not a production bug. The test should:
- When running against production, use `Origin: https://fetchtext.io` instead of `http://localhost:5173`
- OR skip this specific assertion when `VITE_DOCUMENT_PROCESSOR_URL` points to production

**File:** `localai-admin-dashboard/src/__tests__/integration/env-services-regression.test.ts`
**Fix:** Make the Origin header dynamic based on the backend URL being tested.

### Impact
- False negative — production CORS is actually working correctly (confirmed by Playwright e2e passing)

---

## Failure #3: Template matching doesn't recognize identical documents

**Test:** `template-matching-regression > should match an existing template when uploading the same document twice`
**Error:** `expected 'generated' to be 'use_existing'`

### Root Cause
When uploading the same document twice to `/decide-template`:
1. First upload: `action=generated` — generates "Contract Template" (but template ID is `undefined`)
2. Second upload: `action=generated` — generates again instead of matching

Key observations from test output:
- **Template ID is `undefined` after generation** — the auto_save didn't persist properly, or the response doesn't include the generated template's database ID
- **No vector matching occurred** — `match_score`, `extraction_quality`, `validation_level` are all `undefined` in `decision_metadata`
- The closest existing template scored `combined_score: 0.287` (well below 0.5 threshold)
- **4 of 7 fields failed extraction** on the closest match: Payment Terms, Key Terms, Contract Parties, Contract Type

The auto-saved template from the first upload either:
1. Didn't get saved to the database (template_id is undefined)
2. Didn't get indexed in Qdrant for vector search
3. Got saved but the second scan doesn't find it because vector embeddings weren't created

### Investigation Steps
1. Check if `auto_save=true` actually inserts into `smart_templates` table on production Supabase
2. Check if the template vector service indexes new templates into Qdrant after generation
3. Check if the Qdrant collection exists on production (Qdrant is local-only — **may not exist in production at all**)
4. Check the `/decide-template` code path: does `auto_save` trigger both DB insert AND Qdrant indexing?

### Likely Root Cause
**Qdrant is not deployed to production.** It runs as a Docker container locally but is not part of the Azure Container Apps deployment. The template vector service silently fails and falls back to keyword matching only, which doesn't score high enough.

### Fix Options
1. **Deploy Qdrant to production** — add as a sidecar or separate Container App
2. **Improve keyword matching fallback** — ensure auto-saved templates are found by keyword matching on the second upload
3. **Fix auto_save persistence** — ensure the generated template gets a valid database ID and is queryable

### Impact
- Template re-use is broken on production — every upload generates a new template even for identical documents
- Template bloat in the database over time

---

## Priority Order

| # | Fix | Severity | Effort |
|---|-----|----------|--------|
| 1 | Add SendGrid/APP_URL env vars to production deploy | **Critical** — emails broken | Low (workflow change) |
| 2 | Fix CORS test to use correct origin for production | Low — false negative | Low (test fix) |
| 3 | Fix template matching on production | **High** — core feature broken | Medium-High (infra + code) |

---

## Passing Tests (Confirmed Working)

- Backend health endpoint: reachable on production
- CORS config: production returns correct allowed origins for `fetchtext.io`
- CI/CD workflow validation: all required env vars present in YAML files
- Docker Compose validation: all required vars present
- Qdrant: reachable locally (not applicable to production)
- Streaming endpoint: SSE events, stages, progress, timing all working
- Template-RAG performance: responds within 30s
- Document ID validation: source code guards present
- Production Playwright e2e: login, upload, CORS all working in real browser
- Backend Python regression (local): all 7 tests pass
