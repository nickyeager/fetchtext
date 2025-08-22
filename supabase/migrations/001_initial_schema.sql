-- Initial schema for FetchText LocalAI platform
-- This includes all template-related tables needed by the application

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Template categories
CREATE TABLE template_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  icon TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Smart templates (AI-powered document processing)
CREATE TABLE smart_templates (
  id SERIAL PRIMARY KEY,
  uuid UUID DEFAULT gen_random_uuid() UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  template_content TEXT DEFAULT '',
  template_type TEXT DEFAULT 'markdown',
  category TEXT NOT NULL,
  tags TEXT[] DEFAULT '{}',
  is_public BOOLEAN DEFAULT false,
  smart_variables JSONB DEFAULT '[]',
  extraction_rules JSONB DEFAULT '[]',
  generation_settings JSONB DEFAULT '{}',
  usage_count INTEGER DEFAULT 0,
  rating DECIMAL(3,2) DEFAULT 0.0,
  thumbnail_url TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Standard templates (basic field-based)
CREATE TABLE templates (
  id SERIAL PRIMARY KEY,
  uuid UUID DEFAULT gen_random_uuid() UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  content TEXT DEFAULT '',
  category TEXT NOT NULL,
  tags TEXT[] DEFAULT '{}',
  is_public BOOLEAN DEFAULT false,
  fields JSONB DEFAULT '[]',
  usage_count INTEGER DEFAULT 0,
  rating DECIMAL(3,2) DEFAULT 0.0,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Workflow templates (N8N/automation workflows)
CREATE TABLE workflow_templates (
  id SERIAL PRIMARY KEY,
  uuid UUID DEFAULT gen_random_uuid() UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL,
  tags TEXT[] DEFAULT '{}',
  is_public BOOLEAN DEFAULT false,
  workflow_config JSONB DEFAULT '{}',
  input_schema JSONB,
  output_schema JSONB,
  documentation TEXT,
  usage_count INTEGER DEFAULT 0,
  rating DECIMAL(3,2) DEFAULT 0.0,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Template embeddings for semantic search
CREATE TABLE template_embeddings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id INTEGER,
  template_type TEXT CHECK (template_type IN ('smart', 'standard', 'workflow')),
  embedding vector(1536),
  content TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Workflow instances
CREATE TABLE workflow_instances (
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

-- Workflow executions
CREATE TABLE workflow_executions (
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

-- Create indexes for performance
CREATE INDEX idx_smart_templates_category ON smart_templates(category);
CREATE INDEX idx_smart_templates_created_by ON smart_templates(created_by);
CREATE INDEX idx_smart_templates_is_public ON smart_templates(is_public);
CREATE INDEX idx_smart_templates_usage_count ON smart_templates(usage_count DESC);

CREATE INDEX idx_templates_category ON templates(category);
CREATE INDEX idx_templates_created_by ON templates(created_by);
CREATE INDEX idx_templates_is_public ON templates(is_public);

CREATE INDEX idx_workflow_templates_category ON workflow_templates(category);
CREATE INDEX idx_workflow_templates_created_by ON workflow_templates(created_by);
CREATE INDEX idx_workflow_templates_is_public ON workflow_templates(is_public);

-- Insert default categories
INSERT INTO template_categories (name, description, icon) VALUES
('general', 'General purpose templates', 'file-text'),
('invoice', 'Invoice and billing templates', 'receipt'),
('contract', 'Contract and legal templates', 'file-signature'),
('report', 'Report and analysis templates', 'chart-bar'),
('letter', 'Letter and communication templates', 'mail'),
('form', 'Form and survey templates', 'clipboard-list');

-- Update timestamps trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Add update triggers
CREATE TRIGGER update_smart_templates_updated_at BEFORE UPDATE ON smart_templates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_templates_updated_at BEFORE UPDATE ON templates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_workflow_templates_updated_at BEFORE UPDATE ON workflow_templates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_workflow_instances_updated_at BEFORE UPDATE ON workflow_instances
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();