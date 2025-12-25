-- ============================================================================
-- Migration 014: Multi-Organization Support for FetchText
-- ============================================================================
--
-- This migration adds teams/organizations capability with:
-- - Three-tier roles: owner, admin, member
-- - Users can belong to multiple organizations
-- - Existing data migrated to auto-created personal organizations
-- - Organization-only sharing model
--
-- DEPLOYMENT:
-- 1. Test locally with Docker Supabase
-- 2. Apply to production via SQL Editor
-- 3. Verify migration with queries at the end
-- ============================================================================

-- ============================================================================
-- PART 1: CREATE ORGANIZATION TABLES
-- ============================================================================

-- Organizations table
CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  avatar_url TEXT,

  -- Organization type (personal workspace vs team)
  organization_type TEXT NOT NULL DEFAULT 'team'
    CHECK (organization_type IN ('personal', 'team', 'enterprise')),

  -- Settings stored as JSON
  settings JSONB DEFAULT '{}',

  -- Audit fields
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Constraints
  CONSTRAINT valid_slug CHECK (slug ~ '^[a-z0-9-]+$'),
  CONSTRAINT min_name_length CHECK (char_length(name) >= 1)
);

-- Indexes for organizations
CREATE INDEX idx_organizations_owner_id ON organizations(owner_id);
CREATE INDEX idx_organizations_slug ON organizations(slug);
CREATE INDEX idx_organizations_type ON organizations(organization_type);

COMMENT ON TABLE organizations IS 'Organizations/teams that own resources';
COMMENT ON COLUMN organizations.organization_type IS 'personal: single-user workspace, team: multi-user team, enterprise: advanced features';
COMMENT ON COLUMN organizations.slug IS 'URL-friendly unique identifier for the organization';

-- ============================================================================
-- Organization Members (Junction Table with Roles)
-- ============================================================================

CREATE TABLE organization_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Three-tier role system
  role TEXT NOT NULL DEFAULT 'member'
    CHECK (role IN ('owner', 'admin', 'member')),

  -- Membership metadata
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  invited_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- One membership per user per organization
  UNIQUE(organization_id, user_id)
);

-- Indexes for organization_members
CREATE INDEX idx_org_members_org_id ON organization_members(organization_id);
CREATE INDEX idx_org_members_user_id ON organization_members(user_id);
CREATE INDEX idx_org_members_role ON organization_members(role);
CREATE INDEX idx_org_members_user_org ON organization_members(user_id, organization_id);

COMMENT ON TABLE organization_members IS 'User membership and roles within organizations';
COMMENT ON COLUMN organization_members.role IS 'owner: full control, admin: manage members/content, member: read/create';

-- ============================================================================
-- Organization Invitations
-- ============================================================================

CREATE TABLE organization_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'member'
    CHECK (role IN ('admin', 'member')),

  -- Invitation token for accepting
  token TEXT UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),

  -- Metadata
  invited_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
  accepted_at TIMESTAMP WITH TIME ZONE,

  -- Prevent duplicate pending invites to same email per org
  UNIQUE(organization_id, email)
);

-- Indexes for organization_invitations
CREATE INDEX idx_org_invites_org_id ON organization_invitations(organization_id);
CREATE INDEX idx_org_invites_email ON organization_invitations(email);
CREATE INDEX idx_org_invites_token ON organization_invitations(token);

COMMENT ON TABLE organization_invitations IS 'Pending invitations to join organizations';

-- ============================================================================
-- PART 2: ADD ORGANIZATION_ID TO EXISTING TABLES
-- ============================================================================

-- Add organization_id to smart_templates
ALTER TABLE smart_templates
  ADD COLUMN organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;

CREATE INDEX idx_smart_templates_org_id ON smart_templates(organization_id);
CREATE INDEX idx_smart_templates_org_created ON smart_templates(organization_id, created_at);

-- Add organization_id to templates
ALTER TABLE templates
  ADD COLUMN organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;

CREATE INDEX idx_templates_org_id ON templates(organization_id);

-- Add organization_id to workflow_templates
ALTER TABLE workflow_templates
  ADD COLUMN organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;

CREATE INDEX idx_workflow_templates_org_id ON workflow_templates(organization_id);

-- Add organization_id to documents
ALTER TABLE documents
  ADD COLUMN organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;

