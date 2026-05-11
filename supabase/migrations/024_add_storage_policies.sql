-- Migration: Update storage RLS policies for documents bucket
-- Applied to production Supabase: 2025-02-10
-- https://app.supabase.com/project/your-project-id

-- The original production policies had overly restrictive conditions:
--   (bucket_id = 'documents') AND (storage.foldername(name))[1] = auth.uid()::text
-- This required files to be uploaded to a user-specific folder.
-- Updated to simpler policies that just check bucket_id.

-- Enable RLS on storage.objects if not already enabled
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Drop existing restrictive policies
DROP POLICY IF EXISTS "objects_authenticated_delete" ON storage.objects;
DROP POLICY IF EXISTS "objects_authenticated_insert" ON storage.objects;
DROP POLICY IF EXISTS "objects_authenticated_select" ON storage.objects;
DROP POLICY IF EXISTS "objects_authenticated_update" ON storage.objects;

-- Policy: Authenticated users can upload files to documents bucket
CREATE POLICY "objects_authenticated_insert"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'documents');

-- Policy: Authenticated users can read files from documents bucket
CREATE POLICY "objects_authenticated_select"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'documents');

-- Policy: Authenticated users can update files in documents bucket
CREATE POLICY "objects_authenticated_update"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'documents')
WITH CHECK (bucket_id = 'documents');

-- Policy: Authenticated users can delete files from documents bucket
CREATE POLICY "objects_authenticated_delete"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'documents');

-- Ensure service role policy exists (for backend operations)
DROP POLICY IF EXISTS "objects_service_role_policy" ON storage.objects;
CREATE POLICY "objects_service_role_policy"
ON storage.objects FOR ALL TO service_role
USING (true)
WITH CHECK (true);

-- Verify policies were created
SELECT policyname, cmd, roles
FROM pg_policies
WHERE schemaname = 'storage' AND tablename = 'objects'
ORDER BY policyname;
