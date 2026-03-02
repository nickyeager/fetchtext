# Code Review: All Changes Since 2026-02-03

**Date:** 2026-02-15
**Reviewer:** Claude Opus 4.6 (3 parallel review agents)
**Scope:** Commits `2c6dc77..120c9e2` (~20 commits, 110 files changed, +11,080 / -6,863 lines)
**Focus Areas:** Backend Python (20 files), Frontend TypeScript (35 files), Infrastructure (6 files)

---

## Stats

- Files Modified: ~60
- Files Added: ~30
- Files Deleted: ~20
- New lines: ~11,080
- Deleted lines: ~6,863

---

## CRITICAL Issues (4)

### 1. SendGrid API Key Exposed in Frontend Bundle

```
severity: critical
file: .github/workflows/deploy-dashboard.yml
line: 60, 74
issue: VITE_SENDGRID_API_KEY embedded in client-side JavaScript bundle
detail: All VITE_* variables are compiled into the JS bundle and readable by anyone viewing
  source. SendGrid keys allow sending emails on your behalf - attackers can send spam,
  phish from your domain, exhaust quota, or get your account suspended.
suggestion: Remove VITE_SENDGRID_API_KEY from frontend build entirely. Email operations
  MUST happen server-side only (N8N workflows or document-processor backend, which already
  has SENDGRID_API_KEY configured securely). Delete the VITE_SENDGRID_API_KEY lines from
  deploy-dashboard.yml and any frontend code referencing it.
```

### 2. Missing Authentication on Snowflake Endpoints

```
severity: critical
file: document-processor/app/routers/snowflake.py
line: 50-126 (all endpoints)
issue: No authentication/authorization on any Snowflake endpoint
detail: Any unauthenticated user can test connections, list databases/schemas/stages, and
  download files for ANY organization_id. This is a data breach vulnerability - an attacker
  can enumerate org IDs and access other organizations' Snowflake data.
suggestion: Add authentication dependency to all routes. Verify the requesting user has
  access to the specified organization_id before executing any operation.
```

### 3. Missing Authentication on Integration Endpoints

```
severity: critical
file: document-processor/app/routers/integrations.py
line: 50-126, 170-203, 372-466
issue: No authentication on OAuth and credential management endpoints
detail: Any user can initiate OAuth for any organization, store malicious credentials in
  any org's vault, or disconnect legitimate integrations. Combined with Snowflake endpoints,
  this gives full unauthenticated access to third-party integrations.
suggestion: Add authentication middleware or Depends(get_current_user) to all routes in
  both snowflake.py and integrations.py routers. Verify org membership before operations.
```

### 4. SQL Injection Risk in Snowflake Service

```
severity: critical
file: document-processor/app/services/snowflake_service.py
line: 266, 300-304
issue: Dynamic SQL construction with f-strings in Snowflake queries
detail: Database/schema/stage names are interpolated into SQL via f-strings:
  cursor.execute(f"SHOW SCHEMAS IN DATABASE {database}"). While _validate_identifier()
  provides basic protection, edge cases with Snowflake's quoting rules could be exploited.
suggestion: Use Snowflake's IDENTIFIER() function for parameterized identifiers:
  cursor.execute("SHOW SCHEMAS IN DATABASE IDENTIFIER(%s)", [database])
```

---

## HIGH Issues (5)

### 5. Blocking I/O in Async Event Loop

```
severity: high
file: document-processor/app/services/snowflake_service.py
line: 524-642
issue: _convert_csv(), _convert_json(), _convert_parquet() perform blocking file I/O
detail: These methods use open(), csv.reader, json.load in the async event loop without
  asyncio.to_thread() wrapping. Other Snowflake operations are correctly wrapped, but file
  conversion methods are not. Large files will freeze all concurrent requests.
suggestion: Wrap in asyncio.to_thread():
  return await asyncio.to_thread(self._convert_csv, file_path, max_rows)
```

### 6. Storage RLS Policy Too Permissive