CREATE INDEX idx_documents_org_id ON documents(organization_id);
CREATE INDEX idx_documents_org_status ON documents(organization_id, processing_status);

-- Add organization_id to workflow_instances
ALTER TABLE workflow_instances
  ADD COLUMN organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;

CREATE INDEX idx_workflow_instances_org_id ON workflow_instances(organization_id);

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

COMMENT ON FUNCTION user_is_org_member IS 'Check if current user is a member of the specified organization';

-- Check if user has a specific role (or higher) in an organization
-- Role hierarchy: owner > admin > member
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

COMMENT ON FUNCTION user_has_org_role IS 'Check if current user has at least the specified role in organization';

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
    o.organization_type = 'personal' DESC, -- Personal org first
    o.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

COMMENT ON FUNCTION get_user_organizations IS 'Get all organizations a user belongs to with their roles';

-- ============================================================================
-- PART 4: CREATE PERSONAL ORGANIZATION FUNCTION
-- ============================================================================

-- Function to create a personal organization for a user
CREATE OR REPLACE FUNCTION create_personal_organization(p_user_id UUID, p_user_email TEXT)
RETURNS UUID AS $$
DECLARE
  org_id UUID;
  slug_base TEXT;
  slug_suffix INTEGER := 0;
  final_slug TEXT;
  display_name TEXT;
BEGIN
  -- Generate base slug from email (part before @)
  slug_base := LOWER(REGEXP_REPLACE(SPLIT_PART(p_user_email, '@', 1), '[^a-z0-9]', '-', 'g'));
  slug_base := REGEXP_REPLACE(slug_base, '-+', '-', 'g'); -- Remove duplicate hyphens
  slug_base := TRIM(BOTH '-' FROM slug_base); -- Remove leading/trailing hyphens

  -- Ensure minimum length
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
  VALUES (
    display_name,
    final_slug,
    'personal',
    p_user_id,
    'Personal workspace'
  )
  RETURNING id INTO org_id;

  -- Add user as owner
  INSERT INTO organization_members (organization_id, user_id, role, joined_at, invited_by)
  VALUES (org_id, p_user_id, 'owner', NOW(), p_user_id);

  RETURN org_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION create_personal_organization IS 'Creates a personal organization for a user with unique slug';

-- ============================================================================
-- PART 5: MIGRATE EXISTING USERS TO PERSONAL ORGANIZATIONS
-- ============================================================================

DO $$
DECLARE
  user_record RECORD;
  personal_org_id UUID;
  migrated_users INTEGER := 0;
  migrated_templates INTEGER := 0;
  migrated_documents INTEGER := 0;
  migrated_workflows INTEGER := 0;
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Starting user data migration...';
  RAISE NOTICE '========================================';

  FOR user_record IN
    SELECT id, email
    FROM auth.users
    WHERE email IS NOT NULL
  LOOP
    -- Create personal organization for this user
    personal_org_id := create_personal_organization(user_record.id, user_record.email);

    -- Migrate smart_templates
    UPDATE smart_templates
    SET organization_id = personal_org_id
    WHERE created_by = user_record.id
      AND organization_id IS NULL;
    migrated_templates := migrated_templates + (SELECT COUNT(*) FROM smart_templates WHERE organization_id = personal_org_id);

    -- Migrate templates
    UPDATE templates
    SET organization_id = personal_org_id
    WHERE created_by = user_record.id
      AND organization_id IS NULL;

    -- Migrate workflow_templates
    UPDATE workflow_templates
    SET organization_id = personal_org_id
    WHERE created_by = user_record.id
      AND organization_id IS NULL;

    -- Migrate documents
    UPDATE documents
    SET organization_id = personal_org_id
    WHERE uploaded_by = user_record.id
      AND organization_id IS NULL;
    migrated_documents := migrated_documents + (SELECT COUNT(*) FROM documents WHERE organization_id = personal_org_id);

    -- Migrate workflow_instances
    UPDATE workflow_instances
    SET organization_id = personal_org_id
    WHERE created_by = user_record.id
      AND organization_id IS NULL;
    migrated_workflows := migrated_workflows + (SELECT COUNT(*) FROM workflow_instances WHERE organization_id = personal_org_id);

    migrated_users := migrated_users + 1;
    RAISE NOTICE 'Migrated user: % -> org: %', user_record.email, personal_org_id;
  END LOOP;

  RAISE NOTICE '========================================';
  RAISE NOTICE 'Migration Complete:';
  RAISE NOTICE '  Users migrated: %', migrated_users;
  RAISE NOTICE '  Templates migrated: %', migrated_templates;
  RAISE NOTICE '  Documents migrated: %', migrated_documents;
  RAISE NOTICE '  Workflows migrated: %', migrated_workflows;
  RAISE NOTICE '========================================';
