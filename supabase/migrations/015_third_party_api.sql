-- ============================================================================
-- Migration 015: Third-Party API Infrastructure for FetchText
-- ============================================================================
--
-- This migration creates tables for:
-- - API Keys (third-party application credentials)
-- - Rate Limiting (per-minute request tracking)
-- - Webhooks (callback URL configurations)
-- - API Jobs (async processing job tracking)
--
-- ============================================================================

-- ============================================================================
-- PART 1: API KEYS TABLE
-- Stores third-party application credentials with organization scoping
-- ============================================================================

CREATE TABLE IF NOT EXISTS api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- Credentials (key is hashed, only prefix shown for identification)
  key_hash TEXT NOT NULL UNIQUE,
  key_prefix TEXT NOT NULL,

  -- Metadata
  name TEXT NOT NULL,
  description TEXT,

  -- Permissions (JSON for flexibility)
  permissions JSONB DEFAULT '{"upload": true, "process": true, "templates_read": true}'::jsonb,

  -- Rate limits (per minute)
  rate_limit_per_minute INTEGER DEFAULT 60 NOT NULL CHECK (rate_limit_per_minute > 0 AND rate_limit_per_minute <= 1000),
  upload_limit_per_minute INTEGER DEFAULT 10 NOT NULL CHECK (upload_limit_per_minute > 0 AND upload_limit_per_minute <= 100),

  -- Status
  is_active BOOLEAN DEFAULT true NOT NULL,

  -- Audit
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  last_used_at TIMESTAMP WITH TIME ZONE,
  expires_at TIMESTAMP WITH TIME ZONE,

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Indexes for api_keys
CREATE INDEX IF NOT EXISTS idx_api_keys_org_id ON api_keys(organization_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_key_hash ON api_keys(key_hash);
CREATE INDEX IF NOT EXISTS idx_api_keys_active ON api_keys(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_api_keys_expires ON api_keys(expires_at) WHERE expires_at IS NOT NULL;

-- ============================================================================
-- PART 2: API RATE LIMITS TABLE
-- Tracks request counts per minute window for rate limiting
-- ============================================================================

CREATE TABLE IF NOT EXISTS api_rate_limits (
  id BIGSERIAL PRIMARY KEY,
  api_key_id UUID NOT NULL REFERENCES api_keys(id) ON DELETE CASCADE,

  -- Rate limit tracking
  endpoint TEXT NOT NULL,
  request_count INTEGER DEFAULT 1 NOT NULL CHECK (request_count > 0),

  -- Time window (minute-based)
  window_start TIMESTAMP WITH TIME ZONE NOT NULL,
  window_end TIMESTAMP WITH TIME ZONE NOT NULL,

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Unique constraint to prevent race condition (upsert pattern)
ALTER TABLE api_rate_limits ADD CONSTRAINT unique_rate_limit_window
  UNIQUE (api_key_id, endpoint, window_start);

-- Indexes for rate limiting queries
CREATE INDEX IF NOT EXISTS idx_rate_limits_key_window ON api_rate_limits(api_key_id, window_start, window_end);
CREATE INDEX IF NOT EXISTS idx_rate_limits_cleanup ON api_rate_limits(window_end);

-- ============================================================================
-- PART 3: API WEBHOOKS TABLE
-- Stores webhook configurations for async job notifications
-- ============================================================================

CREATE TABLE IF NOT EXISTS api_webhooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  api_key_id UUID NOT NULL REFERENCES api_keys(id) ON DELETE CASCADE,

  -- Webhook configuration
  callback_url TEXT NOT NULL,
  secret TEXT NOT NULL,

  -- Delivery settings
  max_retries INTEGER DEFAULT 3 NOT NULL CHECK (max_retries >= 0 AND max_retries <= 10),
  retry_delay_seconds INTEGER DEFAULT 60 NOT NULL CHECK (retry_delay_seconds >= 1 AND retry_delay_seconds <= 3600),
  timeout_seconds INTEGER DEFAULT 30 NOT NULL CHECK (timeout_seconds >= 5 AND timeout_seconds <= 120),

  -- Status
  is_active BOOLEAN DEFAULT true NOT NULL,

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Indexes for webhooks
CREATE INDEX IF NOT EXISTS idx_webhooks_api_key ON api_webhooks(api_key_id);
CREATE INDEX IF NOT EXISTS idx_webhooks_active ON api_webhooks(is_active) WHERE is_active = true;

-- ============================================================================
-- PART 4: API JOBS TABLE
-- Tracks async processing jobs submitted via the API
-- ============================================================================

CREATE TABLE IF NOT EXISTS api_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  api_key_id UUID NOT NULL REFERENCES api_keys(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- Job type and status
  job_type TEXT NOT NULL CHECK (job_type IN ('document_process', 'template_generation', 'extraction')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled')),

  -- Input/Output data
  input_data JSONB NOT NULL,
  result_data JSONB,
  error_message TEXT,
  error_details JSONB,

  -- Webhook delivery
  webhook_url TEXT,
  webhook_secret TEXT,
  webhook_attempts INTEGER DEFAULT 0 NOT NULL CHECK (webhook_attempts >= 0 AND webhook_attempts <= 10),
  webhook_last_attempt_at TIMESTAMP WITH TIME ZONE,
  webhook_delivered_at TIMESTAMP WITH TIME ZONE,

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,

  -- Processing metrics
  processing_time_ms INTEGER CHECK (processing_time_ms >= 0)
);

-- Indexes for jobs
CREATE INDEX IF NOT EXISTS idx_api_jobs_status ON api_jobs(status) WHERE status IN ('pending', 'processing');
CREATE INDEX IF NOT EXISTS idx_api_jobs_org ON api_jobs(organization_id);
CREATE INDEX IF NOT EXISTS idx_api_jobs_api_key ON api_jobs(api_key_id);
CREATE INDEX IF NOT EXISTS idx_api_jobs_created ON api_jobs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_api_jobs_webhook_pending ON api_jobs(status, webhook_attempts)
  WHERE status = 'completed' AND webhook_delivered_at IS NULL AND webhook_url IS NOT NULL;

-- ============================================================================
-- PART 5: WEBHOOK DELIVERY LOGS TABLE
-- Tracks webhook delivery attempts for debugging and monitoring
-- ============================================================================

CREATE TABLE IF NOT EXISTS api_webhook_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES api_jobs(id) ON DELETE CASCADE,

  -- Delivery details
  attempt_number INTEGER NOT NULL CHECK (attempt_number > 0),
  callback_url TEXT NOT NULL,

  -- Request/Response
  request_headers JSONB,
  request_payload JSONB NOT NULL,
  response_status_code INTEGER,
  response_body TEXT,

  -- Result
  success BOOLEAN NOT NULL,
  error_message TEXT,

  -- Timing
  attempted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  response_time_ms INTEGER CHECK (response_time_ms >= 0)
);

-- Indexes for webhook logs
CREATE INDEX IF NOT EXISTS idx_webhook_logs_job ON api_webhook_logs(job_id);
CREATE INDEX IF NOT EXISTS idx_webhook_logs_attempted ON api_webhook_logs(attempted_at DESC);

-- ============================================================================
-- PART 6: ENABLE RLS AND CREATE POLICIES
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_rate_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_webhooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_webhook_logs ENABLE ROW LEVEL SECURITY;

-- API Keys: Organization members can view/manage their org's keys
CREATE POLICY api_keys_select_policy ON api_keys
  FOR SELECT TO authenticated
  USING (user_is_org_member(organization_id));

CREATE POLICY api_keys_insert_policy ON api_keys
  FOR INSERT TO authenticated
  WITH CHECK (user_is_org_member(organization_id));

CREATE POLICY api_keys_update_policy ON api_keys
  FOR UPDATE TO authenticated
  USING (user_is_org_member(organization_id));

CREATE POLICY api_keys_delete_policy ON api_keys
  FOR DELETE TO authenticated
  USING (user_is_org_member(organization_id));

-- API Jobs: Organization members can view their org's jobs
CREATE POLICY api_jobs_select_policy ON api_jobs
  FOR SELECT TO authenticated
  USING (user_is_org_member(organization_id));

-- API Webhooks: Access via api_key relationship
CREATE POLICY api_webhooks_select_policy ON api_webhooks
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM api_keys ak
      WHERE ak.id = api_webhooks.api_key_id
      AND user_is_org_member(ak.organization_id)
    )
  );

CREATE POLICY api_webhooks_insert_policy ON api_webhooks
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM api_keys ak
      WHERE ak.id = api_webhooks.api_key_id
      AND user_is_org_member(ak.organization_id)
    )
  );

