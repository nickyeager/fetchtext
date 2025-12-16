-- Run this in your managed Supabase SQL Editor to check current database state
-- URL: https://app.supabase.com/project/rawhmcrtzfdhryyfovee/sql/new

-- ============================================
-- 1. CHECK EXISTING TABLES
-- ============================================
SELECT
    table_name,
    (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = t.table_name AND table_schema = 'public') as column_count
FROM information_schema.tables t
WHERE table_schema = 'public'
ORDER BY table_name;

-- ============================================
-- 2. CHECK STORAGE BUCKETS
-- ============================================
SELECT
    id,
    name,
    public,
    file_size_limit,
    created_at
FROM storage.buckets
ORDER BY name;

-- ============================================
-- 3. CHECK IF MIGRATIONS TABLE EXISTS
-- ============================================
SELECT EXISTS (
    SELECT FROM information_schema.tables
    WHERE table_schema = 'supabase_migrations'
    AND table_name = 'schema_migrations'
) as migrations_table_exists;

-- ============================================
-- 4. CHECK APPLIED MIGRATIONS (if table exists)
-- ============================================
-- Run this if the above query returns true
SELECT version, name, inserted_at
FROM supabase_migrations.schema_migrations
ORDER BY version DESC
LIMIT 20;

-- ============================================
-- 5. CHECK RLS STATUS ON TABLES
-- ============================================
SELECT
    schemaname,
    tablename,
    rowsecurity as rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;

-- ============================================
-- 6. CHECK EXISTING RLS POLICIES
-- ============================================
SELECT
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- ============================================
-- 7. CHECK SMART_TEMPLATES TABLE (if exists)
-- ============================================
-- Run this if smart_templates exists
SELECT
    id,
    name,
    category,
    is_public,
    created_by,
    created_at
FROM smart_templates
ORDER BY created_at DESC
LIMIT 10;

-- ============================================
-- 8. CHECK DOCUMENTS TABLE (if exists)
-- ============================================
-- Run this if documents exists
SELECT COUNT(*) as document_count FROM documents;

-- ============================================
-- 9. CHECK TEMPLATE_CATEGORIES TABLE (if exists)
-- ============================================
-- Run this if template_categories exists
SELECT * FROM template_categories ORDER BY name;

-- ============================================
-- 10. CHECK EXTENSIONS
-- ============================================
SELECT
    extname as extension_name,
    extversion as version
FROM pg_extension
WHERE extname IN ('uuid-ossp', 'pgcrypto', 'vector')
ORDER BY extname;