END $$;

-- Handle orphaned data (templates/documents without a user)
-- Assign to first organization if any, or leave NULL
DO $$
DECLARE
  default_org_id UUID;
  orphaned_count INTEGER;
BEGIN
  -- Get first organization (if any)
  SELECT id INTO default_org_id FROM organizations LIMIT 1;

  IF default_org_id IS NOT NULL THEN
    -- Count orphaned records
    SELECT COUNT(*) INTO orphaned_count
    FROM smart_templates
    WHERE organization_id IS NULL AND created_by IS NULL;

    IF orphaned_count > 0 THEN
      RAISE NOTICE 'Found % orphaned templates, assigning to default org', orphaned_count;
      UPDATE smart_templates
      SET organization_id = default_org_id
      WHERE organization_id IS NULL;
    END IF;

    -- Same for documents
    SELECT COUNT(*) INTO orphaned_count
    FROM documents
    WHERE organization_id IS NULL AND uploaded_by IS NULL;

    IF orphaned_count > 0 THEN
      RAISE NOTICE 'Found % orphaned documents, assigning to default org', orphaned_count;
      UPDATE documents
      SET organization_id = default_org_id
      WHERE organization_id IS NULL;
    END IF;
  END IF;
END $$;

-- ============================================================================
-- PART 6: MAKE ORGANIZATION_ID REQUIRED
-- ============================================================================

-- Now that data is migrated, make organization_id NOT NULL
-- Only do this if all data has been migrated

DO $$
DECLARE
  null_count INTEGER;
BEGIN
  -- Check for any remaining NULL organization_ids
  SELECT COUNT(*) INTO null_count FROM smart_templates WHERE organization_id IS NULL;
  IF null_count = 0 THEN
    ALTER TABLE smart_templates ALTER COLUMN organization_id SET NOT NULL;
    RAISE NOTICE 'smart_templates.organization_id set to NOT NULL';
  ELSE
    RAISE WARNING 'Cannot set smart_templates.organization_id to NOT NULL: % rows have NULL', null_count;
  END IF;

  SELECT COUNT(*) INTO null_count FROM templates WHERE organization_id IS NULL;
  IF null_count = 0 THEN
    ALTER TABLE templates ALTER COLUMN organization_id SET NOT NULL;
    RAISE NOTICE 'templates.organization_id set to NOT NULL';
  ELSE
    RAISE WARNING 'Cannot set templates.organization_id to NOT NULL: % rows have NULL', null_count;
  END IF;

  SELECT COUNT(*) INTO null_count FROM workflow_templates WHERE organization_id IS NULL;
  IF null_count = 0 THEN
    ALTER TABLE workflow_templates ALTER COLUMN organization_id SET NOT NULL;
    RAISE NOTICE 'workflow_templates.organization_id set to NOT NULL';
  ELSE
    RAISE WARNING 'Cannot set workflow_templates.organization_id to NOT NULL: % rows have NULL', null_count;
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
  -- Create personal organization for new user
  org_id := create_personal_organization(NEW.id, NEW.email);

  RAISE NOTICE 'Auto-created personal organization % for new user %', org_id, NEW.email;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger on user creation
DROP TRIGGER IF EXISTS on_auth_user_created_create_org ON auth.users;
CREATE TRIGGER on_auth_user_created_create_org
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user_organization();

COMMENT ON FUNCTION handle_new_user_organization IS 'Automatically creates a personal organization when a new user signs up';

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
-- PART 10: RLS POLICIES FOR ORGANIZATIONS TABLE
-- ============================================================================

-- SELECT: Users can see organizations they're members of
CREATE POLICY "organizations_select_policy" ON organizations
  FOR SELECT TO authenticated USING (
    user_is_org_member(id)
  );

-- INSERT: Authenticated users can create organizations
CREATE POLICY "organizations_insert_policy" ON organizations
  FOR INSERT TO authenticated WITH CHECK (
    owner_id = auth.uid()
  );

