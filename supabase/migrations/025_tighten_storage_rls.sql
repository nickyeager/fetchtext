-- Migration: Tighten storage RLS policies with ownership filtering
-- Previously, any authenticated user could read/write/delete ALL files in the
-- documents bucket. This adds folder-based isolation: files must be stored in
-- a folder named after the user's auth.uid().
--
-- Upload path convention: documents/{auth.uid()}/filename.pdf
-- The frontend's document upload code already uses this path structure.

-- Drop the overly permissive ALL policy (created in earlier migration)
DROP POLICY IF EXISTS "objects_all_authenticated" ON storage.objects;
-- Also drop per-operation policies in case this migration runs again (idempotent)
DROP POLICY IF EXISTS "objects_authenticated_insert" ON storage.objects;
DROP POLICY IF EXISTS "objects_authenticated_select" ON storage.objects;
DROP POLICY IF EXISTS "objects_authenticated_update" ON storage.objects;
DROP POLICY IF EXISTS "objects_authenticated_delete" ON storage.objects;

-- INSERT: Users can only upload to their own folder
CREATE POLICY "objects_authenticated_insert"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
    bucket_id = 'documents'
    AND (storage.foldername(name))[1] = auth.uid()::text
);

-- SELECT: Users can read their own files + service role can read all
CREATE POLICY "objects_authenticated_select"
ON storage.objects FOR SELECT TO authenticated
USING (
    bucket_id = 'documents'
    AND (storage.foldername(name))[1] = auth.uid()::text
);

-- UPDATE: Users can only update their own files
CREATE POLICY "objects_authenticated_update"
ON storage.objects FOR UPDATE TO authenticated
USING (
    bucket_id = 'documents'
    AND (storage.foldername(name))[1] = auth.uid()::text
)
WITH CHECK (
    bucket_id = 'documents'
    AND (storage.foldername(name))[1] = auth.uid()::text
);

-- DELETE: Users can only delete their own files
CREATE POLICY "objects_authenticated_delete"
ON storage.objects FOR DELETE TO authenticated
USING (
    bucket_id = 'documents'
    AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Service role policy remains unchanged (full access for backend operations)
-- Already exists from migration 024

-- Verify policies
SELECT policyname, cmd, roles
FROM pg_policies
WHERE schemaname = 'storage' AND tablename = 'objects'
ORDER BY policyname;
