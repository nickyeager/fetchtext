-- Migration: 023_integration_credentials
-- Description: Add generic OAuth integration credentials for third-party services
-- Date: 2025-01-26
--
-- This migration creates a reusable pattern for storing OAuth tokens and
-- integration status for any third-party service (Google, QuickBooks, Microsoft, etc.)

-- ============================================================================
-- Organization Integrations Table
-- ============================================================================
-- Stores OAuth tokens and integration-specific credentials per organization.
-- Actual secrets (tokens) are stored in Supabase Vault, this table holds references.

CREATE TABLE IF NOT EXISTS organization_integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- Integration type (extensible - add new types as needed)
  -- Common types: google, quickbooks, microsoft, dropbox, slack, salesforce
  integration_type TEXT NOT NULL,

  -- OAuth state management (for CSRF protection during flow)
  oauth_state TEXT,
  oauth_state_expires_at TIMESTAMPTZ,

  -- Token storage (vault references - NEVER store actual tokens here)
  access_token_vault_id TEXT,
  refresh_token_vault_id TEXT,
  token_expires_at TIMESTAMPTZ,

  -- Granted scopes (what permissions the user approved)
  scopes TEXT[] DEFAULT '{}',

  -- Integration-specific metadata (e.g., QB company_id, MS tenant_id)
  metadata JSONB DEFAULT '{}',

  -- Connection status
  status TEXT DEFAULT 'pending' CHECK (status IN (
    'pending',     -- OAuth initiated but not completed
    'connected',   -- Successfully connected and tokens valid
    'expired',     -- Tokens expired and refresh failed
    'revoked',     -- User or admin revoked access
    'error'        -- Connection error (see last_error)
  )),
  last_error TEXT,
  last_sync_at TIMESTAMPTZ,

  -- Audit fields
  connected_by UUID REFERENCES auth.users(id),
  connected_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- One integration type per organization
  UNIQUE(organization_id, integration_type)
);

-- ============================================================================
-- Integration Token Refresh Log
-- ============================================================================
-- Tracks token refresh operations for debugging and audit

CREATE TABLE IF NOT EXISTS integration_token_refreshes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_id UUID NOT NULL REFERENCES organization_integrations(id) ON DELETE CASCADE,

  refresh_reason TEXT CHECK (refresh_reason IN ('expired', 'manual', 'preemptive', 'error_recovery')),
  success BOOLEAN NOT NULL,
  error_message TEXT,

  old_token_expires_at TIMESTAMPTZ,
  new_token_expires_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- Document Generation Jobs
-- ============================================================================
-- Tracks async document generation requests (create docs in Google, Word, etc.)

CREATE TABLE IF NOT EXISTS document_generation_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- Source data
  source_document_id INTEGER REFERENCES documents(id) ON DELETE SET NULL,
  template_id INTEGER REFERENCES smart_templates(id) ON DELETE SET NULL,

  -- Generation target
  target_integration TEXT NOT NULL CHECK (target_integration IN (
    'google_docs',
    'word_online',
    'local_docx',
    'local_pdf'
  )),
  target_folder_id TEXT,          -- Drive folder ID, OneDrive path, etc.
  target_file_name TEXT,

  -- Variable data for generation
  extracted_fields JSONB NOT NULL DEFAULT '{}',
  generation_config JSONB DEFAULT '{}',

  -- Status tracking
  status TEXT DEFAULT 'pending' CHECK (status IN (
    'pending',
    'processing',
    'completed',
    'failed',
    'cancelled'
  )),

  -- Result
  generated_document_id TEXT,     -- ID in target system
  generated_document_url TEXT,    -- URL to generated document
  error_message TEXT,

  -- Timing
  created_at TIMESTAMPTZ DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,

  created_by UUID REFERENCES auth.users(id)
);

-- ============================================================================
-- Indexes
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_org_integrations_org_id ON organization_integrations(organization_id);
CREATE INDEX IF NOT EXISTS idx_org_integrations_type ON organization_integrations(integration_type);
CREATE INDEX IF NOT EXISTS idx_org_integrations_status ON organization_integrations(status);
CREATE INDEX IF NOT EXISTS idx_org_integrations_expires ON organization_integrations(token_expires_at)
  WHERE status = 'connected';

CREATE INDEX IF NOT EXISTS idx_token_refreshes_integration ON integration_token_refreshes(integration_id);
CREATE INDEX IF NOT EXISTS idx_token_refreshes_created ON integration_token_refreshes(created_at);

CREATE INDEX IF NOT EXISTS idx_doc_gen_jobs_org ON document_generation_jobs(organization_id);
CREATE INDEX IF NOT EXISTS idx_doc_gen_jobs_status ON document_generation_jobs(status);
CREATE INDEX IF NOT EXISTS idx_doc_gen_jobs_created ON document_generation_jobs(created_at);

-- ============================================================================
-- Row Level Security
-- ============================================================================

ALTER TABLE organization_integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE integration_token_refreshes ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_generation_jobs ENABLE ROW LEVEL SECURITY;

-- Organization Integrations: Org admins/owners can manage
CREATE POLICY "Org admins can view integrations"
  ON organization_integrations
  FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid() AND role IN ('admin', 'owner')
    )
  );

CREATE POLICY "Org admins can insert integrations"
  ON organization_integrations
  FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid() AND role IN ('admin', 'owner')
    )
  );

CREATE POLICY "Org admins can update integrations"
  ON organization_integrations
  FOR UPDATE
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid() AND role IN ('admin', 'owner')
    )
  );

