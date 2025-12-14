-- Enable Row Level Security (RLS) for all user data tables
-- This ensures users can only read and modify their own data

-- Create missing tables if they don't exist
CREATE TABLE IF NOT EXISTS template_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  icon TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS template_embeddings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id INTEGER,
  template_type TEXT CHECK (template_type IN ('smart', 'standard', 'workflow')),
  content TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS workflow_instances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id INTEGER,
  project_ref TEXT,
  name TEXT NOT NULL,
  configuration JSONB,
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS workflow_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_instance_id UUID REFERENCES workflow_instances(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled')),
  input_data JSONB,
  output_data JSONB,
  error_message TEXT,
  execution_time_ms INTEGER,
  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  finished_at TIMESTAMP WITH TIME ZONE
);

-- Insert default categories
INSERT INTO template_categories (name, description, icon) VALUES
('general', 'General purpose templates', 'file-text'),
('invoice', 'Invoice and billing templates', 'receipt'),
('contract', 'Contract and legal templates', 'file-signature'),
('report', 'Report and analysis templates', 'chart-bar'),
('letter', 'Letter and communication templates', 'mail'),
('form', 'Form and survey templates', 'clipboard-list')
ON CONFLICT (name) DO NOTHING;

-- Enable RLS on all user data tables
ALTER TABLE smart_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE template_embeddings ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_instances ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_executions ENABLE ROW LEVEL SECURITY;

-- Note: template_categories is reference data, no RLS needed

-- Smart Templates RLS Policies
-- Users can read public templates or their own private templates
CREATE POLICY "smart_templates_select_policy" ON smart_templates
    FOR SELECT USING (
        is_public = true OR 
        created_by = auth.uid()
    );

-- Users can insert their own templates
CREATE POLICY "smart_templates_insert_policy" ON smart_templates
    FOR INSERT WITH CHECK (
        created_by = auth.uid()
    );

-- Users can update their own templates
CREATE POLICY "smart_templates_update_policy" ON smart_templates
    FOR UPDATE USING (
        created_by = auth.uid()
    ) WITH CHECK (
        created_by = auth.uid()
    );

-- Users can delete their own templates
CREATE POLICY "smart_templates_delete_policy" ON smart_templates
    FOR DELETE USING (
        created_by = auth.uid()
    );

-- Standard Templates RLS Policies
-- Users can read public templates or their own private templates
CREATE POLICY "templates_select_policy" ON templates
    FOR SELECT USING (
        is_public = true OR 
        created_by = auth.uid()
    );

-- Users can insert their own templates
CREATE POLICY "templates_insert_policy" ON templates
    FOR INSERT WITH CHECK (
        created_by = auth.uid()
    );

-- Users can update their own templates
CREATE POLICY "templates_update_policy" ON templates
    FOR UPDATE USING (
        created_by = auth.uid()
    ) WITH CHECK (
        created_by = auth.uid()
    );

-- Users can delete their own templates
CREATE POLICY "templates_delete_policy" ON templates
    FOR DELETE USING (
        created_by = auth.uid()
    );

-- Workflow Templates RLS Policies
-- Users can read public workflow templates or their own private workflow templates
CREATE POLICY "workflow_templates_select_policy" ON workflow_templates
    FOR SELECT USING (
        is_public = true OR 
        created_by = auth.uid()
    );

-- Users can insert their own workflow templates
CREATE POLICY "workflow_templates_insert_policy" ON workflow_templates
    FOR INSERT WITH CHECK (
        created_by = auth.uid()
    );

-- Users can update their own workflow templates
CREATE POLICY "workflow_templates_update_policy" ON workflow_templates
    FOR UPDATE USING (
        created_by = auth.uid()
    ) WITH CHECK (
        created_by = auth.uid()
    );

-- Users can delete their own workflow templates
CREATE POLICY "workflow_templates_delete_policy" ON workflow_templates
    FOR DELETE USING (
        created_by = auth.uid()
    );

