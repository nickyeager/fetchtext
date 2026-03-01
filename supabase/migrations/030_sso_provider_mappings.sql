-- SSO provider mappings: maps SAML IdP providers to organizations for JIT provisioning
CREATE TABLE IF NOT EXISTS sso_provider_mappings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

    -- SAML provider info
    sso_provider_id TEXT NOT NULL UNIQUE,    -- Supabase SSO provider ID
    domain TEXT NOT NULL UNIQUE,             -- Email domain (e.g. "acme.com")
    idp_name TEXT NOT NULL DEFAULT '',       -- Display name (e.g. "Acme Corp Okta")
    metadata_url TEXT,                       -- IdP metadata URL (null if XML was uploaded)

    -- JIT provisioning config
    auto_provision BOOLEAN NOT NULL DEFAULT true,
    default_role TEXT NOT NULL DEFAULT 'member',

    -- Audit
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_sso_mappings_org ON sso_provider_mappings(organization_id);
CREATE INDEX idx_sso_mappings_domain ON sso_provider_mappings(domain);

-- Updated-at trigger
CREATE OR REPLACE FUNCTION update_sso_mappings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_sso_mappings_updated_at
    BEFORE UPDATE ON sso_provider_mappings
    FOR EACH ROW
    EXECUTE FUNCTION update_sso_mappings_updated_at();

-- RLS
ALTER TABLE sso_provider_mappings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view SSO mappings"
    ON sso_provider_mappings FOR SELECT TO authenticated
    USING (user_is_org_member(organization_id));

CREATE POLICY "Org members can manage SSO mappings"
    ON sso_provider_mappings FOR ALL TO authenticated
    USING (user_is_org_member(organization_id))
    WITH CHECK (user_is_org_member(organization_id));

CREATE POLICY "Service role full access on SSO mappings"
    ON sso_provider_mappings FOR ALL TO service_role
    USING (true) WITH CHECK (true);