-- UPDATE: Only owners can update org details
CREATE POLICY "organizations_update_policy" ON organizations
  FOR UPDATE TO authenticated USING (
    user_has_org_role(id, 'owner')
  ) WITH CHECK (
    owner_id = auth.uid()
  );

-- DELETE: Only owners can delete organizations
CREATE POLICY "organizations_delete_policy" ON organizations
  FOR DELETE TO authenticated USING (
    user_has_org_role(id, 'owner')
  );

-- Service role has full access
CREATE POLICY "organizations_service_policy" ON organizations
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ============================================================================
-- PART 11: RLS POLICIES FOR ORGANIZATION_MEMBERS TABLE
-- ============================================================================

-- SELECT: Members can see other members in their orgs
CREATE POLICY "org_members_select_policy" ON organization_members
  FOR SELECT TO authenticated USING (
    user_is_org_member(organization_id)
  );

-- INSERT: Admins/owners can add members
CREATE POLICY "org_members_insert_policy" ON organization_members
  FOR INSERT TO authenticated WITH CHECK (
    user_has_org_role(organization_id, 'admin')
  );

-- UPDATE: Admins/owners can update roles (with restrictions)
CREATE POLICY "org_members_update_policy" ON organization_members
  FOR UPDATE TO authenticated USING (
    user_has_org_role(organization_id, 'admin')
    AND user_id != auth.uid() -- Can't change your own role
  ) WITH CHECK (
    user_has_org_role(organization_id, 'admin')
  );

-- DELETE: Admins/owners can remove members; members can leave
CREATE POLICY "org_members_delete_policy" ON organization_members
  FOR DELETE TO authenticated USING (
    user_has_org_role(organization_id, 'admin')
    OR user_id = auth.uid() -- Can leave organization
  );

-- Service role has full access
CREATE POLICY "org_members_service_policy" ON organization_members
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ============================================================================
-- PART 12: RLS POLICIES FOR ORGANIZATION_INVITATIONS TABLE
-- ============================================================================

-- SELECT: Members can see invites for their orgs, or user can see own invites
CREATE POLICY "org_invites_select_policy" ON organization_invitations
  FOR SELECT TO authenticated USING (
    user_is_org_member(organization_id)
    OR email = (SELECT email FROM auth.users WHERE id = auth.uid())
  );

-- INSERT: Admins/owners can create invites
CREATE POLICY "org_invites_insert_policy" ON organization_invitations
  FOR INSERT TO authenticated WITH CHECK (
    user_has_org_role(organization_id, 'admin')
    AND invited_by = auth.uid()
  );

-- UPDATE: For accepting invitations (mark accepted_at)
CREATE POLICY "org_invites_update_policy" ON organization_invitations
  FOR UPDATE TO authenticated USING (
    email = (SELECT email FROM auth.users WHERE id = auth.uid())
    AND accepted_at IS NULL
  );

-- DELETE: Admins/owners can revoke invitations
CREATE POLICY "org_invites_delete_policy" ON organization_invitations
  FOR DELETE TO authenticated USING (
    user_has_org_role(organization_id, 'admin')
  );

-- Service role has full access
CREATE POLICY "org_invites_service_policy" ON organization_invitations
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ============================================================================
-- PART 13: UPDATE RLS POLICIES FOR SMART_TEMPLATES
-- ============================================================================

-- Drop old policies
DROP POLICY IF EXISTS "smart_templates_select_policy" ON smart_templates;
DROP POLICY IF EXISTS "smart_templates_insert_policy" ON smart_templates;
DROP POLICY IF EXISTS "smart_templates_update_policy" ON smart_templates;
DROP POLICY IF EXISTS "smart_templates_delete_policy" ON smart_templates;

-- SELECT: Members can see templates in their organizations
CREATE POLICY "smart_templates_select_policy" ON smart_templates
  FOR SELECT TO authenticated USING (
    user_is_org_member(organization_id)
  );

-- Allow anon to see public templates (keep backward compatibility)
CREATE POLICY "smart_templates_public_select_policy" ON smart_templates
  FOR SELECT TO anon USING (
    is_public = true
  );

-- INSERT: Members can create templates in their organizations
CREATE POLICY "smart_templates_insert_policy" ON smart_templates
  FOR INSERT TO authenticated WITH CHECK (
    user_is_org_member(organization_id)
    AND created_by = auth.uid()
  );