-- Template Embeddings RLS Policies
-- Users can read embeddings for templates they have access to
CREATE POLICY "template_embeddings_select_policy" ON template_embeddings
    FOR SELECT USING (
        CASE 
            WHEN template_type = 'smart' THEN 
                EXISTS (
                    SELECT 1 FROM smart_templates st 
                    WHERE st.id = template_embeddings.template_id 
                    AND (st.is_public = true OR st.created_by = auth.uid())
                )
            WHEN template_type = 'standard' THEN 
                EXISTS (
                    SELECT 1 FROM templates t 
                    WHERE t.id = template_embeddings.template_id 
                    AND (t.is_public = true OR t.created_by = auth.uid())
                )
            WHEN template_type = 'workflow' THEN 
                EXISTS (
                    SELECT 1 FROM workflow_templates wt 
                    WHERE wt.id = template_embeddings.template_id 
                    AND (wt.is_public = true OR wt.created_by = auth.uid())
                )
            ELSE false
        END
    );

-- Users can insert embeddings for templates they own
CREATE POLICY "template_embeddings_insert_policy" ON template_embeddings
    FOR INSERT WITH CHECK (
        CASE 
            WHEN template_type = 'smart' THEN 
                EXISTS (
                    SELECT 1 FROM smart_templates st 
                    WHERE st.id = template_embeddings.template_id 
                    AND st.created_by = auth.uid()
                )
            WHEN template_type = 'standard' THEN 
                EXISTS (
                    SELECT 1 FROM templates t 
                    WHERE t.id = template_embeddings.template_id 
                    AND t.created_by = auth.uid()
                )
            WHEN template_type = 'workflow' THEN 
                EXISTS (
                    SELECT 1 FROM workflow_templates wt 
                    WHERE wt.id = template_embeddings.template_id 
                    AND wt.created_by = auth.uid()
                )
            ELSE false
        END
    );

-- Users can update embeddings for templates they own
CREATE POLICY "template_embeddings_update_policy" ON template_embeddings
    FOR UPDATE USING (
        CASE 
            WHEN template_type = 'smart' THEN 
                EXISTS (
                    SELECT 1 FROM smart_templates st 
                    WHERE st.id = template_embeddings.template_id 
                    AND st.created_by = auth.uid()
                )
            WHEN template_type = 'standard' THEN 
                EXISTS (
                    SELECT 1 FROM templates t 
                    WHERE t.id = template_embeddings.template_id 
                    AND t.created_by = auth.uid()
                )
            WHEN template_type = 'workflow' THEN 
                EXISTS (
                    SELECT 1 FROM workflow_templates wt 
                    WHERE wt.id = template_embeddings.template_id 
                    AND wt.created_by = auth.uid()
                )
            ELSE false
        END
    );

-- Users can delete embeddings for templates they own
CREATE POLICY "template_embeddings_delete_policy" ON template_embeddings
    FOR DELETE USING (
        CASE 
            WHEN template_type = 'smart' THEN 
                EXISTS (
                    SELECT 1 FROM smart_templates st 
                    WHERE st.id = template_embeddings.template_id 
                    AND st.created_by = auth.uid()
                )
            WHEN template_type = 'standard' THEN 
                EXISTS (
                    SELECT 1 FROM templates t 
                    WHERE t.id = template_embeddings.template_id 
                    AND t.created_by = auth.uid()
                )
            WHEN template_type = 'workflow' THEN 
                EXISTS (
                    SELECT 1 FROM workflow_templates wt 
                    WHERE wt.id = template_embeddings.template_id 
                    AND wt.created_by = auth.uid()
                )
            ELSE false
        END
    );

-- Workflow Instances RLS Policies
-- Users can read their own workflow instances
CREATE POLICY "workflow_instances_select_policy" ON workflow_instances
    FOR SELECT USING (
        created_by = auth.uid()
    );

-- Users can insert their own workflow instances
CREATE POLICY "workflow_instances_insert_policy" ON workflow_instances
    FOR INSERT WITH CHECK (
        created_by = auth.uid()
    );

-- Users can update their own workflow instances
CREATE POLICY "workflow_instances_update_policy" ON workflow_instances
    FOR UPDATE USING (
        created_by = auth.uid()
    ) WITH CHECK (
        created_by = auth.uid()
    );

-- Users can delete their own workflow instances
CREATE POLICY "workflow_instances_delete_policy" ON workflow_instances
    FOR DELETE USING (
        created_by = auth.uid()
    );

