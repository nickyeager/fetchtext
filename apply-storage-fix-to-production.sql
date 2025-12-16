-- =============================================================================
-- APPLY THIS IN MANAGED SUPABASE SQL EDITOR
-- URL: https://app.supabase.com/project/rawhmcrtzfdhryyfovee/sql/new
-- =============================================================================
--
-- This fixes the "new row violates row-level security policy" error
-- when uploading documents to storage.
--
-- INSTRUCTIONS:
-- 1. Copy this entire file
-- 2. Paste into Supabase SQL Editor
-- 3. Click "Run" or press Cmd/Ctrl+Enter
-- 4. Verify you see success messages at the bottom
-- 5. Mark this deployment in docs/supabase-deployment-log.md
--
-- =============================================================================

-- STEP 1: Create documents storage bucket (if it doesn't exist)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'documents',
  'documents',
  false, -- Private bucket (authenticated access only)
  52428800, -- 50MB file size limit
  ARRAY[
    'application/pdf',
    'image/png',
    'image/jpeg',
    'image/jpg',
    'image/gif',
    'image/webp',
    'text/plain',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ]
)
ON CONFLICT (id) DO UPDATE SET
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- STEP 2: Enable RLS on storage tables
ALTER TABLE storage.buckets ENABLE ROW LEVEL SECURITY;
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- STEP 3: Create bucket access policy
DROP POLICY IF EXISTS buckets_select_policy ON storage.buckets;
CREATE POLICY buckets_select_policy ON storage.buckets
    FOR SELECT TO anon, authenticated
    USING (true);

-- STEP 4: Create object access policies for authenticated users

-- Policy 1: Allow authenticated users to INSERT files (upload)
DROP POLICY IF EXISTS objects_authenticated_insert ON storage.objects;
CREATE POLICY objects_authenticated_insert ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (
        bucket_id = 'documents'
        AND (storage.foldername(name))[1] = auth.uid()::text
    );

-- Policy 2: Allow authenticated users to SELECT their own files
DROP POLICY IF EXISTS objects_authenticated_select ON storage.objects;
CREATE POLICY objects_authenticated_select ON storage.objects
    FOR SELECT TO authenticated
    USING (
        bucket_id = 'documents'
        AND (storage.foldername(name))[1] = auth.uid()::text
    );

-- Policy 3: Allow authenticated users to UPDATE their own files
DROP POLICY IF EXISTS objects_authenticated_update ON storage.objects;
CREATE POLICY objects_authenticated_update ON storage.objects
    FOR UPDATE TO authenticated
    USING (
        bucket_id = 'documents'
        AND (storage.foldername(name))[1] = auth.uid()::text
    )
    WITH CHECK (
        bucket_id = 'documents'
        AND (storage.foldername(name))[1] = auth.uid()::text
    );

-- Policy 4: Allow authenticated users to DELETE their own files
DROP POLICY IF EXISTS objects_authenticated_delete ON storage.objects;
CREATE POLICY objects_authenticated_delete ON storage.objects
    FOR DELETE TO authenticated
    USING (
        bucket_id = 'documents'
        AND (storage.foldername(name))[1] = auth.uid()::text
    );

-- Policy 5: Service role has full access (for admin operations)
DROP POLICY IF EXISTS objects_service_role_policy ON storage.objects;
CREATE POLICY objects_service_role_policy ON storage.objects
    FOR ALL TO service_role
    USING (true)
    WITH CHECK (true);

-- STEP 5: Verify bucket and policies were created
DO $$
DECLARE
    bucket_count INTEGER;
    policy_count INTEGER;
BEGIN
    -- Check bucket exists
    SELECT COUNT(*) INTO bucket_count
    FROM storage.buckets
    WHERE id = 'documents';

    IF bucket_count = 0 THEN
        RAISE EXCEPTION 'Failed to create documents storage bucket';
    END IF;

    -- Check policies exist
    SELECT COUNT(*) INTO policy_count
    FROM pg_policies
    WHERE schemaname = 'storage'
        AND tablename = 'objects'
        AND policyname LIKE 'objects_%';

    IF policy_count < 5 THEN
        RAISE WARNING 'Expected at least 5 storage policies, found %', policy_count;
    END IF;

    RAISE NOTICE '✅ Documents storage bucket and RLS policies configured successfully';
    RAISE NOTICE 'Bucket count: %, Policy count: %', bucket_count, policy_count;
END
$$;

-- =============================================================================
-- EXPECTED OUTPUT:
--
-- NOTICE:  ✅ Documents storage bucket and RLS policies configured successfully
-- NOTICE:  Bucket count: 1, Policy count: 5
--
-- =============================================================================
--
-- NEXT STEPS:
-- 1. Test file upload at: https://fetchtext.app (or your production URL)
-- 2. Verify no RLS errors in browser console
-- 3. Update docs/supabase-deployment-log.md with deployment entry
--
-- =============================================================================
