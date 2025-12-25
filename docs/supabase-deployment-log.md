# Supabase Deployment Log

This document tracks all changes made to the managed Supabase instance for production.

**Managed Instance:** https://rawhmcrtzfdhryyfovee.supabase.co
**Environment:** Production
**Tracking Started:** 2025-12-14

---

## Deployment Entry Template

```
### YYYY-MM-DD HH:MM UTC - [Deployment Description]

**Deployed By:** [Your Name/GitHub Username]
**Migration Files Applied:**
- `supabase/migrations/XXX_description.sql`

**Changes:**
- [List of schema changes]
- [New tables, columns, indexes, policies]

**Verification:**
- [ ] Schema changes verified in Supabase Studio
- [ ] RLS policies tested with authenticated user
- [ ] Frontend integration tested
- [ ] Backend integration tested

**Rollback Plan:**
- [How to rollback if needed]

**Notes:**
- [Any additional context or issues encountered]
```

---

## Deployment History

### 2025-12-14 Initial Schema Deployment

**Deployed By:** Nick Yeager
**Migration Files Applied:**
- `SUPABASE_MIGRATION.sql` (combined migrations 001-012)

**Changes:**
- Created initial schema: smart_templates, documents, template_categories
- Created workflow tables: workflow_instances, workflow_executions
- Created template_embeddings for vector search
- Seeded 8 default smart templates (Business Card, Invoice, Resume, etc.)
- Enabled RLS on all user data tables
- Created storage bucket: `documents`

**Verification:**
- [x] Schema verified in SQL Editor
- [ ] RLS policies tested
- [ ] Frontend tested with document upload
- [ ] Backend tested with document processing

**Rollback Plan:**
- Drop all tables: `DROP TABLE IF EXISTS documents, smart_templates, templates, workflow_templates, workflow_instances, workflow_executions, template_embeddings, template_categories CASCADE;`
- Requires backup before next deployment

**Notes:**
- Storage bucket created manually (not via SQL)
- Extensions (uuid-ossp, pgcrypto, vector) pre-installed by Supabase
- Schema validation script created: `validate-supabase-schema.sql`

---

### 2025-12-14 [PENDING] - Storage RLS Policies Fix

**Deployed By:** Nick Yeager (via Claude Code)
**Migration Files Applied:**
- `apply-storage-fix-to-production.sql` (migration 013 adapted for managed Supabase)

**Changes:**
- Fixed storage bucket RLS policies to resolve "new row violates row-level security policy" error
- Created/updated 5 RLS policies on `storage.objects` table:
  - `objects_authenticated_insert` - Allow users to upload files to their folder
  - `objects_authenticated_select` - Allow users to read their own files
  - `objects_authenticated_update` - Allow users to modify their own files
  - `objects_authenticated_delete` - Allow users to delete their own files
  - `objects_service_role_policy` - Service role full access
- Enabled RLS on `storage.buckets` and `storage.objects`
- Implemented user-based folder access control (`documents/{user_id}/filename`)

**Verification:**
- [ ] SQL script applied successfully in Supabase SQL Editor
- [ ] RLS policies verified (5 policies on storage.objects)
- [ ] Frontend tested with document upload
- [ ] No RLS errors in browser console

**Rollback Plan:**
```sql
-- Drop all storage object policies
DROP POLICY IF EXISTS objects_authenticated_insert ON storage.objects;
DROP POLICY IF EXISTS objects_authenticated_select ON storage.objects;
DROP POLICY IF EXISTS objects_authenticated_update ON storage.objects;
DROP POLICY IF EXISTS objects_authenticated_delete ON storage.objects;
DROP POLICY IF EXISTS objects_service_role_policy ON storage.objects;

-- Revert to permissive policy (NOT RECOMMENDED for production)
CREATE POLICY objects_all_authenticated ON storage.objects
  FOR ALL TO authenticated USING (bucket_id = 'documents');
```

**Notes:**
- This fixes a critical bug preventing document uploads in production
- Original migrations 008 and 012 had ordering issues (policies before bucket)
- User-based folder structure ensures data isolation by user ID
- Service role maintains admin access for backend operations
- **ACTION REQUIRED**: Apply fix via Supabase Dashboard UI (SQL method fails due to permissions)
- **UI Method**: See `APPLY_STORAGE_FIX_VIA_UI.md` for step-by-step instructions
- **Why SQL fails**: Managed Supabase restricts ALTER TABLE on storage system tables

---

### [PENDING] - Multi-Organization Support (Migration 014)

**Deployed By:** [Your Name]
**Migration Files Applied:**
- `supabase/migrations/014_add_organizations.sql`

**Changes:**
- Created `organizations` table for teams/workspaces
- Created `organization_members` table with three-tier roles (owner, admin, member)
- Created `organization_invitations` table for pending invites
- Added `organization_id` column to: smart_templates, templates, workflow_templates, documents, workflow_instances
- Created helper functions: `user_is_org_member()`, `user_has_org_role()`, `get_user_organizations()`
- Auto-created personal organization for each existing user
- Migrated all existing user data to their personal organizations
- Updated RLS policies to use organization-based access control
- Added trigger to auto-create personal org for new user signups

**Pre-Deployment Checklist:**
- [ ] Tested migration on local Docker Supabase
- [ ] Verified all existing data migrated correctly
- [ ] Tested RLS policies with multiple users
- [ ] Created production backup

**Verification (Post-Deployment):**
- [ ] Organizations table created with personal orgs for all users
- [ ] organization_members table has owner entries for each user
- [ ] All smart_templates have organization_id (none NULL)
- [ ] All documents have organization_id (none NULL)
- [ ] RLS policies allow org members to see org data
- [ ] RLS policies prevent cross-org data access
- [ ] New user signup creates personal organization automatically
- [ ] Frontend tested with organization switching

**Verification Queries:**
```sql
-- Check org counts
SELECT organization_type, COUNT(*) FROM organizations GROUP BY 1;

-- Check membership counts
SELECT role, COUNT(*) FROM organization_members GROUP BY 1;

-- Verify no NULL organization_ids
SELECT 'smart_templates' as tbl, COUNT(*) FILTER (WHERE organization_id IS NULL) as nulls FROM smart_templates
UNION ALL SELECT 'documents', COUNT(*) FILTER (WHERE organization_id IS NULL) FROM documents;

-- Test RLS (as authenticated user)
SELECT COUNT(*) FROM organizations; -- Should return user's orgs only
```

**Rollback Plan:**
- Run `supabase/migrations/014_rollback_organizations.sql`
- This will:
  - Drop organization tables
  - Remove organization_id columns
  - Restore original RLS policies
  - **WARNING**: All organization data will be lost

**Notes:**
- This is a major schema change - test thoroughly before production
- Frontend must be updated to use organization context after this migration
- Storage bucket paths may need updating to `{org_id}/{user_id}/filename` pattern
