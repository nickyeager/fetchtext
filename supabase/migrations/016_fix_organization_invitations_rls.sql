-- Migration: Fix organization_invitations RLS policies
-- Issue: Policies referenced auth.users directly which causes permission denied errors
-- Solution: Use auth.email() function instead of subqueries to auth.users

-- Drop existing policies that reference auth.users
DROP POLICY IF EXISTS org_invites_select_policy ON organization_invitations;
DROP POLICY IF EXISTS org_invites_update_policy ON organization_invitations;
DROP POLICY IF EXISTS organization_invitations_select_policy ON organization_invitations;
DROP POLICY IF EXISTS organization_invitations_update_policy ON organization_invitations;

-- Recreate SELECT policy using auth.email() instead of auth.users subquery
CREATE POLICY organization_invitations_select_policy ON organization_invitations
    FOR SELECT TO authenticated
    USING (
        -- User is a member of the organization
        (organization_id IN (
            SELECT organization_id FROM organization_members
            WHERE user_id = auth.uid()
        ))
        OR
        -- Or the invitation is for the current user's email
        (email = auth.email())
    );

-- Recreate UPDATE policy using auth.email() instead of auth.users subquery
CREATE POLICY organization_invitations_update_policy ON organization_invitations
    FOR UPDATE TO authenticated
    USING (
        -- Org admins/owners can update
        (organization_id IN (
            SELECT organization_id FROM organization_members
            WHERE user_id = auth.uid()
            AND role IN ('owner', 'admin')
        ))
        OR
        -- Or the invitation is for the current user's email (to accept/reject)
        (email = auth.email())
    );

-- Also ensure auth.email() function exists (it should be part of Supabase default)
-- This function reads email from JWT claims without accessing auth.users table
CREATE OR REPLACE FUNCTION auth.email() RETURNS text AS $$
  SELECT
    COALESCE(
      NULLIF(current_setting('request.jwt.claim.email', true), ''),
      (NULLIF(current_setting('request.jwt.claims', true), '')::jsonb ->> 'email')
    )::text;
$$ LANGUAGE sql STABLE;
