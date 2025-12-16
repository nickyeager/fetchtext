-- COMPREHENSIVE SCHEMA VALIDATION FOR MANAGED SUPABASE
-- Run this in: https://app.supabase.com/project/rawhmcrtzfdhryyfovee/sql/new
-- This validates that the schema matches the expected migration state

-- ============================================
-- 1. VALIDATE SMART_TEMPLATES COLUMNS
-- ============================================
SELECT
    column_name,
    data_type,
    character_maximum_length,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'smart_templates'
ORDER BY ordinal_position;

-- Expected columns:
-- id (integer, serial primary key)
-- uuid (uuid with default)
-- name (text, not null, unique)
-- description (text)
-- template_content (text, default '')
-- template_type (text, default 'markdown')
-- category (text, not null)
-- tags (text[], default '{}')
-- is_public (boolean, default false)
-- smart_variables (jsonb, default '[]')
-- extraction_rules (jsonb, default '[]')
-- generation_settings (jsonb, default '{}')
-- usage_count (integer, default 0)
-- rating (numeric(3,2), default 0.0)
-- thumbnail_url (text)
-- created_by (uuid, foreign key to auth.users)
-- created_at (timestamp with time zone)
-- updated_at (timestamp with time zone)
-- regex_fallback (jsonb, default '{}')  ← CRITICAL: Check if this exists!

-- ============================================
-- 2. VALIDATE DOCUMENTS COLUMNS
-- ============================================
SELECT
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'documents'
ORDER BY ordinal_position;

-- Expected columns:
-- id (integer, serial)
-- uuid (uuid with default)
-- name (text, not null)
-- file_path (text, not null)
-- file_type (text, not null)
-- file_size (integer)
-- content_text (text)
-- metadata (jsonb, default '{}')
-- template_id (integer, foreign key to smart_templates)
-- processing_status (text with check constraint)
-- uploaded_by (uuid, foreign key to auth.users)
-- created_at (timestamp with time zone)
-- updated_at (timestamp with time zone)

-- ============================================
-- 3. CHECK FOR MISSING COLUMNS
-- ============================================
-- Check if regex_fallback exists in smart_templates
SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'smart_templates'
      AND column_name = 'regex_fallback'
) AS regex_fallback_exists;

-- Check if extraction_rules exists (migration 010)
SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'smart_templates'
      AND column_name = 'extraction_rules'
) AS extraction_rules_exists;

-- Check if generation_settings exists (migration 010)
SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'smart_templates'
      AND column_name = 'generation_settings'
) AS generation_settings_exists;

-- ============================================
-- 4. VALIDATE INDEXES
-- ============================================
SELECT
    schemaname,
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename IN ('smart_templates', 'documents', 'templates', 'workflow_templates')
ORDER BY tablename, indexname;

-- Expected indexes on smart_templates:
-- - idx_smart_templates_category
-- - idx_smart_templates_created_by
-- - idx_smart_templates_is_public
-- - idx_smart_templates_usage_count
-- - idx_smart_templates_regex_fallback (GIN index)

-- ============================================
-- 5. VALIDATE FOREIGN KEY CONSTRAINTS
-- ============================================
SELECT
    tc.table_name,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name,
    tc.constraint_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
    AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_schema = 'public'
  AND tc.table_name IN ('smart_templates', 'documents', 'templates', 'workflow_templates', 'workflow_instances', 'workflow_executions')
ORDER BY tc.table_name, tc.constraint_name;

-- ============================================
-- 6. VALIDATE CHECK CONSTRAINTS
-- ============================================
SELECT
    con.conname AS constraint_name,
    rel.relname AS table_name,
    pg_get_constraintdef(con.oid) AS constraint_definition
FROM pg_constraint con
JOIN pg_class rel ON con.conrelid = rel.oid
JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
WHERE nsp.nspname = 'public'
  AND con.contype = 'c'
  AND rel.relname IN ('documents', 'workflow_executions', 'template_embeddings')
ORDER BY rel.relname;

-- Expected check constraints:
-- - documents.processing_status IN (...)
-- - workflow_executions.status IN (...)
-- - template_embeddings.template_type IN (...)

-- ============================================
-- 7. VALIDATE RLS POLICIES - SMART_TEMPLATES
-- ============================================
SELECT
    policyname,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'smart_templates'
ORDER BY policyname;

