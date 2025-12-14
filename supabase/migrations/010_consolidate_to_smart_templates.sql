-- Migration: Consolidate all templates to smart_templates with regex fallback support
-- Goal: Process documents → Extract variables (AI-first, regex fallback) → Generate new documents

-- Step 1: Add regex_fallback column to smart_templates if it doesn't exist
ALTER TABLE smart_templates 
ADD COLUMN IF NOT EXISTS regex_fallback JSONB DEFAULT '{}';

-- Add comment explaining the field
COMMENT ON COLUMN smart_templates.regex_fallback IS 'Regex patterns for fallback extraction when AI extraction fails or has low confidence. Format: {"field_name": "regex_pattern"}';

-- Step 2: Update smart_variables structure to include regex_fallback
-- This requires updating existing smart_variables to include the new field
UPDATE smart_templates
SET smart_variables = (
  SELECT jsonb_agg(
    CASE 
      WHEN elem ? 'regex_fallback' THEN elem
      ELSE elem || '{"regex_fallback": null}'::jsonb
    END
  )
  FROM jsonb_array_elements(smart_variables) elem
)
WHERE smart_variables IS NOT NULL AND smart_variables != '[]'::jsonb;

-- Step 3: Migrate standard templates to smart_templates
INSERT INTO smart_templates (
  name, 
  description, 
  category, 
  tags, 
  is_public, 
  template_content,
  smart_variables, 
  regex_fallback, 
  created_by, 
  created_at, 
  updated_at,
  usage_count,
  rating
)
SELECT 
  t.name || ' (Migrated)',  -- Add suffix to avoid conflicts
  t.description,
  t.category,
  t.tags,
  t.is_public,
  COALESCE(t.content, '') as template_content,
  -- Convert fields to smart_variables format
  COALESCE(
    (
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', md5(random()::text || clock_timestamp()::text)::uuid::text,
          'name', field->>'name',
          'type', CASE 
            WHEN field->>'type' IN ('text', 'number', 'date', 'email', 'phone', 'currency') THEN field->>'type'
            ELSE 'text'
          END,
          'description', COALESCE(field->>'description', 'Extracted from ' || (field->>'name')),
          'extraction_hints', ARRAY[field->>'name', LOWER(field->>'name'), UPPER(field->>'name')],
          'regex_fallback', field#>>'{validation,pattern}',
          'required', COALESCE((field->>'required')::boolean, false),
          'confidence_threshold', 0.6
        )
      )
      FROM jsonb_array_elements(COALESCE(t.fields, '[]'::jsonb)) AS field
    ),
    '[]'::jsonb
  ) as smart_variables,
  -- Extract regex patterns into fallback object
  COALESCE(
    (
      SELECT jsonb_object_agg(
        field->>'name',
        field#>>'{validation,pattern}'
      )
      FROM jsonb_array_elements(COALESCE(t.fields, '[]'::jsonb)) AS field
      WHERE field#>>'{validation,pattern}' IS NOT NULL 
        AND field#>>'{validation,pattern}' != ''
    ),
    '{}'::jsonb
  ) as regex_fallback,
  t.created_by,
  t.created_at,
  t.updated_at,
  t.usage_count,
  t.rating
FROM templates t
WHERE NOT EXISTS (
  SELECT 1 FROM smart_templates st 
  WHERE st.name = t.name || ' (Migrated)'
    AND COALESCE(st.created_by, '00000000-0000-0000-0000-000000000000'::uuid) = COALESCE(t.created_by, '00000000-0000-0000-0000-000000000000'::uuid)
);

-- Step 4: Migrate workflow_templates to smart_templates (for document generation)
INSERT INTO smart_templates (
  name, 
  description, 
  category, 
  tags, 
  is_public, 
  template_content,
  template_type,
  smart_variables, 
  generation_settings, 
  created_by, 
  created_at, 
  updated_at,
  usage_count,
  rating
)
SELECT 
  wt.name || ' (Workflow)',  -- Add suffix to identify workflow-based templates
  wt.description,
  wt.category,
  wt.tags,
  wt.is_public,
  COALESCE(wt.documentation, '') as template_content,
  'workflow' as template_type,
  -- Convert input_schema to smart_variables for extraction if needed
  COALESCE(
    (
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', md5(random()::text || clock_timestamp()::text)::uuid::text,
          'name', key,
          'type', CASE 
            WHEN value->>'type' = 'string' THEN 'text'
            WHEN value->>'type' = 'number' THEN 'number'
            WHEN value->>'type' = 'boolean' THEN 'text'
            ELSE 'text'
          END,
          'description', COALESCE(value->>'description', key),
          'extraction_hints', ARRAY[key],
          'required', COALESCE((value->>'required')::boolean, false),
          'confidence_threshold', 0.7
        )
      )
      FROM jsonb_each(COALESCE(wt.input_schema->'properties', '{}'::jsonb))
    ),
    '[]'::jsonb
  ) as smart_variables,
  -- Store workflow configuration in generation_settings
  jsonb_build_object(
    'type', 'workflow',
    'workflow_config', wt.workflow_config,
    'input_schema', wt.input_schema,
    'output_schema', wt.output_schema,
    'output_format', 'workflow',
    'template_engine', 'n8n'
  ) as generation_settings,
  wt.created_by,
  wt.created_at,
  wt.updated_at,
  wt.usage_count,
  wt.rating
