-- ============================================================================
-- Migration 027: Synchronize RLS Policies Between Local and Production
-- ============================================================================
--
-- Fixes 4 issues found during RLS audit:
--
-- 1. Duplicate organization_invitations policies (org_invites_* from 014
--    duplicated by organization_invitations_* from 016)
-- 2. template_embeddings has RLS ON but 0 working policies (old policies
--    referenced dropped tables: templates, workflow_templates)
-- 3. organization_llm_configs overpermissive anon SELECT via
--    "Anyone can view effective config" policy
-- 4. Missing service_role policy on organization_invitations after cleanup
--
-- Safe to run on both local Docker and managed production Supabase.
-- All operations use IF EXISTS guards for idempotency.
-- ============================================================================


-- ============================================================================
-- PART 1: Clean up duplicate organization_invitations policies
-- ============================================================================
-- Migration 014 created org_invites_* policies.
-- Migration 016 created organization_invitations_* SELECT/UPDATE replacements
-- but left the old INSERT, DELETE, and SERVICE policies.
-- Drop ALL old org_invites_* policies, keep organization_invitations_* only.

DROP POLICY IF EXISTS "org_invites_select_policy" ON organization_invitations;
DROP POLICY IF EXISTS "org_invites_insert_policy" ON organization_invitations;
DROP POLICY IF EXISTS "org_invites_update_policy" ON organization_invitations;
DROP POLICY IF EXISTS "org_invites_delete_policy" ON organization_invitations;
DROP POLICY IF EXISTS "org_invites_service_policy" ON organization_invitations;

-- Ensure service_role has a policy (the old org_invites_service_policy was
-- the only service_role policy and we just dropped it)
DROP POLICY IF EXISTS "organization_invitations_service_policy" ON organization_invitations;
CREATE POLICY "organization_invitations_service_policy" ON organization_invitations
  FOR ALL TO service_role USING (true) WITH CHECK (true);


-- ============================================================================
-- PART 2: Fix template_embeddings policies
-- ============================================================================
-- RLS is ON but all 4 old policies from migration 004 referenced dropped
-- tables (templates, workflow_templates), making them invalid.
-- The table is effectively locked out for non-superusers.
-- Drop the old policies and create new ones referencing smart_templates.

DROP POLICY IF EXISTS "template_embeddings_select_policy" ON template_embeddings;
DROP POLICY IF EXISTS "template_embeddings_insert_policy" ON template_embeddings;
DROP POLICY IF EXISTS "template_embeddings_update_policy" ON template_embeddings;
DROP POLICY IF EXISTS "template_embeddings_delete_policy" ON template_embeddings;
DROP POLICY IF EXISTS "template_embeddings_service_policy" ON template_embeddings;
DROP POLICY IF EXISTS "template_embeddings_anon_select_policy" ON template_embeddings;

-- Service role: backend uses this for all vector embedding operations
CREATE POLICY "template_embeddings_service_policy" ON template_embeddings
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Anon read access: document processor backend uses anon key for template matching
CREATE POLICY "template_embeddings_anon_select_policy" ON template_embeddings
  FOR SELECT TO anon USING (true);

-- Authenticated users can read embeddings for their org's templates
CREATE POLICY "template_embeddings_select_policy" ON template_embeddings
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM smart_templates st
      WHERE st.id = template_embeddings.template_id
      AND (st.is_public = true OR user_is_org_member(st.organization_id))
    )
  );

-- INSERT/UPDATE/DELETE not needed for authenticated users — only backend
-- (service_role or anon) writes embeddings during template processing.


-- ============================================================================
-- PART 3: Fix organization_llm_configs overpermissive anon access
-- ============================================================================
-- Two problematic policies:
-- 1. "Anyone can view effective config" grants anon+authenticated SELECT with
--    USING(true), making ALL configs visible to unauthenticated users.
-- 2. "Backend service full access" grants anon ALL with USING(true). This was
--    added as a fallback but the backend uses service_role key (confirmed in
--    database.py), so anon ALL is unnecessary and overpermissive.
--
-- After dropping both, access is:
--   - service_role: full access (bypasses RLS)
--   - authenticated org admins/owners: SELECT/INSERT/UPDATE/DELETE via org policies
--   - anon: no access (correct — backend uses service_role)

DROP POLICY IF EXISTS "Anyone can view effective config" ON organization_llm_configs;
DROP POLICY IF EXISTS "Backend service full access" ON organization_llm_configs;


-- ============================================================================
-- PART 4: Grant permissions for new tables (if not already granted)
-- ============================================================================

-- Ensure template_embeddings is accessible to the roles used in policies
GRANT SELECT ON template_embeddings TO anon;
GRANT SELECT ON template_embeddings TO authenticated;
GRANT ALL ON template_embeddings TO service_role;

-- Ensure API tables have proper grants (from migration 015)
DO $$
BEGIN
  -- Only grant if tables exist (they should after 015)
  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'api_keys' AND schemaname = 'public') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON api_keys TO authenticated;
    GRANT ALL ON api_keys TO service_role;
    GRANT SELECT, INSERT, UPDATE, DELETE ON api_jobs TO authenticated;
    GRANT ALL ON api_jobs TO service_role;
    GRANT ALL ON api_rate_limits TO service_role;
    GRANT SELECT, INSERT, UPDATE, DELETE ON api_webhooks TO authenticated;
    GRANT ALL ON api_webhooks TO service_role;
    GRANT SELECT ON api_webhook_logs TO authenticated;
    GRANT ALL ON api_webhook_logs TO service_role;
  END IF;
END $$;


-- ============================================================================
-- Migration complete
-- ============================================================================
