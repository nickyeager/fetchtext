-- Migration 017: Fix invitation signup flow
-- ============================================================================
--
-- Issue 1: organization-service.ts:getInvitationByToken queries:
--   inviter:auth_user_view(id, email)
-- This fails with PGRST200 because auth_user_view doesn't exist
-- Solution: Create a public view that exposes limited auth.users data
--
-- Issue 2: Frontend uses logo_url but database has avatar_url
-- Solution: Rename column to logo_url for consistency
--
-- Issue 3: User signup fails with 500 error:
--   function create_personal_organization(uuid, character varying) does not exist
-- Root cause: The supabase_auth_admin role has search_path=auth, so:
--   a) Function signature mismatch (text vs varchar)
--   b) Unqualified table/function references fail with auth search path
-- Solution: Create varchar overload and fully qualify all references
--
-- ============================================================================

-- ============================================================================
-- PART 1: Create auth_user_view for PostgREST joins
-- ============================================================================

CREATE OR REPLACE VIEW public.auth_user_view AS
SELECT
    id,
    email,
    created_at,
    updated_at
FROM auth.users;

GRANT SELECT ON public.auth_user_view TO authenticated;
GRANT SELECT ON public.auth_user_view TO anon;

COMMENT ON VIEW public.auth_user_view IS 'Public view of auth.users exposing only safe fields (id, email, timestamps). Used for PostgREST joins.';

-- ============================================================================
-- PART 2: Rename avatar_url to logo_url in organizations table
-- ============================================================================

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'organizations' AND column_name = 'avatar_url'
    ) THEN
        ALTER TABLE organizations RENAME COLUMN avatar_url TO logo_url;
    END IF;
END $$;

-- ============================================================================
-- PART 3: Fix create_personal_organization to work with auth search_path
-- ============================================================================

-- Recreate the text version with fully qualified table references
-- This fixes: search_path=auth cannot find public.organizations
CREATE OR REPLACE FUNCTION public.create_personal_organization(p_user_id UUID, p_user_email TEXT)
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

  -- Ensure unique slug (FULLY QUALIFIED table reference)
  final_slug := slug_base;
  WHILE EXISTS (SELECT 1 FROM public.organizations WHERE slug = final_slug) LOOP
    slug_suffix := slug_suffix + 1;
    final_slug := slug_base || '-' || slug_suffix;
  END LOOP;

  -- Generate display name
  display_name := INITCAP(REPLACE(SPLIT_PART(p_user_email, '@', 1), '.', ' ')) || '''s Workspace';

  -- Create personal organization (FULLY QUALIFIED table reference)
  INSERT INTO public.organizations (name, slug, organization_type, owner_id, description)
  VALUES (display_name, final_slug, 'personal', p_user_id, 'Personal workspace')
  RETURNING id INTO org_id;

  -- Add user as owner (FULLY QUALIFIED table reference)
  INSERT INTO public.organization_members (organization_id, user_id, role, joined_at, invited_by)
  VALUES (org_id, p_user_id, 'owner', NOW(), p_user_id);

  RETURN org_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create varchar overload for auth.users.email (which is character varying)
-- This fixes: function create_personal_organization(uuid, character varying) does not exist
CREATE OR REPLACE FUNCTION public.create_personal_organization(p_user_id UUID, p_user_email character varying)
RETURNS UUID AS $$
BEGIN
  -- Call the text version with FULLY QUALIFIED reference
  RETURN public.create_personal_organization(p_user_id, p_user_email::text);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- PART 4: Fix the trigger function to use fully qualified references
-- ============================================================================

-- Drop old trigger first
DROP TRIGGER IF EXISTS on_auth_user_created_create_org ON auth.users;

-- Create fixed trigger function with fully qualified function call
CREATE OR REPLACE FUNCTION public.handle_new_user_organization_fixed()
RETURNS TRIGGER AS $$
DECLARE
  org_id UUID;
BEGIN
  -- FULLY QUALIFY the function call to work with auth search_path
  org_id := public.create_personal_organization(NEW.id, NEW.email);
  RAISE NOTICE 'Auto-created personal organization % for new user %', org_id, NEW.email;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger with fixed function
CREATE TRIGGER on_auth_user_created_create_org
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user_organization_fixed();

-- ============================================================================
-- Migration complete
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Migration 017 Complete!';
  RAISE NOTICE '- Created auth_user_view for PostgREST joins';
  RAISE NOTICE '- Renamed avatar_url to logo_url';
  RAISE NOTICE '- Fixed create_personal_organization for auth search_path';
  RAISE NOTICE '- Fixed user signup trigger';
  RAISE NOTICE '========================================';
END $$;
