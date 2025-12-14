-- Cleanup Migration: Remove legacy template tables after verification
-- RUN THIS ONLY AFTER CONFIRMING THE CONSOLIDATION MIGRATION WAS SUCCESSFUL

-- Step 1: Verify all data has been migrated
DO $$
DECLARE
  unmigrated_templates INTEGER;
  unmigrated_workflows INTEGER;
  unmigrated_documents INTEGER;
BEGIN
  -- Check for any templates not migrated
  SELECT COUNT(*) INTO unmigrated_templates 
  FROM templates t
  WHERE NOT EXISTS (
    SELECT 1 FROM smart_templates st 
    WHERE st.name = t.name || ' (Migrated)' 
    AND COALESCE(st.created_by, '00000000-0000-0000-0000-000000000000'::uuid) = COALESCE(t.created_by, '00000000-0000-0000-0000-000000000000'::uuid)
  );
  
  -- Check for any workflow templates not migrated
  SELECT COUNT(*) INTO unmigrated_workflows 
  FROM workflow_templates wt
  WHERE NOT EXISTS (
    SELECT 1 FROM smart_templates st 
    WHERE st.name = wt.name || ' (Workflow)' 
    AND COALESCE(st.created_by, '00000000-0000-0000-0000-000000000000'::uuid) = COALESCE(wt.created_by, '00000000-0000-0000-0000-000000000000'::uuid)
  );
  
  -- Check for any documents still referencing old templates
  SELECT COUNT(*) INTO unmigrated_documents
  FROM documents
  WHERE template_id IN (SELECT id FROM templates);
  
  IF unmigrated_templates > 0 OR unmigrated_workflows > 0 OR unmigrated_documents > 0 THEN
    RAISE EXCEPTION 'Cannot drop tables - unmigrated data found! Templates: %, Workflows: %, Documents: %', 
      unmigrated_templates, unmigrated_workflows, unmigrated_documents;
  END IF;
  
  RAISE NOTICE 'All data migrated successfully. Safe to drop legacy tables.';
END $$;

-- Step 2: Drop foreign key constraints first
ALTER TABLE IF EXISTS workflow_instances 
  DROP CONSTRAINT IF EXISTS workflow_instances_template_id_fkey;

ALTER TABLE IF EXISTS documents 
  DROP CONSTRAINT IF EXISTS documents_template_id_fkey;

-- Step 3: Drop legacy tables
DROP TABLE IF EXISTS templates CASCADE;
DROP TABLE IF EXISTS workflow_templates CASCADE;

-- Step 4: Clean up backup tables if they exist
DROP TABLE IF EXISTS _backup_templates;
DROP TABLE IF EXISTS _backup_workflow_templates;

-- Step 5: Clean up any orphaned template_embeddings
DELETE FROM template_embeddings 
WHERE template_type != 'smart';

-- Step 6: Add new foreign key constraint for documents to smart_templates
ALTER TABLE documents
  ADD CONSTRAINT documents_template_id_fkey 
  FOREIGN KEY (template_id) 
  REFERENCES smart_templates(id);

-- Step 7: Add new foreign key constraint for workflow_instances to smart_templates
ALTER TABLE workflow_instances
  ADD CONSTRAINT workflow_instances_template_id_fkey 
  FOREIGN KEY (template_id) 
  REFERENCES smart_templates(id);

-- Step 8: Final cleanup and optimization
VACUUM ANALYZE smart_templates;
VACUUM ANALYZE documents;
VACUUM ANALYZE workflow_instances;

-- Log completion
DO $$
BEGIN
  RAISE NOTICE 'Legacy template cleanup completed successfully!';
  RAISE NOTICE 'All templates are now unified in the smart_templates table.';
END $$;
