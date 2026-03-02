-- Webhook subscriptions: user-configured endpoints that receive document events
CREATE TABLE IF NOT EXISTS webhook_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

    -- Endpoint configuration
    name TEXT NOT NULL,                  -- Human-readable label (e.g. "Zapier Invoice Hook")
    url TEXT NOT NULL,                   -- Destination URL
    secret TEXT,                         -- HMAC signing secret (nullable = unsigned)

    -- Event filtering
    events TEXT[] NOT NULL DEFAULT '{}', -- Which events to deliver: document.processed, document.fields_extracted, etc.
                                         -- Empty array = ALL events

    -- Status
    is_active BOOLEAN NOT NULL DEFAULT true,
    last_triggered_at TIMESTAMPTZ,
    last_status_code INTEGER,
    consecutive_failures INTEGER NOT NULL DEFAULT 0,

    -- Auto-disable after repeated failures
    disabled_at TIMESTAMPTZ,
    disabled_reason TEXT,

    -- Audit
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_webhook_subs_org ON webhook_subscriptions(organization_id);
CREATE INDEX idx_webhook_subs_active ON webhook_subscriptions(organization_id, is_active)
    WHERE is_active = true;

-- Auto-update updated_at
CREATE TRIGGER set_webhook_subscriptions_updated_at
    BEFORE UPDATE ON webhook_subscriptions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RLS
ALTER TABLE webhook_subscriptions ENABLE ROW LEVEL SECURITY;

-- Org members can read their own subscriptions
CREATE POLICY webhook_subs_select ON webhook_subscriptions
    FOR SELECT TO authenticated
    USING (user_is_org_member(organization_id));

-- Org members can create subscriptions
CREATE POLICY webhook_subs_insert ON webhook_subscriptions
    FOR INSERT TO authenticated
    WITH CHECK (user_is_org_member(organization_id));

-- Org members can update their own subscriptions
CREATE POLICY webhook_subs_update ON webhook_subscriptions
    FOR UPDATE TO authenticated
    USING (user_is_org_member(organization_id));

-- Org members can delete their own subscriptions
CREATE POLICY webhook_subs_delete ON webhook_subscriptions
    FOR DELETE TO authenticated
    USING (user_is_org_member(organization_id));

-- Service role full access (backend operations)
CREATE POLICY webhook_subs_service ON webhook_subscriptions
    FOR ALL TO service_role USING (true) WITH CHECK (true);