FROM workflow_templates wt
WHERE NOT EXISTS (
  SELECT 1 FROM smart_templates st 
  WHERE st.name = wt.name || ' (Workflow)'
    AND COALESCE(st.created_by, '00000000-0000-0000-0000-000000000000'::uuid) = COALESCE(wt.created_by, '00000000-0000-0000-0000-000000000000'::uuid)
);

-- Step 5: Update documents table to reference smart_templates
-- First, create a mapping of old template IDs to new smart_template IDs
WITH template_mapping AS (
  SELECT 
    t.id as old_id,
    st.id as new_id
  FROM templates t
  JOIN smart_templates st ON 
    st.name = t.name || ' (Migrated)' 
    AND st.created_by = t.created_by
)
UPDATE documents d
SET template_id = tm.new_id
FROM template_mapping tm
WHERE d.template_id = tm.old_id
  AND d.template_id IN (SELECT id FROM templates);

-- Step 6: Update template_embeddings to only reference smart templates
DELETE FROM template_embeddings 
WHERE template_type IN ('standard', 'workflow');

-- Update any remaining embeddings to ensure they're marked as 'smart'
UPDATE template_embeddings 
SET template_type = 'smart'
WHERE template_type IS NULL OR template_type != 'smart';

-- Step 7: Update workflow_instances to reference smart_templates
WITH workflow_template_mapping AS (
  SELECT 
    wt.id as old_id,
    st.id as new_id
  FROM workflow_templates wt
  JOIN smart_templates st ON 
    st.name = wt.name || ' (Workflow)' 
    AND st.created_by = wt.created_by
)
UPDATE workflow_instances wi
SET template_id = wtm.new_id
FROM workflow_template_mapping wtm
WHERE wi.template_id = wtm.old_id;

-- Step 8: Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_smart_templates_category ON smart_templates(category);
CREATE INDEX IF NOT EXISTS idx_smart_templates_is_public ON smart_templates(is_public);
CREATE INDEX IF NOT EXISTS idx_smart_templates_created_by ON smart_templates(created_by);
CREATE INDEX IF NOT EXISTS idx_smart_templates_regex_fallback ON smart_templates USING GIN (regex_fallback);

-- Step 9: Add helpful comments
COMMENT ON TABLE smart_templates IS 'Unified template system for AI-powered document processing with regex fallback. Supports extraction and generation.';
COMMENT ON COLUMN smart_templates.smart_variables IS 'AI-powered extraction variables with semantic descriptions and optional regex fallback patterns';
COMMENT ON COLUMN smart_templates.generation_settings IS 'Configuration for document generation including workflow integration for automated document creation';

-- Step 10: Create backup tables before dropping (safety measure)
-- These can be dropped manually after verification
CREATE TABLE IF NOT EXISTS _backup_templates AS SELECT * FROM templates;
CREATE TABLE IF NOT EXISTS _backup_workflow_templates AS SELECT * FROM workflow_templates;

-- Step 11: Update any functions or views that reference old tables
-- Add any custom function updates here if needed

-- Step 12: Log migration summary
DO $$
DECLARE
  templates_migrated INTEGER;
  workflows_migrated INTEGER;
  total_smart_templates INTEGER;
BEGIN
  SELECT COUNT(*) INTO templates_migrated FROM templates;
  SELECT COUNT(*) INTO workflows_migrated FROM workflow_templates;
  SELECT COUNT(*) INTO total_smart_templates FROM smart_templates;
  
  RAISE NOTICE 'Migration Summary:';
  RAISE NOTICE '- Standard templates migrated: %', templates_migrated;
  RAISE NOTICE '- Workflow templates migrated: %', workflows_migrated;
  RAISE NOTICE '- Total smart templates: %', total_smart_templates;
  RAISE NOTICE 'Backup tables created: _backup_templates, _backup_workflow_templates';
  RAISE NOTICE 'Original tables NOT dropped - run cleanup migration after verification';
END $$;

-- NOTE: DO NOT DROP TABLES YET
-- After verification, run the cleanup migration:
-- DROP TABLE IF EXISTS templates;
-- DROP TABLE IF EXISTS workflow_templates;
-- DROP TABLE IF EXISTS _backup_templates;
-- DROP TABLE IF EXISTS _backup_workflow_templates;