CREATE POLICY api_webhooks_update_policy ON api_webhooks
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM api_keys ak
      WHERE ak.id = api_webhooks.api_key_id
      AND user_is_org_member(ak.organization_id)
    )
  );

CREATE POLICY api_webhooks_delete_policy ON api_webhooks
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM api_keys ak
      WHERE ak.id = api_webhooks.api_key_id
      AND user_is_org_member(ak.organization_id)
    )
  );

-- Webhook Logs: View via job relationship
CREATE POLICY api_webhook_logs_select_policy ON api_webhook_logs
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM api_jobs j
      WHERE j.id = api_webhook_logs.job_id
      AND user_is_org_member(j.organization_id)
    )
  );

-- Service role policies (for backend operations)
CREATE POLICY api_keys_service_policy ON api_keys
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY api_rate_limits_service_policy ON api_rate_limits
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY api_webhooks_service_policy ON api_webhooks
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY api_jobs_service_policy ON api_jobs
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY api_webhook_logs_service_policy ON api_webhook_logs
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ============================================================================
-- PART 7: TRIGGERS FOR UPDATED_AT
-- ============================================================================

-- Trigger function (reuse if exists)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply triggers
DROP TRIGGER IF EXISTS update_api_keys_updated_at ON api_keys;
CREATE TRIGGER update_api_keys_updated_at
  BEFORE UPDATE ON api_keys
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_api_webhooks_updated_at ON api_webhooks;
CREATE TRIGGER update_api_webhooks_updated_at
  BEFORE UPDATE ON api_webhooks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_api_jobs_updated_at ON api_jobs;
