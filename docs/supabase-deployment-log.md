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
