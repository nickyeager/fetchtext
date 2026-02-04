-- Migration: 020_add_azure_provisioning_logs
-- Description: Add provisioning audit log table for Azure OpenAI instances
-- Date: 2025-01-19

-- ============================================================================
-- Azure Provisioning Logs Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS azure_provisioning_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  action TEXT NOT NULL CHECK (action IN ('create_resource', 'deploy_model', 'get_keys', 'store_credentials', 'delete_resource', 'retry')),
  status TEXT NOT NULL CHECK (status IN ('started', 'completed', 'failed')),
  details JSONB DEFAULT '{}',
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for querying logs by organization
CREATE INDEX IF NOT EXISTS idx_provisioning_logs_org_id ON azure_provisioning_logs(organization_id);
CREATE INDEX IF NOT EXISTS idx_provisioning_logs_created ON azure_provisioning_logs(created_at DESC);

-- RLS
ALTER TABLE azure_provisioning_logs ENABLE ROW LEVEL SECURITY;

-- Service role and backend have full access
CREATE POLICY "Service role full access on provisioning logs"
  ON azure_provisioning_logs
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Backend can INSERT logs only (append-only audit trail)
CREATE POLICY "Backend service can create logs"
  ON azure_provisioning_logs
  FOR INSERT
  TO anon
  WITH CHECK (true);

-- Backend can READ logs (for status checks)
CREATE POLICY "Backend service can read logs"
  ON azure_provisioning_logs
  FOR SELECT
  TO anon
  USING (true);

-- Org admins can view their logs
CREATE POLICY "Org admins can view provisioning logs"
  ON azure_provisioning_logs
  FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid() AND role IN ('admin', 'owner')
    )
  );

COMMENT ON TABLE azure_provisioning_logs IS 'Audit log for Azure OpenAI provisioning actions';
COMMENT ON COLUMN azure_provisioning_logs.action IS 'Provisioning action type: create_resource, deploy_model, get_keys, store_credentials, delete_resource, retry';
COMMENT ON COLUMN azure_provisioning_logs.status IS 'Action status: started, completed, failed';
COMMENT ON COLUMN azure_provisioning_logs.details IS 'JSONB payload with action-specific metadata (resource IDs, deployment names, etc.)';
COMMENT ON COLUMN azure_provisioning_logs.error_message IS 'Human-readable error description when status=failed';