CREATE TRIGGER update_api_jobs_updated_at
  BEFORE UPDATE ON api_jobs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- PART 8: HELPER FUNCTIONS
-- ============================================================================

-- Function to clean up old rate limit records (call periodically)
CREATE OR REPLACE FUNCTION cleanup_old_rate_limits(older_than_minutes INTEGER DEFAULT 5)
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM api_rate_limits
  WHERE window_end < NOW() - (older_than_minutes || ' minutes')::INTERVAL;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if an API key is valid and active
CREATE OR REPLACE FUNCTION is_api_key_valid(p_key_hash TEXT)
RETURNS TABLE (
  api_key_id UUID,
  organization_id UUID,
  permissions JSONB,
  rate_limit_per_minute INTEGER,
  upload_limit_per_minute INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    ak.id,
    ak.organization_id,
    ak.permissions,
    ak.rate_limit_per_minute,
    ak.upload_limit_per_minute
  FROM api_keys ak
  WHERE ak.key_hash = p_key_hash
    AND ak.is_active = true
    AND (ak.expires_at IS NULL OR ak.expires_at > NOW());
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- PART 9: COMMENTS
-- ============================================================================

COMMENT ON TABLE api_keys IS 'Third-party API credentials with organization scoping';
COMMENT ON TABLE api_rate_limits IS 'Per-minute request tracking for rate limiting';
COMMENT ON TABLE api_webhooks IS 'Webhook configurations for async job notifications';
COMMENT ON TABLE api_jobs IS 'Async processing jobs submitted via third-party API';
COMMENT ON TABLE api_webhook_logs IS 'Webhook delivery attempt logs for debugging';

COMMENT ON COLUMN api_keys.key_hash IS 'SHA-256 hash of the actual API key';
COMMENT ON COLUMN api_keys.key_prefix IS 'First 12 characters of key for identification (e.g., ftxt_api_abc)';
COMMENT ON COLUMN api_keys.permissions IS 'JSON object defining allowed operations';
COMMENT ON COLUMN api_jobs.job_type IS 'Type of processing: document_process, template_generation, extraction';
COMMENT ON COLUMN api_jobs.webhook_attempts IS 'Number of webhook delivery attempts (max 10)';

-- ============================================================================
-- Migration complete
-- ============================================================================