-- UPDATE: Creator or admins/owners can update
CREATE POLICY "smart_templates_update_policy" ON smart_templates
  FOR UPDATE TO authenticated USING (
    user_is_org_member(organization_id)
    AND (created_by = auth.uid() OR user_has_org_role(organization_id, 'admin'))
  );

-- DELETE: Creator or admins/owners can delete
CREATE POLICY "smart_templates_delete_policy" ON smart_templates
  FOR DELETE TO authenticated USING (
    user_is_org_member(organization_id)
    AND (created_by = auth.uid() OR user_has_org_role(organization_id, 'admin'))
  );

-- Service role has full access
DROP POLICY IF EXISTS "smart_templates_service_policy" ON smart_templates;
CREATE POLICY "smart_templates_service_policy" ON smart_templates
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ============================================================================
-- PART 14: UPDATE RLS POLICIES FOR TEMPLATES
-- ============================================================================

DROP POLICY IF EXISTS "templates_select_policy" ON templates;
DROP POLICY IF EXISTS "templates_insert_policy" ON templates;
DROP POLICY IF EXISTS "templates_update_policy" ON templates;
DROP POLICY IF EXISTS "templates_delete_policy" ON templates;

CREATE POLICY "templates_select_policy" ON templates
  FOR SELECT TO authenticated USING (
    user_is_org_member(organization_id)
  );

CREATE POLICY "templates_public_select_policy" ON templates
  FOR SELECT TO anon USING (
    is_public = true
  );

CREATE POLICY "templates_insert_policy" ON templates
  FOR INSERT TO authenticated WITH CHECK (
    user_is_org_member(organization_id)
    AND created_by = auth.uid()
  );

CREATE POLICY "templates_update_policy" ON templates
  FOR UPDATE TO authenticated USING (
    user_is_org_member(organization_id)
    AND (created_by = auth.uid() OR user_has_org_role(organization_id, 'admin'))
  );

CREATE POLICY "templates_delete_policy" ON templates
  FOR DELETE TO authenticated USING (
    user_is_org_member(organization_id)
    AND (created_by = auth.uid() OR user_has_org_role(organization_id, 'admin'))
  );

CREATE POLICY "templates_service_policy" ON templates
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ============================================================================
-- PART 15: UPDATE RLS POLICIES FOR WORKFLOW_TEMPLATES
-- ============================================================================

DROP POLICY IF EXISTS "workflow_templates_select_policy" ON workflow_templates;
DROP POLICY IF EXISTS "workflow_templates_insert_policy" ON workflow_templates;
DROP POLICY IF EXISTS "workflow_templates_update_policy" ON workflow_templates;
DROP POLICY IF EXISTS "workflow_templates_delete_policy" ON workflow_templates;

CREATE POLICY "workflow_templates_select_policy" ON workflow_templates
  FOR SELECT TO authenticated USING (
    user_is_org_member(organization_id)
  );

CREATE POLICY "workflow_templates_public_select_policy" ON workflow_templates
  FOR SELECT TO anon USING (
    is_public = true
  );

CREATE POLICY "workflow_templates_insert_policy" ON workflow_templates
  FOR INSERT TO authenticated WITH CHECK (
    user_is_org_member(organization_id)
    AND created_by = auth.uid()
  );

CREATE POLICY "workflow_templates_update_policy" ON workflow_templates
  FOR UPDATE TO authenticated USING (
    user_is_org_member(organization_id)
    AND (created_by = auth.uid() OR user_has_org_role(organization_id, 'admin'))
  );

CREATE POLICY "workflow_templates_delete_policy" ON workflow_templates
  FOR DELETE TO authenticated USING (
    user_is_org_member(organization_id)
    AND (created_by = auth.uid() OR user_has_org_role(organization_id, 'admin'))
  );

CREATE POLICY "workflow_templates_service_policy" ON workflow_templates
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ============================================================================
-- PART 16: UPDATE RLS POLICIES FOR DOCUMENTS
-- ============================================================================

DROP POLICY IF EXISTS "documents_select_policy" ON documents;
DROP POLICY IF EXISTS "documents_insert_policy" ON documents;
DROP POLICY IF EXISTS "documents_insert_policy_permissive" ON documents;
DROP POLICY IF EXISTS "documents_update_policy" ON documents;
DROP POLICY IF EXISTS "documents_delete_policy" ON documents;

CREATE POLICY "documents_select_policy" ON documents
  FOR SELECT TO authenticated USING (
    user_is_org_member(organization_id)
  );

