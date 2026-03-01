-- SharePoint folder watches: auto-import new documents from watched folders
CREATE TABLE IF NOT EXISTS sharepoint_watches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

    -- SharePoint location
    site_id TEXT,                           -- SharePoint site ID (null for OneDrive)
    drive_id TEXT NOT NULL,                 -- Document library / OneDrive drive ID
    folder_id TEXT NOT NULL,                -- Folder item ID to watch
    folder_path TEXT NOT NULL,              -- Human-readable path (e.g. "Documents/Invoices")

    -- Polling config
    poll_interval_minutes INTEGER NOT NULL DEFAULT 15,
    last_polled_at TIMESTAMPTZ,
    last_change_token TEXT,                 -- Microsoft Graph delta token for efficient polling

    -- Status
    is_active BOOLEAN NOT NULL DEFAULT true,
    consecutive_failures INTEGER NOT NULL DEFAULT 0,
    last_error TEXT,

    -- Audit
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_sp_watches_org ON sharepoint_watches(organization_id);
CREATE INDEX idx_sp_watches_active ON sharepoint_watches(is_active) WHERE is_active = true;

-- Updated-at trigger
CREATE OR REPLACE FUNCTION update_sharepoint_watches_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_sharepoint_watches_updated_at
    BEFORE UPDATE ON sharepoint_watches
    FOR EACH ROW
    EXECUTE FUNCTION update_sharepoint_watches_updated_at();

-- RLS
ALTER TABLE sharepoint_watches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view watches"
    ON sharepoint_watches FOR SELECT TO authenticated
    USING (user_is_org_member(organization_id));

CREATE POLICY "Org members can create watches"
    ON sharepoint_watches FOR INSERT TO authenticated
    WITH CHECK (user_is_org_member(organization_id));

CREATE POLICY "Org members can update watches"
    ON sharepoint_watches FOR UPDATE TO authenticated
    USING (user_is_org_member(organization_id));

CREATE POLICY "Org members can delete watches"
    ON sharepoint_watches FOR DELETE TO authenticated
    USING (user_is_org_member(organization_id));

CREATE POLICY "Service role full access on watches"
    ON sharepoint_watches FOR ALL TO service_role
    USING (true) WITH CHECK (true);
