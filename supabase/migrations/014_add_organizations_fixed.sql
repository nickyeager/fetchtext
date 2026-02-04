-- ============================================================================
-- Migration 014: Multi-Organization Support for FetchText (FIXED VERSION)
-- ============================================================================
--
-- IMPORTANT: Run this migration as supabase_admin user in local Docker
-- or via the SQL Editor in managed Supabase (which uses service role)
--
-- Fixes from original:
-- - Removed references to non-existent tables (templates, workflow_templates)
-- - Added IF NOT EXISTS / IF EXISTS guards
-- - Handles ownership issues
-- ============================================================================

-- ============================================================================
-- PART 1: CREATE ORGANIZATION TABLES
-- ============================================================================

-- Organizations table
CREATE TABLE IF NOT EXISTS organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  avatar_url TEXT,
  organization_type TEXT NOT NULL DEFAULT 'team'
    CHECK (organization_type IN ('personal', 'team', 'enterprise')),
  settings JSONB DEFAULT '{}',
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT valid_slug CHECK (slug ~ '^[a-z0-9-]+$'),
  CONSTRAINT min_name_length CHECK (char_length(name) >= 1)
);

CREATE INDEX IF NOT EXISTS idx_organizations_owner_id ON organizations(owner_id);
CREATE INDEX IF NOT EXISTS idx_organizations_slug ON organizations(slug);
CREATE INDEX IF NOT EXISTS idx_organizations_type ON organizations(organization_type);

-- Organization Members table
CREATE TABLE IF NOT EXISTS organization_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member'
    CHECK (role IN ('owner', 'admin', 'member')),
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  invited_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(organization_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_org_members_org_id ON organization_members(organization_id);
CREATE INDEX IF NOT EXISTS idx_org_members_user_id ON organization_members(user_id);
CREATE INDEX IF NOT EXISTS idx_org_members_role ON organization_members(role);
CREATE INDEX IF NOT EXISTS idx_org_members_user_org ON organization_members(user_id, organization_id);

-- Organization Invitations table
CREATE TABLE IF NOT EXISTS organization_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'member'
    CHECK (role IN ('admin', 'member')),
  token TEXT UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  invited_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
  accepted_at TIMESTAMP WITH TIME ZONE,
  UNIQUE(organization_id, email)
);

CREATE INDEX IF NOT EXISTS idx_org_invites_org_id ON organization_invitations(organization_id);
CREATE INDEX IF NOT EXISTS idx_org_invites_email ON organization_invitations(email);
CREATE INDEX IF NOT EXISTS idx_org_invites_token ON organization_invitations(token);

-- ============================================================================
-- PART 2: ADD ORGANIZATION_ID TO EXISTING TABLES
-- ============================================================================