```
severity: high
file: supabase/migrations/024_add_storage_policies.sql
line: 20-38
issue: ANY authenticated user can read/write/delete ALL files in documents bucket
detail: Policies grant full bucket access to all authenticated users with no ownership
  filtering. User A can view and delete User B's private documents. No data isolation
  between organizations.
suggestion: Add ownership filtering:
  USING (bucket_id = 'documents' AND owner_id = auth.uid())
  Or use folder-based isolation: (storage.foldername(name))[1] = auth.uid()::text
```

### 7. AbortController Memory Leak in Streaming Hook

```
severity: high
file: localai-admin-dashboard/src/hooks/use-processing-stream.ts
line: 93-98
issue: No useEffect cleanup for AbortController when component unmounts during streaming
detail: If user navigates away while streaming is active, the SSE connection remains open
  indefinitely - causing network traffic, server resource consumption, and memory leaks.
suggestion: Add cleanup effect:
  useEffect(() => { return () => { abortRef.current?.abort(); }; }, []);
```

### 8. Double Processing Risk in Upload Page

```
severity: high
file: localai-admin-dashboard/src/features/documents/components/DocumentUploadPage.tsx
line: 99-213
issue: Stream completion effect may fire twice due to stream.result reference changes
detail: The effect depends on stream.result (an object), which could be recreated with same
  data but different reference. handledResultRef guards against this but the effect also
  depends on stream.status which is more reliable.
suggestion: Remove stream.result from dependencies. Only trigger on stream.status ===
  'complete' and use handledResultRef strictly. Add additional guard checking if document
  is already finalized.
```

### 9. Secret Exposure in Snowflake Error Messages

```
severity: high
file: document-processor/app/services/snowflake_service.py
line: 229, 358-359
issue: Exception messages returned to client may contain credentials or internal paths
detail: f"Connection failed: {str(e)}" passes raw exception text to API response. Snowflake
  auth errors may contain partial key content, account identifiers, or file paths.
suggestion: Return sanitized errors:
  {"success": False, "message": "Connection failed. Check credentials.", "error_code": "AUTH_FAILED"}
```

---

## MEDIUM Issues (7)

### 10. Unstable useCallback Dependencies

```
severity: medium
file: localai-admin-dashboard/src/hooks/use-processing-stream.ts
line: 226
issue: progress state in dependency array causes callback reference instability
detail: progress changes inside onmessage, causing startProcessing reference to change
  mid-stream. This can cause unexpected re-renders and breaks dependency tracking.
suggestion: Remove progress from the dependency array. It's set inside the callback
  but doesn't need to be a dependency.
```

### 11. Hardcoded Port Replacement for OAuth Redirect

```
severity: medium
file: localai-admin-dashboard/src/features/settings/integrations/snowflake-settings.tsx
line: 404
issue: window.location.origin.replace('5173', '8090') breaks in production
detail: The OAuth redirect URI is constructed by replacing the dev port. In production
  where ports differ, this produces an incorrect redirect URI causing OAuth failure.
suggestion: Use VITE_DOCUMENT_PROCESSOR_URL environment variable instead:
  ${import.meta.env.VITE_DOCUMENT_PROCESSOR_URL || 'http://localhost:8090'}/api/integrations/...
```

### 12. Vault Secret Upsert Race Condition

```
severity: medium
file: document-processor/app/services/vault_service.py
line: 97-115
issue: 409 conflict handling uses get-delete-create pattern vulnerable to races
detail: Two concurrent upserts of the same secret: both hit 409, both get same old ID,
  first deletes successfully, second delete fails, both try to create -> second fails.
suggestion: Add retry with exponential backoff on 409 conflicts.
```

### 13. Stripe IDs Lack Uniqueness Constraints

```
severity: medium
file: supabase/migrations/023_add_stripe_columns_to_organizations.sql
line: 6-8
issue: stripe_customer_id and stripe_subscription_id have no unique constraints
detail: Multiple organizations could share the same Stripe customer/subscription ID,
  causing webhook processing to update the wrong organization.
suggestion: Add partial unique indexes:
  CREATE UNIQUE INDEX organizations_stripe_customer_id_key
  ON organizations(stripe_customer_id) WHERE stripe_customer_id IS NOT NULL;
```

