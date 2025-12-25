-- ============================================================================
-- Rollback Migration 014: Remove Multi-Organization Support
-- ============================================================================
--
-- IMPORTANT: This will DELETE all organization data and remove the feature.
-- Only run this if you need to completely undo the organizations migration.
--
-- ============================================================================

-- ============================================================================
-- STEP 1: DROP TRIGGERS
-- ============================================================================

DROP TRIGGER IF EXISTS on_auth_user_created_create_org ON auth.users;
DROP TRIGGER IF EXISTS update_organizations_updated_at ON organizations;
DROP TRIGGER IF EXISTS update_org_members_updated_at ON organization_members;

-- ============================================================================
-- STEP 2: DROP FUNCTIONS
-- ============================================================================

DROP FUNCTION IF EXISTS handle_new_user_organization();
DROP FUNCTION IF EXISTS get_user_organizations(UUID);
DROP FUNCTION IF EXISTS user_has_org_role(UUID, TEXT);
DROP FUNCTION IF EXISTS user_is_org_member(UUID);
DROP FUNCTION IF EXISTS create_personal_organization(UUID, TEXT);

-- ============================================================================
-- STEP 3: RESTORE OLD RLS POLICIES FOR SMART_TEMPLATES
-- ============================================================================

DROP POLICY IF EXISTS "smart_templates_service_policy" ON smart_templates;
DROP POLICY IF EXISTS "smart_templates_delete_policy" ON smart_templates;
DROP POLICY IF EXISTS "smart_templates_update_policy" ON smart_templates;
DROP POLICY IF EXISTS "smart_templates_insert_policy" ON smart_templates;
DROP POLICY IF EXISTS "smart_templates_public_select_policy" ON smart_templates;
DROP POLICY IF EXISTS "smart_templates_select_policy" ON smart_templates;

CREATE POLICY "smart_templates_select_policy" ON smart_templates
  FOR SELECT TO anon, authenticated USING (
    is_public = true OR created_by = auth.uid()
  );

CREATE POLICY "smart_templates_insert_policy" ON smart_templates
  FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid());

CREATE POLICY "smart_templates_update_policy" ON smart_templates
  FOR UPDATE TO authenticated
  USING (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "smart_templates_delete_policy" ON smart_templates
  FOR DELETE TO authenticated USING (created_by = auth.uid());

CREATE POLICY "smart_templates_service_policy" ON smart_templates
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ============================================================================
-- STEP 4: RESTORE OLD RLS POLICIES FOR TEMPLATES
-- ============================================================================

DROP POLICY IF EXISTS "templates_service_policy" ON templates;
DROP POLICY IF EXISTS "templates_delete_policy" ON templates;
DROP POLICY IF EXISTS "templates_update_policy" ON templates;
DROP POLICY IF EXISTS "templates_insert_policy" ON templates;
DROP POLICY IF EXISTS "templates_public_select_policy" ON templates;
DROP POLICY IF EXISTS "templates_select_policy" ON templates;

CREATE POLICY "templates_select_policy" ON templates
  FOR SELECT TO anon, authenticated USING (
    is_public = true OR created_by = auth.uid()
  );

CREATE POLICY "templates_insert_policy" ON templates
  FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid());

CREATE POLICY "templates_update_policy" ON templates
  FOR UPDATE TO authenticated
  USING (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "templates_delete_policy" ON templates
  FOR DELETE TO authenticated USING (created_by = auth.uid());

CREATE POLICY "templates_service_policy" ON templates
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ============================================================================
-- STEP 5: RESTORE OLD RLS POLICIES FOR WORKFLOW_TEMPLATES
-- ============================================================================

DROP POLICY IF EXISTS "workflow_templates_service_policy" ON workflow_templates;
DROP POLICY IF EXISTS "workflow_templates_delete_policy" ON workflow_templates;
DROP POLICY IF EXISTS "workflow_templates_update_policy" ON workflow_templates;
DROP POLICY IF EXISTS "workflow_templates_insert_policy" ON workflow_templates;
DROP POLICY IF EXISTS "workflow_templates_public_select_policy" ON workflow_templates;
DROP POLICY IF EXISTS "workflow_templates_select_policy" ON workflow_templates;

CREATE POLICY "workflow_templates_select_policy" ON workflow_templates
  FOR SELECT TO anon, authenticated USING (
    is_public = true OR created_by = auth.uid()
  );

CREATE POLICY "workflow_templates_insert_policy" ON workflow_templates
  FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid());