-- Expected policies:
-- - smart_templates_select_policy: SELECT (is_public OR created_by = auth.uid())
-- - smart_templates_insert_policy: INSERT (created_by = auth.uid())
-- - smart_templates_update_policy: UPDATE (created_by = auth.uid())
-- - smart_templates_delete_policy: DELETE (created_by = auth.uid())

-- ============================================
-- 8. VALIDATE RLS POLICIES - DOCUMENTS
-- ============================================
SELECT
    policyname,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'documents'
ORDER BY policyname;

-- Expected policies:
-- - documents_select_policy: SELECT (uploaded_by = auth.uid())
-- - documents_insert_policy: INSERT (uploaded_by = auth.uid())
-- - documents_update_policy: UPDATE (uploaded_by = auth.uid())
-- - documents_delete_policy: DELETE (uploaded_by = auth.uid())

-- ============================================
-- 9. CHECK SEED DATA - SMART_TEMPLATES
-- ============================================
SELECT
    id,
    name,
    category,
    is_public,
    CASE WHEN smart_variables IS NULL THEN 'NULL'
         WHEN jsonb_array_length(smart_variables) = 0 THEN 'EMPTY'
         ELSE jsonb_array_length(smart_variables)::text || ' variables'
    END as smart_variables_status,
    CASE WHEN regex_fallback IS NULL THEN 'NULL'
         WHEN regex_fallback::text = '{}' THEN 'EMPTY'
         ELSE 'HAS DATA'
    END as regex_fallback_status
FROM smart_templates
WHERE is_public = true
ORDER BY name;

-- Expected seed templates (migration 002):
-- - Business Card
-- - Invoice
-- - Resume
-- - Contract
-- - Receipt
-- - Letter
-- - Report
-- - Form

-- ============================================
-- 10. CHECK TEMPLATE_CATEGORIES SEED DATA
-- ============================================
SELECT * FROM template_categories ORDER BY name;

-- Expected categories:
-- - Business
-- - Financial
-- - Legal
-- - Personal
-- - HR
-- - Medical
-- - Education
-- - Other

-- ============================================
-- 11. VALIDATE STORAGE BUCKET
-- ============================================
SELECT
    id,
    name,
    public,
    file_size_limit,
    allowed_mime_types,
    created_at
FROM storage.buckets
WHERE name = 'documents';

-- Expected:
-- - name: 'documents'
-- - public: false
-- - file_size_limit: 52428800 (50MB)

-- ============================================
-- 12. CHECK STORAGE RLS POLICIES
-- ============================================
SELECT
    policyname,
    tablename,
    cmd,
    qual
FROM pg_policies
WHERE schemaname = 'storage'
  AND tablename = 'objects'
  AND policyname LIKE '%documents%'
ORDER BY policyname;

-- Expected storage policies for documents bucket:
-- - documents_bucket_select_policy
-- - documents_bucket_insert_policy
-- - documents_bucket_update_policy
-- - documents_bucket_delete_policy

-- ============================================
-- SUMMARY QUERY - QUICK HEALTH CHECK
-- ============================================
SELECT
    'Tables' as check_category,
    (SELECT COUNT(*) FROM information_schema.tables
     WHERE table_schema = 'public'
       AND table_name IN ('smart_templates', 'documents', 'templates',
                          'workflow_templates', 'template_embeddings',
                          'workflow_instances', 'workflow_executions',
                          'template_categories')) as found,
    8 as expected
UNION ALL
SELECT
    'Storage Buckets',
    (SELECT COUNT(*) FROM storage.buckets WHERE name = 'documents'),
    1
UNION ALL
SELECT
    'Smart Templates (seed data)',
    (SELECT COUNT(*) FROM smart_templates WHERE is_public = true),
    8
UNION ALL
SELECT
    'Template Categories',
    (SELECT COUNT(*) FROM template_categories),
    8
UNION ALL
SELECT
    'Indexes on smart_templates',
    (SELECT COUNT(*) FROM pg_indexes
     WHERE schemaname = 'public'
       AND tablename = 'smart_templates'
       AND indexname LIKE 'idx_%'),
    5
UNION ALL
SELECT
    'RLS Policies on smart_templates',
    (SELECT COUNT(*) FROM pg_policies
     WHERE schemaname = 'public'
       AND tablename = 'smart_templates'),
    4
UNION ALL
SELECT
    'RLS Policies on documents',
    (SELECT COUNT(*) FROM pg_policies
     WHERE schemaname = 'public'
       AND tablename = 'documents'),
    4;
