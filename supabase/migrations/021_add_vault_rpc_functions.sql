-- Migration: 021_add_vault_rpc_functions
-- Description: Add RPC functions for secure credential storage via Supabase Vault
-- Date: 2025-01-21

-- ============================================================================
-- Vault Extension Check
-- ============================================================================
-- Note: Supabase Vault extension should already be enabled. If not:
-- CREATE EXTENSION IF NOT EXISTS supabase_vault;

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
-- Access Control
-- ============================================================================
-- Restrict Vault functions to service_role only (backend access)
-- This prevents any authenticated user from accessing all secrets

-- Revoke from all roles explicitly (PUBLIC, anon, authenticated)
REVOKE ALL ON FUNCTION vault_insert_secret FROM PUBLIC;
REVOKE ALL ON FUNCTION vault_insert_secret FROM anon;
REVOKE ALL ON FUNCTION vault_insert_secret FROM authenticated;
REVOKE ALL ON FUNCTION vault_read_secret FROM PUBLIC;
REVOKE ALL ON FUNCTION vault_read_secret FROM anon;
REVOKE ALL ON FUNCTION vault_read_secret FROM authenticated;
REVOKE ALL ON FUNCTION vault_delete_secret FROM PUBLIC;
REVOKE ALL ON FUNCTION vault_delete_secret FROM anon;
REVOKE ALL ON FUNCTION vault_delete_secret FROM authenticated;

GRANT EXECUTE ON FUNCTION vault_insert_secret TO service_role;
GRANT EXECUTE ON FUNCTION vault_read_secret TO service_role;
GRANT EXECUTE ON FUNCTION vault_delete_secret TO service_role;

-- ============================================================================
-- Comments
-- ============================================================================

COMMENT ON FUNCTION vault_insert_secret IS 'Store a secret in Supabase Vault. Returns the secret UUID. Restricted to service_role.';
COMMENT ON FUNCTION vault_read_secret IS 'Retrieve and decrypt a secret from Vault by ID. Restricted to service_role.';
COMMENT ON FUNCTION vault_delete_secret IS 'Delete a secret from Vault. Returns true if deleted. Restricted to service_role.';