CREATE POLICY "workflow_templates_update_policy" ON workflow_templates
  FOR UPDATE TO authenticated
  USING (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "workflow_templates_delete_policy" ON workflow_templates
  FOR DELETE TO authenticated USING (created_by = auth.uid());

CREATE POLICY "workflow_templates_service_policy" ON workflow_templates
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ============================================================================
-- STEP 6: RESTORE OLD RLS POLICIES FOR DOCUMENTS
-- ============================================================================

DROP POLICY IF EXISTS "documents_service_role_policy" ON documents;
DROP POLICY IF EXISTS "documents_delete_policy" ON documents;
DROP POLICY IF EXISTS "documents_update_policy" ON documents;
DROP POLICY IF EXISTS "documents_insert_policy" ON documents;
DROP POLICY IF EXISTS "documents_select_policy" ON documents;

CREATE POLICY "documents_select_policy" ON documents
  FOR SELECT TO authenticated USING (uploaded_by = auth.uid());

CREATE POLICY "documents_insert_policy" ON documents
  FOR INSERT TO authenticated WITH CHECK (uploaded_by = auth.uid());

CREATE POLICY "documents_update_policy" ON documents
  FOR UPDATE TO authenticated
  USING (uploaded_by = auth.uid())
  WITH CHECK (uploaded_by = auth.uid());

CREATE POLICY "documents_delete_policy" ON documents
  FOR DELETE TO authenticated USING (uploaded_by = auth.uid());

CREATE POLICY "documents_service_role_policy" ON documents
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ============================================================================
-- STEP 7: RESTORE OLD RLS POLICIES FOR WORKFLOW_INSTANCES
-- ============================================================================

DROP POLICY IF EXISTS "workflow_instances_service_policy" ON workflow_instances;
DROP POLICY IF EXISTS "workflow_instances_delete_policy" ON workflow_instances;
DROP POLICY IF EXISTS "workflow_instances_update_policy" ON workflow_instances;
DROP POLICY IF EXISTS "workflow_instances_insert_policy" ON workflow_instances;
DROP POLICY IF EXISTS "workflow_instances_select_policy" ON workflow_instances;

CREATE POLICY "workflow_instances_select_policy" ON workflow_instances
  FOR SELECT TO authenticated USING (created_by = auth.uid());

CREATE POLICY "workflow_instances_insert_policy" ON workflow_instances
  FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid());

CREATE POLICY "workflow_instances_update_policy" ON workflow_instances
  FOR UPDATE TO authenticated
  USING (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "workflow_instances_delete_policy" ON workflow_instances
  FOR DELETE TO authenticated USING (created_by = auth.uid());

CREATE POLICY "workflow_instances_service_policy" ON workflow_instances
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ============================================================================
-- STEP 8: RESTORE OLD RLS POLICIES FOR WORKFLOW_EXECUTIONS
-- ============================================================================

DROP POLICY IF EXISTS "workflow_executions_service_policy" ON workflow_executions;
DROP POLICY IF EXISTS "workflow_executions_delete_policy" ON workflow_executions;
DROP POLICY IF EXISTS "workflow_executions_update_policy" ON workflow_executions;
DROP POLICY IF EXISTS "workflow_executions_insert_policy" ON workflow_executions;
DROP POLICY IF EXISTS "workflow_executions_select_policy" ON workflow_executions;

CREATE POLICY "workflow_executions_select_policy" ON workflow_executions
  FOR SELECT TO public USING (
    EXISTS (
      SELECT 1 FROM workflow_instances wi
      WHERE wi.id = workflow_executions.workflow_instance_id
      AND wi.created_by = auth.uid()
    )
  );

CREATE POLICY "workflow_executions_insert_policy" ON workflow_executions
  FOR INSERT TO public;

CREATE POLICY "workflow_executions_update_policy" ON workflow_executions
  FOR UPDATE TO public USING (
    EXISTS (
      SELECT 1 FROM workflow_instances wi
      WHERE wi.id = workflow_executions.workflow_instance_id
      AND wi.created_by = auth.uid()
    )
  );

CREATE POLICY "workflow_executions_delete_policy" ON workflow_executions
  FOR DELETE TO public USING (
    EXISTS (
      SELECT 1 FROM workflow_instances wi
      WHERE wi.id = workflow_executions.workflow_instance_id
      AND wi.created_by = auth.uid()
    )
  );

CREATE POLICY "workflow_executions_service_policy" ON workflow_executions
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ============================================================================
-- STEP 9: REMOVE ORGANIZATION_ID COLUMNS
-- ============================================================================

-- Make columns nullable first (if they were NOT NULL)
ALTER TABLE smart_templates ALTER COLUMN organization_id DROP NOT NULL;
ALTER TABLE templates ALTER COLUMN organization_id DROP NOT NULL;
ALTER TABLE workflow_templates ALTER COLUMN organization_id DROP NOT NULL;
ALTER TABLE documents ALTER COLUMN organization_id DROP NOT NULL;
ALTER TABLE workflow_instances ALTER COLUMN organization_id DROP NOT NULL;

-- Drop indexes
DROP INDEX IF EXISTS idx_smart_templates_org_id;
DROP INDEX IF EXISTS idx_smart_templates_org_created;
DROP INDEX IF EXISTS idx_templates_org_id;
DROP INDEX IF EXISTS idx_workflow_templates_org_id;
DROP INDEX IF EXISTS idx_documents_org_id;
DROP INDEX IF EXISTS idx_documents_org_status;
DROP INDEX IF EXISTS idx_workflow_instances_org_id;

-- Drop columns
ALTER TABLE smart_templates DROP COLUMN IF EXISTS organization_id;
ALTER TABLE templates DROP COLUMN IF EXISTS organization_id;
ALTER TABLE workflow_templates DROP COLUMN IF EXISTS organization_id;
ALTER TABLE documents DROP COLUMN IF EXISTS organization_id;
ALTER TABLE workflow_instances DROP COLUMN IF EXISTS organization_id;

-- ============================================================================
-- STEP 10: DROP ORGANIZATION TABLES
-- ============================================================================

-- Drop in order due to foreign key constraints
DROP TABLE IF EXISTS organization_invitations CASCADE;
DROP TABLE IF EXISTS organization_members CASCADE;
DROP TABLE IF EXISTS organizations CASCADE;

-- ============================================================================
-- ROLLBACK COMPLETE
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Rollback Complete!';
  RAISE NOTICE '';
  RAISE NOTICE 'Organization support has been removed.';
  RAISE NOTICE 'All organization data has been deleted.';
  RAISE NOTICE 'RLS policies restored to user-based model.';
  RAISE NOTICE '========================================';
END $$;