CREATE POLICY "documents_insert_policy" ON documents
  FOR INSERT TO authenticated WITH CHECK (
    user_is_org_member(organization_id)
    AND uploaded_by = auth.uid()
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

-- Keep service role policy
DROP POLICY IF EXISTS "documents_service_role_policy" ON documents;
CREATE POLICY "documents_service_role_policy" ON documents
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ============================================================================
-- PART 17: UPDATE RLS POLICIES FOR WORKFLOW_INSTANCES
-- ============================================================================

DROP POLICY IF EXISTS "workflow_instances_select_policy" ON workflow_instances;
DROP POLICY IF EXISTS "workflow_instances_insert_policy" ON workflow_instances;
DROP POLICY IF EXISTS "workflow_instances_update_policy" ON workflow_instances;
DROP POLICY IF EXISTS "workflow_instances_delete_policy" ON workflow_instances;

CREATE POLICY "workflow_instances_select_policy" ON workflow_instances
  FOR SELECT TO authenticated USING (
    user_is_org_member(organization_id)
  );

CREATE POLICY "workflow_instances_insert_policy" ON workflow_instances
  FOR INSERT TO authenticated WITH CHECK (
    user_is_org_member(organization_id)
    AND created_by = auth.uid()
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
-- PART 18: UPDATE RLS POLICIES FOR WORKFLOW_EXECUTIONS
-- ============================================================================

-- workflow_executions inherits access through workflow_instances
DROP POLICY IF EXISTS "workflow_executions_select_policy" ON workflow_executions;
DROP POLICY IF EXISTS "workflow_executions_insert_policy" ON workflow_executions;
DROP POLICY IF EXISTS "workflow_executions_update_policy" ON workflow_executions;
DROP POLICY IF EXISTS "workflow_executions_delete_policy" ON workflow_executions;

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
-- PART 19: GRANT PERMISSIONS
-- ============================================================================

GRANT ALL ON organizations TO authenticated;
GRANT ALL ON organizations TO service_role;

GRANT ALL ON organization_members TO authenticated;
GRANT ALL ON organization_members TO service_role;

GRANT ALL ON organization_invitations TO authenticated;
GRANT ALL ON organization_invitations TO service_role;

-- ============================================================================
-- PART 20: MIGRATION VERIFICATION QUERIES
-- ============================================================================

-- Run these queries after migration to verify success:

-- Check organization counts
-- SELECT
--   'Organizations' as entity,
--   COUNT(*) as total,
--   COUNT(*) FILTER (WHERE organization_type = 'personal') as personal,
--   COUNT(*) FILTER (WHERE organization_type = 'team') as team
-- FROM organizations;

-- Check membership counts
-- SELECT
--   'Memberships' as entity,
--   COUNT(*) as total,
--   COUNT(*) FILTER (WHERE role = 'owner') as owners,
--   COUNT(*) FILTER (WHERE role = 'admin') as admins,
--   COUNT(*) FILTER (WHERE role = 'member') as members
-- FROM organization_members;

-- Verify all data has organization_id
-- SELECT
--   'smart_templates' as table_name,
--   COUNT(*) as total,
--   COUNT(*) FILTER (WHERE organization_id IS NOT NULL) as with_org,
--   COUNT(*) FILTER (WHERE organization_id IS NULL) as without_org
-- FROM smart_templates
-- UNION ALL
-- SELECT 'documents', COUNT(*), COUNT(*) FILTER (WHERE organization_id IS NOT NULL), COUNT(*) FILTER (WHERE organization_id IS NULL) FROM documents
-- UNION ALL
-- SELECT 'workflow_instances', COUNT(*), COUNT(*) FILTER (WHERE organization_id IS NOT NULL), COUNT(*) FILTER (WHERE organization_id IS NULL) FROM workflow_instances;

-- Check RLS policies
-- SELECT tablename, policyname, roles
-- FROM pg_policies
-- WHERE schemaname = 'public'
-- ORDER BY tablename;

RAISE NOTICE '========================================';
RAISE NOTICE 'Migration 014 Complete!';
RAISE NOTICE '';
RAISE NOTICE 'Next Steps:';
RAISE NOTICE '1. Run verification queries above';
RAISE NOTICE '2. Test RLS policies with different users';
RAISE NOTICE '3. Update frontend to use organization context';
RAISE NOTICE '========================================';