### 14. SSE Error Handling Lacks Upload-Stage Differentiation

```
severity: medium
file: document-processor/app/routers/stream.py
line: 464-470
issue: Outer exception handler doesn't distinguish upload failure from processing failure
detail: If _save_uploaded_file() fails, temp_file_path is never set but the error message
  is generic. Client can't tell if upload or processing failed.
suggestion: Track upload completion state and include stage info in error events.
```

### 15. Qdrant Collection Left in Partial State on Index Failure

```
severity: medium
file: document-processor/app/services/template_vector_service.py
line: 78-106
issue: If create_collection succeeds but create_payload_index fails, collection is misconfigured
detail: Index creation failures are silently caught with pass, leaving the collection
  without proper indexes. Filtered searches may return incorrect results.
suggestion: Either fail atomically (delete collection on index failure) or validate
  indexes exist before marking collection as available.
```

### 16. Silent Template Save Failure

```
severity: medium
file: localai-admin-dashboard/src/features/documents/components/DocumentUploadPage.tsx
line: 133-158
issue: Generated template save failure is logged but user is not notified
detail: Database insert for auto-generated template has try-catch that console.errors but
  doesn't show toast. User loses template with no indication.
suggestion: Add toast.error('Template generated but failed to save') in catch block.
```

---

## LOW Issues (3)

### 17. Missing File Path Validation on Snowflake Downloads

```
severity: low
file: document-processor/app/routers/snowflake.py
line: 134-136
issue: request.file_path not validated for path traversal patterns
detail: While Snowflake's API handles paths, adding Pydantic validation prevents
  potential issues with temp file handling downstream.
suggestion: Add @validator('file_path') checking for '..' and absolute paths.
```

### 18. PostHog Key in Frontend (Acceptable but Document)

```
severity: low
file: .github/workflows/deploy-dashboard.yml
line: 49, 61, 72-73
issue: VITE_POSTHOG_KEY embedded in client bundle
detail: PostHog keys are designed to be public, but exposed keys allow fake event
  injection and analytics pollution.
suggestion: Ensure PostHog project has rate limiting and bot detection enabled.
  No code change needed.
```

### 19. Unmount Race in StageFileBrowser

```
severity: low
file: localai-admin-dashboard/src/components/snowflake/StageFileBrowser.tsx
line: 117-139
issue: setState in finally block may fire after component unmount
detail: handleProcessSingle has async operations with setState in finally. If component
  unmounts during processing, React will warn about state updates on unmounted components.
suggestion: Add mounted ref check before setState in finally block.
```

---

## Summary by Severity

| Severity | Count | Key Areas |
|----------|-------|-----------|
| **CRITICAL** | 4 | SendGrid key exposure, missing auth (2 routers), SQL injection |
| **HIGH** | 5 | Blocking I/O, storage RLS, memory leak, double processing, secret exposure |
| **MEDIUM** | 7 | Race conditions, missing constraints, error handling gaps |
| **LOW** | 3 | Validation, analytics key, unmount races |
| **TOTAL** | **19** | |

## Recommended Fix Priority

**Immediate (before next deploy):**
1. Remove `VITE_SENDGRID_API_KEY` from `deploy-dashboard.yml` (Issue #1)
2. Add authentication to `snowflake.py` and `integrations.py` routers (Issues #2, #3)
3. Sanitize error messages in Snowflake service (Issue #9)

**This sprint:**
4. Fix SQL injection with IDENTIFIER() parameterization (Issue #4)
5. Wrap file conversion in asyncio.to_thread (Issue #5)
6. Tighten storage RLS policies (Issue #6)
7. Add AbortController cleanup to streaming hook (Issue #7)
8. Add unique constraints to Stripe columns (Issue #13)

**Next sprint:**
9. Fix double processing guard (Issue #8)
10. Remaining medium/low issues