CREATE POLICY "Org admins can delete integrations"
  ON organization_integrations
  FOR DELETE
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid() AND role IN ('admin', 'owner')
    )
  );

-- Service role and anon (backend) full access
CREATE POLICY "Service role full access on integrations"
  ON organization_integrations
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Backend service access on integrations"
  ON organization_integrations
  FOR ALL
  TO anon
  USING (true)
  WITH CHECK (true);

-- Token Refresh Logs: Same as parent integration
CREATE POLICY "View refresh logs via integration"
  ON integration_token_refreshes
  FOR SELECT
  TO authenticated
  USING (
    integration_id IN (
      SELECT id FROM organization_integrations
      WHERE organization_id IN (
        SELECT organization_id FROM organization_members
        WHERE user_id = auth.uid() AND role IN ('admin', 'owner')
      )
    )
  );

CREATE POLICY "Service role full access on refresh logs"
  ON integration_token_refreshes
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Backend service access on refresh logs"
  ON integration_token_refreshes
  FOR ALL
  TO anon
  USING (true)
  WITH CHECK (true);

-- Document Generation Jobs: Org members can view, admins can manage
CREATE POLICY "Org members can view generation jobs"
  ON document_generation_jobs
  FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Org members can create generation jobs"
  ON document_generation_jobs
  FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid()
    )
    AND created_by = auth.uid()
  );

CREATE POLICY "Job creator or admin can update"
  ON document_generation_jobs
  FOR UPDATE
  TO authenticated
  USING (
    created_by = auth.uid()
    OR organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid() AND role IN ('admin', 'owner')
    )
  );

CREATE POLICY "Service role full access on generation jobs"
  ON document_generation_jobs
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Backend service access on generation jobs"
  ON document_generation_jobs
  FOR ALL
  TO anon
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- Updated At Trigger
-- ============================================================================

CREATE OR REPLACE FUNCTION update_org_integrations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_org_integrations_updated_at ON organization_integrations;
CREATE TRIGGER trigger_update_org_integrations_updated_at
  BEFORE UPDATE ON organization_integrations
  FOR EACH ROW
  EXECUTE FUNCTION update_org_integrations_updated_at();

-- ============================================================================
-- Helper Functions
-- ============================================================================

-- Get expiring tokens (for N8N refresh workflow)
CREATE OR REPLACE FUNCTION get_expiring_integration_tokens(
  minutes_until_expiry INT DEFAULT 30
)
RETURNS TABLE (
  integration_id UUID,
  organization_id UUID,
  integration_type TEXT,
  token_expires_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    oi.id,
    oi.organization_id,
    oi.integration_type,
    oi.token_expires_at
  FROM organization_integrations oi
  WHERE oi.status = 'connected'
    AND oi.refresh_token_vault_id IS NOT NULL
    AND oi.token_expires_at IS NOT NULL
    AND oi.token_expires_at < (NOW() + (minutes_until_expiry || ' minutes')::INTERVAL);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Check if an organization has a connected integration
CREATE OR REPLACE FUNCTION org_has_integration(
  p_organization_id UUID,
  p_integration_type TEXT
)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM organization_integrations
    WHERE organization_id = p_organization_id
      AND integration_type = p_integration_type
      AND status = 'connected'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- ============================================================================
-- Grants
-- ============================================================================

GRANT ALL ON organization_integrations TO authenticated;
GRANT ALL ON organization_integrations TO service_role;
GRANT ALL ON organization_integrations TO anon;

GRANT ALL ON integration_token_refreshes TO authenticated;
GRANT ALL ON integration_token_refreshes TO service_role;
GRANT ALL ON integration_token_refreshes TO anon;

GRANT ALL ON document_generation_jobs TO authenticated;
GRANT ALL ON document_generation_jobs TO service_role;
GRANT ALL ON document_generation_jobs TO anon;

-- ============================================================================
-- Comments
-- ============================================================================

COMMENT ON TABLE organization_integrations IS 'OAuth tokens and status for third-party integrations (Google, QuickBooks, Microsoft, etc.)';
COMMENT ON COLUMN organization_integrations.integration_type IS 'Type of integration: google, quickbooks, microsoft, dropbox, slack, etc.';
COMMENT ON COLUMN organization_integrations.access_token_vault_id IS 'Reference to Supabase Vault secret containing access token (never stored directly)';
COMMENT ON COLUMN organization_integrations.refresh_token_vault_id IS 'Reference to Supabase Vault secret containing refresh token';
COMMENT ON COLUMN organization_integrations.metadata IS 'Integration-specific data: QB company_id, MS tenant_id, etc.';

COMMENT ON TABLE integration_token_refreshes IS 'Audit log of token refresh operations for debugging';

COMMENT ON TABLE document_generation_jobs IS 'Async document generation jobs (create docs in Google, Word, etc.)';
COMMENT ON COLUMN document_generation_jobs.extracted_fields IS 'Variable values to substitute in the generated document';

-- ============================================================================
-- Migration Complete
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Migration 023 Complete!';
  RAISE NOTICE 'Created tables:';
  RAISE NOTICE '  - organization_integrations';
  RAISE NOTICE '  - integration_token_refreshes';
  RAISE NOTICE '  - document_generation_jobs';
  RAISE NOTICE 'Created functions:';
  RAISE NOTICE '  - get_expiring_integration_tokens()';
  RAISE NOTICE '  - org_has_integration()';
  RAISE NOTICE '========================================';
END $$;
