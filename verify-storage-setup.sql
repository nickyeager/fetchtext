-- Verification script to check storage bucket and RLS configuration
-- Run this script to diagnose storage upload issues
-- Execute via: psql -h localhost -U postgres -d postgres -f verify-storage-setup.sql

\echo '============================================================'
\echo 'Storage Bucket & RLS Policy Verification'
\echo '============================================================'
\echo ''

-- Check if documents bucket exists
\echo '1. Checking if documents bucket exists...'
SELECT
    id,
    name,
    public,
    file_size_limit,
    array_length(allowed_mime_types, 1) as mime_type_count
FROM storage.buckets
WHERE id = 'documents';

\echo ''
\echo '2. Checking RLS status on storage tables...'
SELECT
    tablename,
    rowsecurity as rls_enabled
FROM pg_tables
WHERE schemaname = 'storage'
    AND tablename IN ('buckets', 'objects');

\echo ''
\echo '3. Listing all storage.objects policies...'
SELECT
    policyname,
    cmd as command_type,
    roles::text,
    qual as using_expression,
    with_check as with_check_expression
FROM pg_policies
WHERE schemaname = 'storage'
    AND tablename = 'objects'
ORDER BY policyname;

\echo ''
\echo '4. Listing storage.buckets policies...'
SELECT
    policyname,
    cmd as command_type,
    roles::text,
    qual as using_expression
FROM pg_policies
WHERE schemaname = 'storage'
    AND tablename = 'buckets';

\echo ''
\echo '5. Checking PostgreSQL role grants...'
SELECT
    r.rolname,
    ARRAY_AGG(m.rolname) as member_of_roles
FROM pg_roles r
LEFT JOIN pg_auth_members am ON r.oid = am.member
LEFT JOIN pg_roles m ON am.roleid = m.oid
WHERE r.rolname IN ('authenticator', 'anon', 'authenticated', 'service_role')
GROUP BY r.rolname
ORDER BY r.rolname;

\echo ''
\echo '6. Testing auth.uid() function (should return NULL for postgres user)...'
SELECT auth.uid() as current_user_id;

\echo ''
\echo '7. Checking if migrations table exists and latest migration...'
SELECT
    version,
    name,
    inserted_at
FROM supabase_migrations.schema_migrations
ORDER BY version DESC
LIMIT 5;

\echo ''
\echo '============================================================'
\echo 'Verification Complete'
\echo '============================================================'
\echo ''
\echo 'Expected results:'
\echo '  - documents bucket should exist with file_size_limit = 52428800'
\echo '  - RLS enabled on storage.buckets and storage.objects'
\echo '  - At least 6 policies on storage.objects'
\echo '  - authenticator role should have anon, authenticated, service_role grants'
\echo ''
