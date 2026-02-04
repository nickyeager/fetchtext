# Vault RPC Functions - Remote Deployment Guide

**Date:** 2025-01-21
**Migration:** 021_add_vault_rpc_functions.sql

This document provides the SQL statements needed to deploy the Vault RPC functions to the remote/production Supabase instance.

---

## Prerequisites

- Access to Supabase SQL Editor for project: `rawhmcrtzfdhryyfovee`
- The Supabase Vault extension must be enabled (it is by default in Supabase)

---

## SQL to Execute in Remote Instance

Copy and paste this entire block into the Supabase SQL Editor:

```sql
-- ============================================================================
-- Migration: 021_add_vault_rpc_functions
-- Description: Add RPC functions for secure credential storage via Supabase Vault
-- Date: 2025-01-21
-- ============================================================================

-- ============================================================================
-- Vault RPC Functions
-- ============================================================================

-- Insert a new secret into the vault
-- Returns the secret UUID
CREATE OR REPLACE FUNCTION vault_insert_secret(
  new_name TEXT,
  new_secret TEXT,
  new_description TEXT DEFAULT ''
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = vault, public
AS $$
DECLARE
  secret_id UUID;
BEGIN
  INSERT INTO vault.secrets (name, secret, description)
  VALUES (new_name, new_secret, new_description)
  RETURNING id INTO secret_id;

  RETURN secret_id;
END;
$$;

-- Read a secret from the vault by ID
-- Returns the decrypted secret value
CREATE OR REPLACE FUNCTION vault_read_secret(
  secret_id UUID
) RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = vault, public
AS $$
DECLARE
  secret_value TEXT;
BEGIN
  SELECT decrypted_secret INTO secret_value
  FROM vault.decrypted_secrets
  WHERE id = secret_id;

  RETURN secret_value;
END;
$$;

-- Delete a secret from the vault by ID
-- Returns true if deleted, false if not found
CREATE OR REPLACE FUNCTION vault_delete_secret(
  secret_id UUID
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = vault, public
AS $$
DECLARE
  rows_deleted INTEGER;
BEGIN
  DELETE FROM vault.secrets
  WHERE id = secret_id;

  GET DIAGNOSTICS rows_deleted = ROW_COUNT;

  RETURN rows_deleted > 0;
END;
$$;

-- ============================================================================
-- Access Control (CRITICAL SECURITY)
-- ============================================================================
-- Restrict Vault functions to service_role only (backend access)
-- This prevents any authenticated user from accessing all secrets

REVOKE ALL ON FUNCTION vault_insert_secret FROM PUBLIC;
REVOKE ALL ON FUNCTION vault_read_secret FROM PUBLIC;
REVOKE ALL ON FUNCTION vault_delete_secret FROM PUBLIC;

GRANT EXECUTE ON FUNCTION vault_insert_secret TO service_role;
GRANT EXECUTE ON FUNCTION vault_read_secret TO service_role;
GRANT EXECUTE ON FUNCTION vault_delete_secret TO service_role;

-- ============================================================================
-- Comments
-- ============================================================================

COMMENT ON FUNCTION vault_insert_secret IS 'Store a secret in Supabase Vault. Returns the secret UUID. Restricted to service_role.';
COMMENT ON FUNCTION vault_read_secret IS 'Retrieve and decrypt a secret from Vault by ID. Restricted to service_role.';
COMMENT ON FUNCTION vault_delete_secret IS 'Delete a secret from Vault. Returns true if deleted. Restricted to service_role.';
```

---

## Verification

After running the SQL, verify the functions were created:

```sql
-- Check functions exist
SELECT routine_name, routine_type
FROM information_schema.routines
WHERE routine_schema = 'public'
AND routine_name LIKE 'vault_%';

-- Expected output:
-- vault_insert_secret | FUNCTION
-- vault_read_secret   | FUNCTION
-- vault_delete_secret | FUNCTION
```

Verify access control is properly set:

```sql
-- Check function privileges (should show only service_role)
SELECT grantee, privilege_type
FROM information_schema.routine_privileges
WHERE routine_name LIKE 'vault_%';
```

---

## Test the Functions (Optional)

Test inserting and reading a secret:

```sql
-- Insert a test secret
SELECT vault_insert_secret('test-key-remote', 'test-secret-value', 'Test description');
-- Returns: UUID

-- Read it back (replace with the UUID from above)
SELECT vault_read_secret('YOUR-UUID-HERE');
-- Returns: test-secret-value

-- Delete it
SELECT vault_delete_secret('YOUR-UUID-HERE');
-- Returns: true
```

---

## Rollback (if needed)

If you need to remove these functions:

```sql
DROP FUNCTION IF EXISTS vault_insert_secret;
DROP FUNCTION IF EXISTS vault_read_secret;
DROP FUNCTION IF EXISTS vault_delete_secret;
```

---

## Related Files

- Local migration file: `supabase/migrations/021_add_vault_rpc_functions.sql`
- Backend service using these functions: `document-processor/app/services/vault_service.py`
- Code review: `.agents/code-reviews/2025-01-21-azure-provisioning-db-integration.md`

---

## Deployment Checklist

- [ ] Applied SQL to production Supabase (SQL Editor)
- [ ] Verified functions exist
- [ ] Verified access control (only service_role has EXECUTE)
- [ ] Tested with insert/read/delete cycle
- [ ] Document processor backend has `SUPABASE_SERVICE_ROLE_KEY` environment variable set
