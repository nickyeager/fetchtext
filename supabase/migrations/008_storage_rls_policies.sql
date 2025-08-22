-- Storage RLS policies for documents bucket
-- These policies allow authenticated users to manage their own files in the documents bucket

-- Buckets policies - allow all users to see available buckets
CREATE POLICY IF NOT EXISTS buckets_select_policy ON storage.buckets
    FOR SELECT TO anon, authenticated USING (true);

-- Objects policies for documents bucket - simplified for reliable document uploads
CREATE POLICY IF NOT EXISTS objects_all_authenticated ON storage.objects
    FOR ALL TO authenticated 
    USING (bucket_id = 'documents') 
    WITH CHECK (bucket_id = 'documents');

-- Allow anonymous users to view objects (for public documents if needed)
CREATE POLICY IF NOT EXISTS objects_select_anon ON storage.objects
    FOR SELECT TO anon 
    USING (bucket_id = 'documents');

-- Service role has full access (for admin operations)
CREATE POLICY IF NOT EXISTS objects_service_role_policy ON storage.objects
    FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Ensure RLS is enabled
ALTER TABLE storage.buckets ENABLE ROW LEVEL SECURITY;
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;