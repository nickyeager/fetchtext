-- =============================================================================
-- APPLY THIS IN MANAGED SUPABASE SQL EDITOR
-- URL: https://app.supabase.com/project/rawhmcrtzfdhryyfovee/sql/new
-- =============================================================================
-- VERSION 2: Fixed for managed Supabase (skips ALTER TABLE on system tables)
-- =============================================================================

-- STEP 1: Update documents bucket settings (bucket already exists)
UPDATE storage.buckets
SET
  file_size_limit = 52428800, -- 50MB
  allowed_mime_types = ARRAY[
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
WHERE id = 'documents';

-- STEP 2: Create bucket access policy
DROP POLICY IF EXISTS buckets_select_policy ON storage.buckets;
CREATE POLICY buckets_select_policy ON storage.buckets
    FOR SELECT TO anon, authenticated
    USING (true);

-- STEP 3: Create object access policies for authenticated users

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

-- STEP 4: Verify policies were created
SELECT policyname, tablename, cmd, roles
FROM pg_policies
WHERE schemaname = 'storage'
  AND policyname LIKE 'objects_%'
ORDER BY policyname;

-- =============================================================================
-- EXPECTED OUTPUT: 5 rows showing the policies created
-- =============================================================================
