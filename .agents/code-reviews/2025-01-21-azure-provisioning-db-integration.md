# Code Review: Azure Provisioning Database Integration

**Date:** 2025-01-21
**Reviewer:** Claude Code
**Focus:** New provisioning-related Python services and SQL migration

---

## Stats

- Files Modified: 0 (for this review scope)
- Files Added: 4
- Files Deleted: 0
- New lines: ~650
- Deleted lines: 0

**Files Reviewed:**
- `document-processor/app/services/provisioning_db_service.py`
- `document-processor/app/services/vault_service.py`
- `document-processor/app/services/azure_provisioning_service.py`
- `document-processor/app/models/provisioning.py`
- `supabase/migrations/021_add_vault_rpc_functions.sql`

---

## Issues Found

### HIGH Severity

```
severity: high
file: document-processor/app/services/azure_provisioning_service.py
line: 155, 189, 284
issue: Synchronous blocking calls inside async functions
detail: The `poller.result(timeout=...)` calls are synchronous blocking operations from the Azure SDK. When called inside async functions, they block the entire event loop, preventing other coroutines from running. This could cause timeouts and poor performance under load.
suggestion: Use `asyncio.to_thread()` to run the blocking Azure SDK calls in a thread pool:
  result = await asyncio.to_thread(poller.result, timeout=PROVISIONING_TIMEOUT_SECONDS)
```

```
severity: high
file: document-processor/app/services/provisioning_db_service.py
line: 263
issue: Potential secret name collision in Vault
detail: Using only first 8 characters of organization_id (`organization_id[:8]`) for the secret name could lead to collisions. UUIDs can share the same first 8 characters, especially if organizations are created in similar time windows (first portion of UUID v4 is random but v1 is timestamp-based).
suggestion: Use more characters or the full UUID: `secret_name = f"azure-openai-key-{organization_id}"` or at minimum 12+ characters: `organization_id[:12]`
```

```
severity: high
file: supabase/migrations/021_add_vault_rpc_functions.sql
line: 17, 39, 59
issue: Missing access control on Vault RPC functions
detail: The SECURITY DEFINER functions run with owner privileges but have no explicit GRANT/REVOKE statements. By default, PUBLIC may have EXECUTE permission, allowing any authenticated user to read/write/delete ANY secret in the vault.
suggestion: Add explicit grants to restrict access to service_role only:
  REVOKE ALL ON FUNCTION vault_insert_secret FROM PUBLIC;
  GRANT EXECUTE ON FUNCTION vault_insert_secret TO service_role;
  -- Same for read and delete functions
```

### MEDIUM Severity

```
severity: medium
file: document-processor/app/services/azure_provisioning_service.py
line: 246-264
issue: No cleanup of orphaned Azure resources on partial failure
detail: If provisioning succeeds for steps 1-2 (create resource, deploy model) but fails at step 3 (get keys) or step 4 (store credentials), the Azure resource is left orphaned. The organization is marked as failed but the Azure resource continues to exist and incur costs.
suggestion: Add cleanup logic in the exception handler to attempt deletion of the created resource if it exists, or implement a cleanup job that finds orphaned resources.
```

```
severity: medium
file: document-processor/app/services/provisioning_db_service.py
line: 291-316
issue: Race condition in check-then-act pattern
detail: The pattern of checking if config exists (GET) then deciding to PATCH vs POST has a TOCTOU (time-of-check to time-of-use) race condition. Two concurrent requests could both see no config exists and both attempt POST, causing a duplicate key error.
suggestion: Use UPSERT pattern with PostgreSQL's ON CONFLICT clause, or use PostgREST's `Prefer: resolution=merge-duplicates` header for upsert behavior.
```

```
severity: medium
file: document-processor/app/services/provisioning_db_service.py
line: 417-424
issue: Missing response status check after deprovisioning PATCH
detail: After resetting org config during deprovisioning, the PATCH response status is not checked. If the update fails, the function still returns True, potentially leaving the database in an inconsistent state.
suggestion: Add response status check:
  if response.status_code not in (200, 204):
      logger.error(f"Failed to reset org config: {response.status_code}")
      return False
```

### LOW Severity

```
severity: low
file: document-processor/app/services/azure_provisioning_service.py
line: 270
issue: Unused parameter log_callback
detail: The log_callback parameter in deprovision_instance is accepted but never used after the refactor to use DB logging. This creates confusion about the API contract.
suggestion: Either remove the parameter or document it as deprecated. If kept for backward compatibility, add a deprecation warning.
```

```
severity: low
file: document-processor/app/services/vault_service.py
line: 90, 123
issue: Type mismatch between function signature and RPC expectation
detail: Functions accept `secret_id: str` but the PostgreSQL RPC functions expect UUID type. While PostgreSQL will cast strings to UUID, explicit handling would be more robust.
suggestion: Add UUID validation or type conversion:
  from uuid import UUID
  secret_uuid = UUID(secret_id)  # Raises ValueError if invalid
```

```
severity: low
file: document-processor/app/services/provisioning_db_service.py
line: 41
file: document-processor/app/services/vault_service.py
line: 33
issue: Imprecise type annotation on _get_headers
detail: Return type is `dict` but should be `Dict[str, str]` for better type safety and IDE support.
suggestion: Change to `def _get_headers(self) -> Dict[str, str]:`
```

---

## Summary

**3 High**, **3 Medium**, **3 Low** issues found.

The most critical issues are:
1. **Blocking sync calls in async context** - Could cause performance issues under load
2. **Vault secret name collision risk** - Could cause data loss/corruption
3. **Missing Vault RPC access control** - Security vulnerability

The code is well-structured and follows project patterns. The main concerns are around robustness under concurrent/high-load scenarios and the security of the Vault RPC functions.

---

## Recommended Actions

1. **Immediate**: Add access control GRANTs to Vault RPC functions
2. **Before production**: Fix the blocking async issue with `asyncio.to_thread()`
3. **Before production**: Extend secret name to use full UUID or more characters
4. **Nice to have**: Add orphan resource cleanup mechanism