-- Workflow Executions RLS Policies
-- Users can read executions for workflow instances they own
CREATE POLICY "workflow_executions_select_policy" ON workflow_executions
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM workflow_instances wi 
            WHERE wi.id = workflow_executions.workflow_instance_id 
            AND wi.created_by = auth.uid()
        )
    );

-- Users can insert executions for workflow instances they own
CREATE POLICY "workflow_executions_insert_policy" ON workflow_executions
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM workflow_instances wi 
            WHERE wi.id = workflow_executions.workflow_instance_id 
            AND wi.created_by = auth.uid()
        )
    );

-- Users can update executions for workflow instances they own
CREATE POLICY "workflow_executions_update_policy" ON workflow_executions
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM workflow_instances wi 
            WHERE wi.id = workflow_executions.workflow_instance_id 
            AND wi.created_by = auth.uid()
        )
    ) WITH CHECK (
        EXISTS (
            SELECT 1 FROM workflow_instances wi 
            WHERE wi.id = workflow_executions.workflow_instance_id 
            AND wi.created_by = auth.uid()
        )
    );

-- Users can delete executions for workflow instances they own
CREATE POLICY "workflow_executions_delete_policy" ON workflow_executions
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM workflow_instances wi 
            WHERE wi.id = workflow_executions.workflow_instance_id 
            AND wi.created_by = auth.uid()
        )
    );

-- Template Categories can be read by everyone (public data)
-- No RLS needed for template_categories as it's reference data

-- Create helper function to check if user owns template
CREATE OR REPLACE FUNCTION user_owns_template(table_name TEXT, template_id INTEGER)
RETURNS BOOLEAN AS $$
BEGIN
    CASE table_name
        WHEN 'smart_templates' THEN
            RETURN EXISTS (
                SELECT 1 FROM smart_templates 
                WHERE id = template_id AND created_by = auth.uid()
            );
        WHEN 'templates' THEN
            RETURN EXISTS (
                SELECT 1 FROM templates 
                WHERE id = template_id AND created_by = auth.uid()
            );
        WHEN 'workflow_templates' THEN
            RETURN EXISTS (
                SELECT 1 FROM workflow_templates 
                WHERE id = template_id AND created_by = auth.uid()
            );
        ELSE
            RETURN FALSE;
    END CASE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant necessary permissions to authenticated users
GRANT SELECT ON template_categories TO anon, authenticated;
GRANT ALL ON smart_templates TO authenticated;
GRANT ALL ON templates TO authenticated;
GRANT ALL ON workflow_templates TO authenticated;
GRANT ALL ON template_embeddings TO authenticated;
GRANT ALL ON workflow_instances TO authenticated;
GRANT ALL ON workflow_executions TO authenticated;

-- Grant sequence usage for auto-increment columns
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- Comments for documentation
COMMENT ON POLICY "smart_templates_select_policy" ON smart_templates IS 'Users can read public templates or their own private templates';
COMMENT ON POLICY "smart_templates_insert_policy" ON smart_templates IS 'Users can only create templates with themselves as the creator';
COMMENT ON POLICY "smart_templates_update_policy" ON smart_templates IS 'Users can only update templates they created';
COMMENT ON POLICY "smart_templates_delete_policy" ON smart_templates IS 'Users can only delete templates they created';

COMMENT ON POLICY "templates_select_policy" ON templates IS 'Users can read public templates or their own private templates';
COMMENT ON POLICY "templates_insert_policy" ON templates IS 'Users can only create templates with themselves as the creator';
COMMENT ON POLICY "templates_update_policy" ON templates IS 'Users can only update templates they created';
COMMENT ON POLICY "templates_delete_policy" ON templates IS 'Users can only delete templates they created';

COMMENT ON POLICY "workflow_templates_select_policy" ON workflow_templates IS 'Users can read public workflow templates or their own private workflow templates';
COMMENT ON POLICY "workflow_templates_insert_policy" ON workflow_templates IS 'Users can only create workflow templates with themselves as the creator';
COMMENT ON POLICY "workflow_templates_update_policy" ON workflow_templates IS 'Users can only update workflow templates they created';
COMMENT ON POLICY "workflow_templates_delete_policy" ON workflow_templates IS 'Users can only delete workflow templates they created';