-- Add to smart_templates (only if column doesn't exist)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'smart_templates' AND column_name = 'organization_id') THEN
    ALTER TABLE smart_templates ADD COLUMN organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
    CREATE INDEX idx_smart_templates_org_id ON smart_templates(organization_id);
    CREATE INDEX idx_smart_templates_org_created ON smart_templates(organization_id, created_at);
    RAISE NOTICE 'Added organization_id to smart_templates';
  ELSE
    RAISE NOTICE 'organization_id already exists in smart_templates';
  END IF;
END $$;

-- Add to documents (only if column doesn't exist)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'documents' AND column_name = 'organization_id') THEN
    ALTER TABLE documents ADD COLUMN organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
    CREATE INDEX idx_documents_org_id ON documents(organization_id);
    CREATE INDEX idx_documents_org_status ON documents(organization_id, processing_status);
    RAISE NOTICE 'Added organization_id to documents';
  ELSE
    RAISE NOTICE 'organization_id already exists in documents';
  END IF;
END $$;

-- Add to workflow_instances (only if column doesn't exist)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'workflow_instances' AND column_name = 'organization_id') THEN
    ALTER TABLE workflow_instances ADD COLUMN organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
    CREATE INDEX idx_workflow_instances_org_id ON workflow_instances(organization_id);
    RAISE NOTICE 'Added organization_id to workflow_instances';
  ELSE
    RAISE NOTICE 'organization_id already exists in workflow_instances';
  END IF;
END $$;

-- ============================================================================
-- PART 3: HELPER FUNCTIONS
-- ============================================================================

-- Check if user is a member of an organization
CREATE OR REPLACE FUNCTION user_is_org_member(org_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM organization_members
    WHERE organization_id = org_id
    AND user_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Check if user has a specific role (or higher) in an organization
CREATE OR REPLACE FUNCTION user_has_org_role(org_id UUID, required_role TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM organization_members
    WHERE organization_id = org_id
    AND user_id = auth.uid()
    AND CASE required_role
      WHEN 'member' THEN role IN ('member', 'admin', 'owner')
      WHEN 'admin' THEN role IN ('admin', 'owner')
      WHEN 'owner' THEN role = 'owner'
      ELSE false
    END
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Get all organizations for a user
CREATE OR REPLACE FUNCTION get_user_organizations(p_user_id UUID)
RETURNS TABLE (
  id UUID,
  name TEXT,
  slug TEXT,
  organization_type TEXT,
  role TEXT,
  member_count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    o.id,
    o.name,
    o.slug,
    o.organization_type,
    om.role,
    (SELECT COUNT(*) FROM organization_members WHERE organization_id = o.id) as member_count
  FROM organizations o
  JOIN organization_members om ON om.organization_id = o.id
  WHERE om.user_id = p_user_id
  ORDER BY
    o.organization_type = 'personal' DESC,
    o.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- ============================================================================
-- PART 4: CREATE PERSONAL ORGANIZATION FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION create_personal_organization(p_user_id UUID, p_user_email TEXT)
RETURNS UUID AS $$
DECLARE
  org_id UUID;
  slug_base TEXT;
  slug_suffix INTEGER := 0;
  final_slug TEXT;
  display_name TEXT;
BEGIN
  -- Generate base slug from email
  slug_base := LOWER(REGEXP_REPLACE(SPLIT_PART(p_user_email, '@', 1), '[^a-z0-9]', '-', 'g'));
  slug_base := REGEXP_REPLACE(slug_base, '-+', '-', 'g');
  slug_base := TRIM(BOTH '-' FROM slug_base);

  IF LENGTH(slug_base) < 2 THEN
    slug_base := 'user-' || slug_base;
  END IF;

  -- Ensure unique slug
  final_slug := slug_base;
  WHILE EXISTS (SELECT 1 FROM organizations WHERE slug = final_slug) LOOP
    slug_suffix := slug_suffix + 1;
    final_slug := slug_base || '-' || slug_suffix;
  END LOOP;

  -- Generate display name
  display_name := INITCAP(REPLACE(SPLIT_PART(p_user_email, '@', 1), '.', ' ')) || '''s Workspace';

  -- Create personal organization
  INSERT INTO organizations (name, slug, organization_type, owner_id, description)
  VALUES (display_name, final_slug, 'personal', p_user_id, 'Personal workspace')
  RETURNING id INTO org_id;

  -- Add user as owner
  INSERT INTO organization_members (organization_id, user_id, role, joined_at, invited_by)
  VALUES (org_id, p_user_id, 'owner', NOW(), p_user_id);

  RETURN org_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- PART 5: MIGRATE EXISTING USERS TO PERSONAL ORGANIZATIONS
-- ============================================================================

DO $$
DECLARE
  user_record RECORD;
  personal_org_id UUID;
  migrated_users INTEGER := 0;
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Starting user data migration...';
  RAISE NOTICE '========================================';

  FOR user_record IN
    SELECT id, email FROM auth.users WHERE email IS NOT NULL
  LOOP
    -- Check if user already has a personal org
    IF NOT EXISTS (
      SELECT 1 FROM organization_members om
      JOIN organizations o ON o.id = om.organization_id
      WHERE om.user_id = user_record.id AND o.organization_type = 'personal'
    ) THEN
      -- Create personal organization
      personal_org_id := create_personal_organization(user_record.id, user_record.email);

      -- Migrate smart_templates
      UPDATE smart_templates
      SET organization_id = personal_org_id
      WHERE created_by = user_record.id AND organization_id IS NULL;

      -- Migrate documents
      UPDATE documents
      SET organization_id = personal_org_id
      WHERE uploaded_by = user_record.id AND organization_id IS NULL;

      -- Migrate workflow_instances
      UPDATE workflow_instances
      SET organization_id = personal_org_id
      WHERE created_by = user_record.id AND organization_id IS NULL;

      migrated_users := migrated_users + 1;
      RAISE NOTICE 'Migrated user: % -> org: %', user_record.email, personal_org_id;
    ELSE
      RAISE NOTICE 'User % already has personal org, skipping', user_record.email;
    END IF;
  END LOOP;

  RAISE NOTICE '========================================';
  RAISE NOTICE 'Migration Complete: % users migrated', migrated_users;
  RAISE NOTICE '========================================';
END $$;

-- ============================================================================
-- PART 6: MAKE ORGANIZATION_ID REQUIRED (AFTER MIGRATION)
-- ============================================================================

DO $$
DECLARE
  null_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO null_count FROM smart_templates WHERE organization_id IS NULL;
  IF null_count = 0 THEN
    ALTER TABLE smart_templates ALTER COLUMN organization_id SET NOT NULL;
    RAISE NOTICE 'smart_templates.organization_id set to NOT NULL';
  ELSE
    RAISE WARNING 'Cannot set smart_templates.organization_id to NOT NULL: % rows have NULL', null_count;
  END IF;

  SELECT COUNT(*) INTO null_count FROM documents WHERE organization_id IS NULL;
  IF null_count = 0 THEN
    ALTER TABLE documents ALTER COLUMN organization_id SET NOT NULL;
    RAISE NOTICE 'documents.organization_id set to NOT NULL';
  ELSE
    RAISE WARNING 'Cannot set documents.organization_id to NOT NULL: % rows have NULL', null_count;
  END IF;

  SELECT COUNT(*) INTO null_count FROM workflow_instances WHERE organization_id IS NULL;
  IF null_count = 0 THEN
    ALTER TABLE workflow_instances ALTER COLUMN organization_id SET NOT NULL;
    RAISE NOTICE 'workflow_instances.organization_id set to NOT NULL';
  ELSE
    RAISE WARNING 'Cannot set workflow_instances.organization_id to NOT NULL: % rows have NULL', null_count;
  END IF;
END $$;

-- ============================================================================
-- PART 7: AUTO-CREATE PERSONAL ORG FOR NEW USERS (TRIGGER)
-- ============================================================================

CREATE OR REPLACE FUNCTION handle_new_user_organization()
RETURNS TRIGGER AS $$
DECLARE
  org_id UUID;
BEGIN
  org_id := create_personal_organization(NEW.id, NEW.email);
  RAISE NOTICE 'Auto-created personal organization % for new user %', org_id, NEW.email;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created_create_org ON auth.users;
CREATE TRIGGER on_auth_user_created_create_org
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user_organization();

-- ============================================================================
-- PART 8: UPDATE TIMESTAMPS TRIGGERS
-- ============================================================================

DROP TRIGGER IF EXISTS update_organizations_updated_at ON organizations;
CREATE TRIGGER update_organizations_updated_at
  BEFORE UPDATE ON organizations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_org_members_updated_at ON organization_members;
CREATE TRIGGER update_org_members_updated_at
  BEFORE UPDATE ON organization_members
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- PART 9: ENABLE RLS ON NEW TABLES
-- ============================================================================

ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_invitations ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- PART 10: RLS POLICIES FOR ORGANIZATIONS
-- ============================================================================

DROP POLICY IF EXISTS "organizations_select_policy" ON organizations;
CREATE POLICY "organizations_select_policy" ON organizations
  FOR SELECT TO authenticated USING (user_is_org_member(id));

DROP POLICY IF EXISTS "organizations_insert_policy" ON organizations;
CREATE POLICY "organizations_insert_policy" ON organizations
  FOR INSERT TO authenticated WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS "organizations_update_policy" ON organizations;
CREATE POLICY "organizations_update_policy" ON organizations
  FOR UPDATE TO authenticated USING (user_has_org_role(id, 'owner'));

DROP POLICY IF EXISTS "organizations_delete_policy" ON organizations;
CREATE POLICY "organizations_delete_policy" ON organizations
  FOR DELETE TO authenticated USING (user_has_org_role(id, 'owner'));

DROP POLICY IF EXISTS "organizations_service_policy" ON organizations;
CREATE POLICY "organizations_service_policy" ON organizations
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ============================================================================
-- PART 11: RLS POLICIES FOR ORGANIZATION_MEMBERS
-- ============================================================================

DROP POLICY IF EXISTS "org_members_select_policy" ON organization_members;
CREATE POLICY "org_members_select_policy" ON organization_members
  FOR SELECT TO authenticated USING (user_is_org_member(organization_id));

DROP POLICY IF EXISTS "org_members_insert_policy" ON organization_members;
CREATE POLICY "org_members_insert_policy" ON organization_members
  FOR INSERT TO authenticated WITH CHECK (user_has_org_role(organization_id, 'admin'));

DROP POLICY IF EXISTS "org_members_update_policy" ON organization_members;
CREATE POLICY "org_members_update_policy" ON organization_members
  FOR UPDATE TO authenticated USING (
    user_has_org_role(organization_id, 'admin') AND user_id != auth.uid()
  );

DROP POLICY IF EXISTS "org_members_delete_policy" ON organization_members;
CREATE POLICY "org_members_delete_policy" ON organization_members
  FOR DELETE TO authenticated USING (
    user_has_org_role(organization_id, 'admin') OR user_id = auth.uid()
  );

DROP POLICY IF EXISTS "org_members_service_policy" ON organization_members;
CREATE POLICY "org_members_service_policy" ON organization_members
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ============================================================================
-- PART 12: RLS POLICIES FOR ORGANIZATION_INVITATIONS
-- ============================================================================

DROP POLICY IF EXISTS "org_invites_select_policy" ON organization_invitations;
CREATE POLICY "org_invites_select_policy" ON organization_invitations
  FOR SELECT TO authenticated USING (
    user_is_org_member(organization_id)
    OR email = (SELECT email FROM auth.users WHERE id = auth.uid())
  );

DROP POLICY IF EXISTS "org_invites_insert_policy" ON organization_invitations;
CREATE POLICY "org_invites_insert_policy" ON organization_invitations
  FOR INSERT TO authenticated WITH CHECK (
    user_has_org_role(organization_id, 'admin') AND invited_by = auth.uid()
  );

DROP POLICY IF EXISTS "org_invites_update_policy" ON organization_invitations;
CREATE POLICY "org_invites_update_policy" ON organization_invitations
  FOR UPDATE TO authenticated USING (
    email = (SELECT email FROM auth.users WHERE id = auth.uid()) AND accepted_at IS NULL
  );

DROP POLICY IF EXISTS "org_invites_delete_policy" ON organization_invitations;
CREATE POLICY "org_invites_delete_policy" ON organization_invitations
  FOR DELETE TO authenticated USING (user_has_org_role(organization_id, 'admin'));

DROP POLICY IF EXISTS "org_invites_service_policy" ON organization_invitations;
CREATE POLICY "org_invites_service_policy" ON organization_invitations
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ============================================================================
-- PART 13: UPDATE RLS POLICIES FOR SMART_TEMPLATES
-- ============================================================================

DROP POLICY IF EXISTS "smart_templates_select_policy" ON smart_templates;
DROP POLICY IF EXISTS "smart_templates_public_select_policy" ON smart_templates;
DROP POLICY IF EXISTS "smart_templates_insert_policy" ON smart_templates;
DROP POLICY IF EXISTS "smart_templates_update_policy" ON smart_templates;
DROP POLICY IF EXISTS "smart_templates_delete_policy" ON smart_templates;
DROP POLICY IF EXISTS "smart_templates_service_policy" ON smart_templates;

CREATE POLICY "smart_templates_select_policy" ON smart_templates
  FOR SELECT TO authenticated USING (user_is_org_member(organization_id));

CREATE POLICY "smart_templates_public_select_policy" ON smart_templates
  FOR SELECT TO anon USING (is_public = true);

CREATE POLICY "smart_templates_insert_policy" ON smart_templates
  FOR INSERT TO authenticated WITH CHECK (
    user_is_org_member(organization_id) AND created_by = auth.uid()
  );

CREATE POLICY "smart_templates_update_policy" ON smart_templates
  FOR UPDATE TO authenticated USING (
    user_is_org_member(organization_id)
    AND (created_by = auth.uid() OR user_has_org_role(organization_id, 'admin'))
  );

CREATE POLICY "smart_templates_delete_policy" ON smart_templates
  FOR DELETE TO authenticated USING (
    user_is_org_member(organization_id)
    AND (created_by = auth.uid() OR user_has_org_role(organization_id, 'admin'))
  );

CREATE POLICY "smart_templates_service_policy" ON smart_templates
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ============================================================================
-- PART 14: UPDATE RLS POLICIES FOR DOCUMENTS
-- ============================================================================

DROP POLICY IF EXISTS "documents_select_policy" ON documents;
DROP POLICY IF EXISTS "documents_insert_policy" ON documents;
DROP POLICY IF EXISTS "documents_insert_policy_permissive" ON documents;
DROP POLICY IF EXISTS "documents_update_policy" ON documents;
DROP POLICY IF EXISTS "documents_delete_policy" ON documents;
DROP POLICY IF EXISTS "documents_service_role_policy" ON documents;

CREATE POLICY "documents_select_policy" ON documents
  FOR SELECT TO authenticated USING (user_is_org_member(organization_id));

CREATE POLICY "documents_insert_policy" ON documents
  FOR INSERT TO authenticated WITH CHECK (
    user_is_org_member(organization_id) AND uploaded_by = auth.uid()
  );

CREATE POLICY "documents_update_policy" ON documents
  FOR UPDATE TO authenticated USING (
    user_is_org_member(organization_id)
    AND (uploaded_by = auth.uid() OR user_has_org_role(organization_id, 'admin'))
  );

CREATE POLICY "documents_delete_policy" ON documents
  FOR DELETE TO authenticated USING (
    user_is_org_member(organization_id)
    AND (uploaded_by = auth.uid() OR user_has_org_role(organization_id, 'admin'))
  );

CREATE POLICY "documents_service_role_policy" ON documents
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ============================================================================
-- PART 15: UPDATE RLS POLICIES FOR WORKFLOW_INSTANCES
-- ============================================================================

DROP POLICY IF EXISTS "workflow_instances_select_policy" ON workflow_instances;
DROP POLICY IF EXISTS "workflow_instances_insert_policy" ON workflow_instances;
DROP POLICY IF EXISTS "workflow_instances_update_policy" ON workflow_instances;
DROP POLICY IF EXISTS "workflow_instances_delete_policy" ON workflow_instances;
DROP POLICY IF EXISTS "workflow_instances_service_policy" ON workflow_instances;

CREATE POLICY "workflow_instances_select_policy" ON workflow_instances
  FOR SELECT TO authenticated USING (user_is_org_member(organization_id));

CREATE POLICY "workflow_instances_insert_policy" ON workflow_instances
  FOR INSERT TO authenticated WITH CHECK (
    user_is_org_member(organization_id) AND created_by = auth.uid()
  );

CREATE POLICY "workflow_instances_update_policy" ON workflow_instances
  FOR UPDATE TO authenticated USING (
    user_is_org_member(organization_id)
    AND (created_by = auth.uid() OR user_has_org_role(organization_id, 'admin'))
  );

CREATE POLICY "workflow_instances_delete_policy" ON workflow_instances
  FOR DELETE TO authenticated USING (
    user_is_org_member(organization_id)
    AND (created_by = auth.uid() OR user_has_org_role(organization_id, 'admin'))
  );

CREATE POLICY "workflow_instances_service_policy" ON workflow_instances
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ============================================================================
-- PART 16: UPDATE RLS POLICIES FOR WORKFLOW_EXECUTIONS
-- ============================================================================

DROP POLICY IF EXISTS "workflow_executions_select_policy" ON workflow_executions;
DROP POLICY IF EXISTS "workflow_executions_insert_policy" ON workflow_executions;
DROP POLICY IF EXISTS "workflow_executions_update_policy" ON workflow_executions;
DROP POLICY IF EXISTS "workflow_executions_delete_policy" ON workflow_executions;
DROP POLICY IF EXISTS "workflow_executions_service_policy" ON workflow_executions;

CREATE POLICY "workflow_executions_select_policy" ON workflow_executions
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM workflow_instances wi
      WHERE wi.id = workflow_executions.workflow_instance_id
      AND user_is_org_member(wi.organization_id)
    )
  );

CREATE POLICY "workflow_executions_insert_policy" ON workflow_executions
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (
      SELECT 1 FROM workflow_instances wi
      WHERE wi.id = workflow_instance_id
      AND user_is_org_member(wi.organization_id)
    )
  );

CREATE POLICY "workflow_executions_update_policy" ON workflow_executions
  FOR UPDATE TO authenticated USING (
    EXISTS (
      SELECT 1 FROM workflow_instances wi
      WHERE wi.id = workflow_executions.workflow_instance_id
      AND user_is_org_member(wi.organization_id)
    )
  );

CREATE POLICY "workflow_executions_delete_policy" ON workflow_executions
  FOR DELETE TO authenticated USING (
    EXISTS (
      SELECT 1 FROM workflow_instances wi
      WHERE wi.id = workflow_executions.workflow_instance_id
      AND user_has_org_role(wi.organization_id, 'admin')
    )
  );

CREATE POLICY "workflow_executions_service_policy" ON workflow_executions
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ============================================================================
-- PART 17: GRANT PERMISSIONS
-- ============================================================================

GRANT ALL ON organizations TO authenticated;
GRANT ALL ON organizations TO service_role;
GRANT ALL ON organization_members TO authenticated;
GRANT ALL ON organization_members TO service_role;
GRANT ALL ON organization_invitations TO authenticated;
GRANT ALL ON organization_invitations TO service_role;

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================

DO $$
DECLARE
  org_count INTEGER;
  member_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO org_count FROM organizations;
  SELECT COUNT(*) INTO member_count FROM organization_members;

  RAISE NOTICE '========================================';
  RAISE NOTICE 'Migration 014 Complete!';
  RAISE NOTICE 'Organizations created: %', org_count;
  RAISE NOTICE 'Memberships created: %', member_count;
  RAISE NOTICE '========================================';
END $$;
