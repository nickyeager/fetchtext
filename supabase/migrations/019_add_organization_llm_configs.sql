-- Migration: 019_add_organization_llm_configs
-- Description: Add organization-specific LLM provider configuration
-- Date: 2025-01-17

-- ============================================================================
-- Organization LLM Configs Table
-- ============================================================================
-- Allows organizations to have custom LLM provider configurations.
-- Organizations WITHOUT a row in this table use the system default (shared Azure).

CREATE TABLE IF NOT EXISTS organization_llm_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- Tier: determines features and limits
  -- 'free' = template-only, no AI
  -- 'non_managed' = shared Azure with usage limits (default for new orgs)
  -- 'professional' = BYOK (bring your own key)
  -- 'enterprise' = dedicated instance
  tier TEXT NOT NULL DEFAULT 'non_managed' CHECK (tier IN ('free', 'non_managed', 'professional', 'enterprise')),

  -- Provider type: how LLM is accessed
  -- 'none' = no LLM access (free tier)
  -- 'shared' = FetchText's shared Azure OpenAI
  -- 'byok_azure' = Customer's Azure OpenAI key
  -- 'byok_openai' = Customer's OpenAI key
  -- 'self_hosted' = Customer's own endpoint (Ollama, vLLM, etc.)
  provider_type TEXT NOT NULL DEFAULT 'shared' CHECK (provider_type IN ('none', 'shared', 'byok_azure', 'byok_openai', 'self_hosted')),

  -- Enterprise deployment model (only for enterprise tier)
  -- 'managed_ours' = FetchText provisions in our Azure subscription
  -- 'lighthouse' = FetchText provisions in customer's Azure via Lighthouse
  -- 'marketplace' = Customer deploys via Azure Marketplace
  deployment_model TEXT CHECK (deployment_model IN ('managed_ours', 'lighthouse', 'marketplace')),

  -- Credentials stored in Supabase Vault (reference ID only)
  -- Actual secrets stored in vault.secrets table
  credentials_vault_id TEXT,

  -- Self-hosted / custom endpoint URL
  custom_endpoint TEXT,

  -- Azure resource details (for enterprise managed deployments)
  azure_resource_id TEXT,
  azure_subscription_id TEXT,
  azure_resource_group TEXT,
  azure_instance_name TEXT,

  -- Azure Lighthouse delegation ID (for lighthouse deployments)
  lighthouse_delegation_id TEXT,

  -- Azure Marketplace subscription ID (for marketplace deployments)
  marketplace_subscription_id TEXT,

  -- Provisioning status for enterprise deployments
  provisioning_status TEXT DEFAULT 'active' CHECK (provisioning_status IN ('pending', 'provisioning', 'active', 'failed', 'deprovisioning')),
  provisioning_error TEXT,
  provisioned_at TIMESTAMPTZ,

  -- Usage limits for non_managed tier
  daily_document_limit INT DEFAULT 10,
  monthly_document_limit INT DEFAULT 200,
  documents_processed_today INT DEFAULT 0,
  documents_processed_month INT DEFAULT 0,
  usage_reset_daily TIMESTAMPTZ DEFAULT NOW(),
  usage_reset_monthly TIMESTAMPTZ DEFAULT NOW(),

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),

  -- One config per organization
  UNIQUE(organization_id)
);

-- ============================================================================
-- Indexes
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_org_llm_configs_org_id ON organization_llm_configs(organization_id);
CREATE INDEX IF NOT EXISTS idx_org_llm_configs_tier ON organization_llm_configs(tier);
CREATE INDEX IF NOT EXISTS idx_org_llm_configs_provider ON organization_llm_configs(provider_type);

-- ============================================================================
-- Row Level Security
-- ============================================================================

ALTER TABLE organization_llm_configs ENABLE ROW LEVEL SECURITY;

-- Org admins and owners can view their org's LLM config
CREATE POLICY "Org admins can view LLM config"
  ON organization_llm_configs
  FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid() AND role IN ('admin', 'owner')
    )
  );

-- Org admins and owners can insert LLM config for their org
CREATE POLICY "Org admins can insert LLM config"
  ON organization_llm_configs
  FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid() AND role IN ('admin', 'owner')
    )
  );

-- Org admins and owners can update their org's LLM config
CREATE POLICY "Org admins can update LLM config"
  ON organization_llm_configs
  FOR UPDATE
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid() AND role IN ('admin', 'owner')
    )
  );

-- Org owners can delete LLM config (reset to system default)
CREATE POLICY "Org owners can delete LLM config"
  ON organization_llm_configs
  FOR DELETE
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid() AND role = 'owner'
    )
  );

-- Service role has full access (bypasses RLS but explicit for clarity)
CREATE POLICY "Service role full access"
  ON organization_llm_configs
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Backend service access (document processor uses anon key)
-- This allows the backend to manage org configs on behalf of the system
CREATE POLICY "Backend service full access"
  ON organization_llm_configs
  FOR ALL
  TO anon
  USING (true)
  WITH CHECK (true);

-- Anyone can view configs (for effective config lookups)
CREATE POLICY "Anyone can view effective config"
  ON organization_llm_configs
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- ============================================================================
-- Updated At Trigger
-- ============================================================================

CREATE OR REPLACE FUNCTION update_org_llm_configs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_org_llm_configs_updated_at ON organization_llm_configs;
CREATE TRIGGER trigger_update_org_llm_configs_updated_at
  BEFORE UPDATE ON organization_llm_configs
  FOR EACH ROW
  EXECUTE FUNCTION update_org_llm_configs_updated_at();

-- ============================================================================
-- Usage Reset Function (to be called by cron job)
-- ============================================================================

CREATE OR REPLACE FUNCTION reset_daily_document_usage()
RETURNS void AS $$
BEGIN
  UPDATE organization_llm_configs
  SET
    documents_processed_today = 0,
    usage_reset_daily = NOW()
  WHERE usage_reset_daily < CURRENT_DATE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION reset_monthly_document_usage()
RETURNS void AS $$
BEGIN
  UPDATE organization_llm_configs
  SET
    documents_processed_month = 0,
    usage_reset_monthly = NOW()
  WHERE usage_reset_monthly < DATE_TRUNC('month', CURRENT_DATE);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- Comments
-- ============================================================================

COMMENT ON TABLE organization_llm_configs IS 'Organization-specific LLM provider configurations. Orgs without a row use system default (shared Azure).';
COMMENT ON COLUMN organization_llm_configs.tier IS 'Pricing tier: free (no AI), non_managed (shared + limits), professional (BYOK), enterprise (dedicated)';
COMMENT ON COLUMN organization_llm_configs.provider_type IS 'How LLM is accessed: none, shared, byok_azure, byok_openai, self_hosted';
COMMENT ON COLUMN organization_llm_configs.credentials_vault_id IS 'Reference to Supabase Vault secret containing API keys';
COMMENT ON COLUMN organization_llm_configs.deployment_model IS 'Enterprise only: managed_ours, lighthouse, or marketplace';
