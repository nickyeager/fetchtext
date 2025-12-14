-- SUPABASE MANAGED MIGRATION SCRIPT
-- Run this in Supabase SQL Editor: https://app.supabase.com/project/rawhmcrtzfdhryyfovee/sql/new
-- This combines all 12 migration files in order
-- NOTE: Extensions are already enabled in managed Supabase, so we skip those

-- Initial schema for FetchText LocalAI platform
-- This includes all template-related tables needed by the application

-- Template categories
CREATE TABLE IF NOT EXISTS template_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  icon TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Smart templates (AI-powered document processing)
CREATE TABLE IF NOT EXISTS smart_templates (
  id SERIAL PRIMARY KEY,
  uuid UUID DEFAULT gen_random_uuid() UNIQUE,
  name TEXT NOT NULL UNIQUE,
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
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  regex_fallback JSONB DEFAULT '{}'
);

-- Standard templates (basic field-based)
CREATE TABLE IF NOT EXISTS templates (
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
CREATE TABLE IF NOT EXISTS workflow_templates (
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

-- Template embeddings for semantic search (vector column will use pgvector extension)
CREATE TABLE IF NOT EXISTS template_embeddings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id INTEGER,
  template_type TEXT CHECK (template_type IN ('smart', 'standard', 'workflow')),
  content TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Workflow instances
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

-- Workflow executions
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

-- Documents table for document management system
CREATE TABLE IF NOT EXISTS documents (
  id SERIAL PRIMARY KEY,
  uuid UUID DEFAULT gen_random_uuid() UNIQUE,
  name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_size INTEGER,
  content_text TEXT,
  metadata JSONB DEFAULT '{}',
  template_id INTEGER REFERENCES smart_templates(id),
  processing_status TEXT NOT NULL DEFAULT 'uploaded'
    CHECK (processing_status IN ('uploaded', 'analyzing', 'processing', 'completed', 'failed')),
  uploaded_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_smart_templates_category ON smart_templates(category);
CREATE INDEX IF NOT EXISTS idx_smart_templates_created_by ON smart_templates(created_by);
CREATE INDEX IF NOT EXISTS idx_smart_templates_is_public ON smart_templates(is_public);
CREATE INDEX IF NOT EXISTS idx_smart_templates_usage_count ON smart_templates(usage_count DESC);
CREATE INDEX IF NOT EXISTS idx_smart_templates_regex_fallback ON smart_templates USING GIN (regex_fallback);

CREATE INDEX IF NOT EXISTS idx_templates_category ON templates(category);
CREATE INDEX IF NOT EXISTS idx_templates_created_by ON templates(created_by);
CREATE INDEX IF NOT EXISTS idx_templates_is_public ON templates(is_public);

CREATE INDEX IF NOT EXISTS idx_workflow_templates_category ON workflow_templates(category);
CREATE INDEX IF NOT EXISTS idx_workflow_templates_created_by ON workflow_templates(created_by);
CREATE INDEX IF NOT EXISTS idx_workflow_templates_is_public ON workflow_templates(is_public);

CREATE INDEX IF NOT EXISTS idx_documents_uploaded_by ON documents(uploaded_by);
CREATE INDEX IF NOT EXISTS idx_documents_processing_status ON documents(processing_status);
CREATE INDEX IF NOT EXISTS idx_documents_file_type ON documents(file_type);
CREATE INDEX IF NOT EXISTS idx_documents_created_at ON documents(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_documents_metadata ON documents USING GIN(metadata);
CREATE INDEX IF NOT EXISTS idx_documents_template_id ON documents(template_id);

-- Insert default categories
INSERT INTO template_categories (name, description, icon) VALUES
('general', 'General purpose templates', 'file-text'),
('business', 'Business and corporate templates', 'briefcase'),
('finance', 'Financial and accounting templates', 'dollar-sign'),
('hr', 'Human resources templates', 'users'),
('legal', 'Legal and contract templates', 'file-signature'),
('healthcare', 'Medical and healthcare templates', 'heart'),
('insurance', 'Insurance and claims templates', 'shield'),
('procurement', 'Purchasing and procurement templates', 'shopping-cart'),
('invoice', 'Invoice and billing templates', 'receipt'),
('contract', 'Contract and legal templates', 'file-signature'),
('report', 'Report and analysis templates', 'chart-bar'),
('letter', 'Letter and communication templates', 'mail'),
('form', 'Form and survey templates', 'clipboard-list'),
('other', 'Other miscellaneous templates', 'folder')
ON CONFLICT (name) DO NOTHING;

-- Update timestamps trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Add update triggers
DROP TRIGGER IF EXISTS update_smart_templates_updated_at ON smart_templates;
CREATE TRIGGER update_smart_templates_updated_at BEFORE UPDATE ON smart_templates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_templates_updated_at ON templates;
CREATE TRIGGER update_templates_updated_at BEFORE UPDATE ON templates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_workflow_templates_updated_at ON workflow_templates;
CREATE TRIGGER update_workflow_templates_updated_at BEFORE UPDATE ON workflow_templates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_workflow_instances_updated_at ON workflow_instances;
CREATE TRIGGER update_workflow_instances_updated_at BEFORE UPDATE ON workflow_instances
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_documents_updated_at ON documents;
CREATE TRIGGER update_documents_updated_at BEFORE UPDATE ON documents
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Seed common smart templates for FetchText platform
-- This provides users with ready-to-use templates for common document processing tasks

-- Business templates
INSERT INTO smart_templates (
  name,
  description,
  template_content,
  category,
  tags,
  is_public,
  smart_variables,
  extraction_rules
) VALUES
(
  'Business Card Scanner',
  'Extract contact information from business cards automatically',
  '# Contact Information

**Name:** {{name}}
**Title:** {{title}}
**Company:** {{company}}
**Email:** {{email}}
**Phone:** {{phone}}
**Address:** {{address}}',
  'business',
  ARRAY['contact', 'business-card', 'networking'],
  true,
  '[
    {"id": "name", "name": "Full Name", "type": "text", "description": "Person''s full name", "extraction_hints": ["name", "contact name", "person name"]},
    {"id": "title", "name": "Job Title", "type": "text", "description": "Professional title or position", "extraction_hints": ["title", "position", "role"]},
    {"id": "company", "name": "Company Name", "type": "text", "description": "Company or organization name", "extraction_hints": ["company", "organization", "business"]},
    {"id": "email", "name": "Email Address", "type": "text", "description": "Email contact", "extraction_hints": ["email", "e-mail", "@"]},
    {"id": "phone", "name": "Phone Number", "type": "text", "description": "Phone or mobile number", "extraction_hints": ["phone", "mobile", "tel", "call"]},
    {"id": "address", "name": "Address", "type": "text", "description": "Business address", "extraction_hints": ["address", "location", "street"]}
  ]'::jsonb,
  '[
    {"variable_id": "name", "ai_prompt": "Extract the person''s full name from this business card", "confidence_threshold": 0.8},
    {"variable_id": "email", "ai_prompt": "Find and extract the email address", "confidence_threshold": 0.9},
    {"variable_id": "phone", "ai_prompt": "Extract phone or mobile number", "confidence_threshold": 0.8}
  ]'::jsonb
),
(
  'Invoice Information Extractor',
  'Extract key financial data from invoices and bills',
  '# Invoice Summary

**Invoice Number:** {{invoice_number}}
**Date:** {{invoice_date}}
**Due Date:** {{due_date}}
**Vendor:** {{vendor_name}}
**Total Amount:** {{total_amount}}
**Tax Amount:** {{tax_amount}}

## Line Items
{{line_items}}',
  'finance',
  ARRAY['invoice', 'billing', 'accounting', 'finance'],
  true,
  '[
    {"id": "invoice_number", "name": "Invoice Number", "type": "text", "description": "Invoice or bill number", "extraction_hints": ["invoice #", "bill #", "number"]},
    {"id": "invoice_date", "name": "Invoice Date", "type": "date", "description": "Date of invoice", "extraction_hints": ["date", "invoice date", "billed date"]},
    {"id": "due_date", "name": "Due Date", "type": "date", "description": "Payment due date", "extraction_hints": ["due date", "payment due", "due"]},
    {"id": "vendor_name", "name": "Vendor Name", "type": "text", "description": "Company or vendor name", "extraction_hints": ["vendor", "from", "company", "supplier"]},
    {"id": "total_amount", "name": "Total Amount", "type": "currency", "description": "Total amount due", "extraction_hints": ["total", "amount due", "balance"]},
    {"id": "tax_amount", "name": "Tax Amount", "type": "currency", "description": "Tax amount", "extraction_hints": ["tax", "VAT", "sales tax"]},
    {"id": "line_items", "name": "Line Items", "type": "text", "description": "List of items or services", "extraction_hints": ["items", "services", "description"]}
  ]'::jsonb,
  '[
    {"variable_id": "total_amount", "ai_prompt": "Find the total amount or balance due on this invoice", "confidence_threshold": 0.9},
    {"variable_id": "invoice_number", "ai_prompt": "Extract the invoice number or reference number", "confidence_threshold": 0.8},
    {"variable_id": "vendor_name", "ai_prompt": "Identify the vendor or company name", "confidence_threshold": 0.8}
  ]'::jsonb
),
(
  'Resume/CV Parser',
  'Extract professional information from resumes and CVs',
  '# Professional Profile

**Name:** {{full_name}}
**Email:** {{email}}
**Phone:** {{phone}}
**Location:** {{location}}

## Experience
{{experience}}

## Education
{{education}}

## Skills
{{skills}}',
  'hr',
  ARRAY['resume', 'cv', 'hiring', 'recruitment'],
  true,
  '[
    {"id": "full_name", "name": "Full Name", "type": "text", "description": "Candidate''s full name", "extraction_hints": ["name", "candidate name"]},
    {"id": "email", "name": "Email", "type": "text", "description": "Email address", "extraction_hints": ["email", "contact"]},
    {"id": "phone", "name": "Phone", "type": "text", "description": "Phone number", "extraction_hints": ["phone", "mobile", "contact"]},
    {"id": "location", "name": "Location", "type": "text", "description": "City, state or address", "extraction_hints": ["location", "address", "city"]},
    {"id": "experience", "name": "Work Experience", "type": "text", "description": "Professional experience summary", "extraction_hints": ["experience", "work history", "employment"]},
    {"id": "education", "name": "Education", "type": "text", "description": "Educational background", "extraction_hints": ["education", "degree", "university", "school"]},
    {"id": "skills", "name": "Skills", "type": "text", "description": "Technical and professional skills", "extraction_hints": ["skills", "technologies", "competencies"]}
  ]'::jsonb,
  '[
    {"variable_id": "full_name", "ai_prompt": "Extract the candidate''s full name from this resume", "confidence_threshold": 0.9},
    {"variable_id": "email", "ai_prompt": "Find the email address", "confidence_threshold": 0.9},
    {"variable_id": "experience", "ai_prompt": "Summarize the work experience and job history", "confidence_threshold": 0.7}
  ]'::jsonb
),
(
  'Contract Key Terms Extractor',
  'Extract important terms and clauses from legal contracts',
  '# Contract Summary

**Contract Type:** {{contract_type}}
**Parties:** {{parties}}
**Effective Date:** {{effective_date}}
**Expiration Date:** {{expiration_date}}
**Contract Value:** {{contract_value}}

## Key Terms
{{key_terms}}

## Payment Terms
{{payment_terms}}',
  'legal',
  ARRAY['contract', 'legal', 'agreement', 'terms'],
  true,
  '[
    {"id": "contract_type", "name": "Contract Type", "type": "text", "description": "Type of contract or agreement", "extraction_hints": ["agreement", "contract type", "service agreement"]},
    {"id": "parties", "name": "Contract Parties", "type": "text", "description": "Names of contracting parties", "extraction_hints": ["parties", "between", "contracting parties"]},
    {"id": "effective_date", "name": "Effective Date", "type": "date", "description": "When contract becomes effective", "extraction_hints": ["effective date", "start date", "commencement"]},
    {"id": "expiration_date", "name": "Expiration Date", "type": "date", "description": "Contract end or expiration date", "extraction_hints": ["expiration", "end date", "termination date"]},
    {"id": "contract_value", "name": "Contract Value", "type": "currency", "description": "Total contract value", "extraction_hints": ["value", "amount", "total cost"]},
    {"id": "key_terms", "name": "Key Terms", "type": "text", "description": "Important contract terms", "extraction_hints": ["terms", "conditions", "clauses"]},
    {"id": "payment_terms", "name": "Payment Terms", "type": "text", "description": "Payment schedule and terms", "extraction_hints": ["payment", "billing", "payment terms"]}
  ]'::jsonb,
  '[
    {"variable_id": "parties", "ai_prompt": "Identify all parties involved in this contract", "confidence_threshold": 0.8},
    {"variable_id": "contract_value", "ai_prompt": "Find the total contract value or amount", "confidence_threshold": 0.8},
    {"variable_id": "key_terms", "ai_prompt": "Extract the most important terms and conditions", "confidence_threshold": 0.7}
  ]'::jsonb
),
(
  'Receipt Scanner',
  'Extract purchase information from receipts',
  '# Receipt Details

**Store:** {{store_name}}
**Date:** {{purchase_date}}
**Total:** {{total_amount}}
**Tax:** {{tax_amount}}
**Payment Method:** {{payment_method}}

## Items
{{items}}',
  'finance',
  ARRAY['receipt', 'expense', 'purchase', 'accounting'],
  true,
  '[
    {"id": "store_name", "name": "Store Name", "type": "text", "description": "Name of store or merchant", "extraction_hints": ["store", "merchant", "retailer"]},
    {"id": "purchase_date", "name": "Purchase Date", "type": "date", "description": "Date of purchase", "extraction_hints": ["date", "purchase date", "transaction date"]},
    {"id": "total_amount", "name": "Total Amount", "type": "currency", "description": "Total purchase amount", "extraction_hints": ["total", "amount", "subtotal"]},
    {"id": "tax_amount", "name": "Tax Amount", "type": "currency", "description": "Tax amount", "extraction_hints": ["tax", "sales tax", "VAT"]},
    {"id": "payment_method", "name": "Payment Method", "type": "text", "description": "How payment was made", "extraction_hints": ["payment", "card", "cash", "credit"]},
    {"id": "items", "name": "Items Purchased", "type": "text", "description": "List of items bought", "extraction_hints": ["items", "products", "purchases"]}
  ]'::jsonb,
  '[
    {"variable_id": "total_amount", "ai_prompt": "Find the total amount spent", "confidence_threshold": 0.9},
    {"variable_id": "store_name", "ai_prompt": "Identify the store or merchant name", "confidence_threshold": 0.8},
    {"variable_id": "items", "ai_prompt": "List all items purchased", "confidence_threshold": 0.7}
  ]'::jsonb
),
(
  'Medical Report Summarizer',
  'Extract key information from medical reports and lab results',
  '# Medical Report Summary

**Patient:** {{patient_name}}
**Date:** {{report_date}}
**Doctor:** {{doctor_name}}
**Test Type:** {{test_type}}

## Key Findings
{{findings}}

## Recommendations
{{recommendations}}',
  'healthcare',
  ARRAY['medical', 'health', 'lab-results', 'patient'],
  true,
  '[
    {"id": "patient_name", "name": "Patient Name", "type": "text", "description": "Patient''s name", "extraction_hints": ["patient", "name", "patient name"]},
    {"id": "report_date", "name": "Report Date", "type": "date", "description": "Date of report or test", "extraction_hints": ["date", "report date", "test date"]},
    {"id": "doctor_name", "name": "Doctor Name", "type": "text", "description": "Attending physician", "extraction_hints": ["doctor", "physician", "MD", "Dr."]},
    {"id": "test_type", "name": "Test Type", "type": "text", "description": "Type of medical test", "extraction_hints": ["test", "exam", "procedure"]},
    {"id": "findings", "name": "Key Findings", "type": "text", "description": "Important medical findings", "extraction_hints": ["findings", "results", "diagnosis"]},
    {"id": "recommendations", "name": "Recommendations", "type": "text", "description": "Doctor''s recommendations", "extraction_hints": ["recommendations", "treatment", "follow-up"]}
  ]'::jsonb,
  '[
    {"variable_id": "findings", "ai_prompt": "Summarize the key medical findings from this report", "confidence_threshold": 0.8},
    {"variable_id": "recommendations", "ai_prompt": "Extract treatment recommendations", "confidence_threshold": 0.7},
    {"variable_id": "test_type", "ai_prompt": "Identify the type of medical test or examination", "confidence_threshold": 0.8}
  ]'::jsonb
),
(
  'Insurance Claim Form',
  'Process insurance claims and extract relevant details',
  '# Insurance Claim

**Claim Number:** {{claim_number}}
**Policy Number:** {{policy_number}}
**Claimant:** {{claimant_name}}
**Incident Date:** {{incident_date}}
**Claim Amount:** {{claim_amount}}

## Incident Description
{{incident_description}}',
  'insurance',
  ARRAY['insurance', 'claim', 'policy', 'coverage'],
  true,
  '[
    {"id": "claim_number", "name": "Claim Number", "type": "text", "description": "Insurance claim number", "extraction_hints": ["claim number", "claim #", "reference"]},
    {"id": "policy_number", "name": "Policy Number", "type": "text", "description": "Insurance policy number", "extraction_hints": ["policy", "policy number", "policy #"]},
    {"id": "claimant_name", "name": "Claimant Name", "type": "text", "description": "Name of person filing claim", "extraction_hints": ["claimant", "insured", "policyholder"]},
    {"id": "incident_date", "name": "Incident Date", "type": "date", "description": "Date of incident", "extraction_hints": ["incident date", "date of loss", "occurrence date"]},
    {"id": "claim_amount", "name": "Claim Amount", "type": "currency", "description": "Amount being claimed", "extraction_hints": ["amount", "claim amount", "damages"]},
    {"id": "incident_description", "name": "Incident Description", "type": "text", "description": "Description of what happened", "extraction_hints": ["description", "incident", "what happened"]}
  ]'::jsonb,
  '[
    {"variable_id": "claim_amount", "ai_prompt": "Find the total claim amount being requested", "confidence_threshold": 0.9},
    {"variable_id": "incident_description", "ai_prompt": "Summarize the incident description", "confidence_threshold": 0.7},
    {"variable_id": "policy_number", "ai_prompt": "Extract the insurance policy number", "confidence_threshold": 0.8}
  ]'::jsonb
),
(
  'Bank Statement Analyzer',
  'Extract transaction data from bank statements',
  '# Bank Statement Summary

**Account:** {{account_number}}
**Statement Period:** {{statement_period}}
**Opening Balance:** {{opening_balance}}
**Closing Balance:** {{closing_balance}}
**Total Deposits:** {{total_deposits}}
**Total Withdrawals:** {{total_withdrawals}}',
  'finance',
  ARRAY['banking', 'statement', 'transactions', 'finance'],
  true,
  '[
    {"id": "account_number", "name": "Account Number", "type": "text", "description": "Bank account number", "extraction_hints": ["account", "account number", "account #"]},
    {"id": "statement_period", "name": "Statement Period", "type": "text", "description": "Date range of statement", "extraction_hints": ["period", "statement period", "from", "to"]},
    {"id": "opening_balance", "name": "Opening Balance", "type": "currency", "description": "Starting balance", "extraction_hints": ["opening balance", "starting balance", "previous balance"]},
    {"id": "closing_balance", "name": "Closing Balance", "type": "currency", "description": "Ending balance", "extraction_hints": ["closing balance", "ending balance", "current balance"]},
    {"id": "total_deposits", "name": "Total Deposits", "type": "currency", "description": "Sum of all deposits", "extraction_hints": ["deposits", "credits", "total deposits"]},
    {"id": "total_withdrawals", "name": "Total Withdrawals", "type": "currency", "description": "Sum of all withdrawals", "extraction_hints": ["withdrawals", "debits", "total withdrawals"]}
  ]'::jsonb,
  '[
    {"variable_id": "closing_balance", "ai_prompt": "Find the closing or ending balance", "confidence_threshold": 0.9},
    {"variable_id": "opening_balance", "ai_prompt": "Find the opening or starting balance", "confidence_threshold": 0.9},
    {"variable_id": "account_number", "ai_prompt": "Extract the bank account number", "confidence_threshold": 0.8}
  ]'::jsonb
)
ON CONFLICT (name) DO NOTHING;

-- Update usage stats for better visibility
UPDATE smart_templates SET usage_count = floor(random() * 50) + 10 WHERE usage_count = 0;
UPDATE smart_templates SET rating = round((random() * 2 + 3)::numeric, 1) WHERE rating = 0.0;

-- Enable Row Level Security (RLS) for all user data tables
ALTER TABLE smart_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE template_embeddings ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_instances ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

-- Smart Templates RLS Policies
DROP POLICY IF EXISTS "smart_templates_select_policy" ON smart_templates;
CREATE POLICY "smart_templates_select_policy" ON smart_templates
    FOR SELECT USING (
        is_public = true OR
        created_by = auth.uid()
    );

DROP POLICY IF EXISTS "smart_templates_insert_policy" ON smart_templates;
CREATE POLICY "smart_templates_insert_policy" ON smart_templates
    FOR INSERT WITH CHECK (
        created_by = auth.uid()
    );

DROP POLICY IF EXISTS "smart_templates_update_policy" ON smart_templates;
CREATE POLICY "smart_templates_update_policy" ON smart_templates
    FOR UPDATE USING (
        created_by = auth.uid()
    ) WITH CHECK (
        created_by = auth.uid()
    );

DROP POLICY IF EXISTS "smart_templates_delete_policy" ON smart_templates;
CREATE POLICY "smart_templates_delete_policy" ON smart_templates
    FOR DELETE USING (
        created_by = auth.uid()
    );

-- Standard Templates RLS Policies
DROP POLICY IF EXISTS "templates_select_policy" ON templates;
CREATE POLICY "templates_select_policy" ON templates
    FOR SELECT USING (
        is_public = true OR
        created_by = auth.uid()
    );

DROP POLICY IF EXISTS "templates_insert_policy" ON templates;
CREATE POLICY "templates_insert_policy" ON templates
    FOR INSERT WITH CHECK (
        created_by = auth.uid()
    );

DROP POLICY IF EXISTS "templates_update_policy" ON templates;
CREATE POLICY "templates_update_policy" ON templates
    FOR UPDATE USING (
        created_by = auth.uid()
    ) WITH CHECK (
        created_by = auth.uid()
    );

DROP POLICY IF EXISTS "templates_delete_policy" ON templates;
CREATE POLICY "templates_delete_policy" ON templates
    FOR DELETE USING (
        created_by = auth.uid()
    );

-- Workflow Templates RLS Policies
DROP POLICY IF EXISTS "workflow_templates_select_policy" ON workflow_templates;
CREATE POLICY "workflow_templates_select_policy" ON workflow_templates
    FOR SELECT USING (
        is_public = true OR
        created_by = auth.uid()
    );

DROP POLICY IF EXISTS "workflow_templates_insert_policy" ON workflow_templates;
CREATE POLICY "workflow_templates_insert_policy" ON workflow_templates
    FOR INSERT WITH CHECK (
        created_by = auth.uid()
    );

DROP POLICY IF EXISTS "workflow_templates_update_policy" ON workflow_templates;
CREATE POLICY "workflow_templates_update_policy" ON workflow_templates
    FOR UPDATE USING (
        created_by = auth.uid()
    ) WITH CHECK (
        created_by = auth.uid()
    );

DROP POLICY IF EXISTS "workflow_templates_delete_policy" ON workflow_templates;
CREATE POLICY "workflow_templates_delete_policy" ON workflow_templates
    FOR DELETE USING (
        created_by = auth.uid()
    );

-- Template Embeddings RLS Policies
DROP POLICY IF EXISTS "template_embeddings_select_policy" ON template_embeddings;
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

DROP POLICY IF EXISTS "template_embeddings_insert_policy" ON template_embeddings;
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

-- Workflow Instances RLS Policies
DROP POLICY IF EXISTS "workflow_instances_select_policy" ON workflow_instances;
CREATE POLICY "workflow_instances_select_policy" ON workflow_instances
    FOR SELECT USING (
        created_by = auth.uid()
    );

DROP POLICY IF EXISTS "workflow_instances_insert_policy" ON workflow_instances;
CREATE POLICY "workflow_instances_insert_policy" ON workflow_instances
    FOR INSERT WITH CHECK (
        created_by = auth.uid()
    );

DROP POLICY IF EXISTS "workflow_instances_update_policy" ON workflow_instances;
CREATE POLICY "workflow_instances_update_policy" ON workflow_instances
    FOR UPDATE USING (
        created_by = auth.uid()
    ) WITH CHECK (
        created_by = auth.uid()
    );

DROP POLICY IF EXISTS "workflow_instances_delete_policy" ON workflow_instances;
CREATE POLICY "workflow_instances_delete_policy" ON workflow_instances
    FOR DELETE USING (
        created_by = auth.uid()
    );

-- Workflow Executions RLS Policies
DROP POLICY IF EXISTS "workflow_executions_select_policy" ON workflow_executions;
CREATE POLICY "workflow_executions_select_policy" ON workflow_executions
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM workflow_instances wi
            WHERE wi.id = workflow_executions.workflow_instance_id
            AND wi.created_by = auth.uid()
        )
    );

DROP POLICY IF EXISTS "workflow_executions_insert_policy" ON workflow_executions;
CREATE POLICY "workflow_executions_insert_policy" ON workflow_executions
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM workflow_instances wi
            WHERE wi.id = workflow_executions.workflow_instance_id
            AND wi.created_by = auth.uid()
        )
    );

-- Documents RLS Policies
DROP POLICY IF EXISTS "documents_select_policy" ON documents;
CREATE POLICY "documents_select_policy" ON documents
    FOR SELECT USING (
        uploaded_by = auth.uid()
    );

DROP POLICY IF EXISTS "documents_insert_policy" ON documents;
CREATE POLICY "documents_insert_policy" ON documents
    FOR INSERT WITH CHECK (
        uploaded_by = auth.uid()
    );

DROP POLICY IF EXISTS "documents_update_policy" ON documents;
CREATE POLICY "documents_update_policy" ON documents
    FOR UPDATE USING (
        uploaded_by = auth.uid()
    ) WITH CHECK (
        uploaded_by = auth.uid()
    );

DROP POLICY IF EXISTS "documents_delete_policy" ON documents;
CREATE POLICY "documents_delete_policy" ON documents
    FOR DELETE USING (
        uploaded_by = auth.uid()
    );

-- NOTE: Storage bucket must be created manually in Supabase Dashboard
-- Navigate to: Storage > Create a new bucket
-- Bucket name: documents
-- Public bucket: OFF (private)
-- File size limit: 50MB (52428800 bytes)
-- Allowed MIME types: PDF, images (png, jpg, jpeg, gif, webp), text, Word docs, Excel sheets

-- Add helpful comments
COMMENT ON TABLE smart_templates IS 'Unified template system for AI-powered document processing with regex fallback. Supports extraction and generation.';
COMMENT ON COLUMN smart_templates.smart_variables IS 'AI-powered extraction variables with semantic descriptions and optional regex fallback patterns';
COMMENT ON COLUMN smart_templates.generation_settings IS 'Configuration for document generation including workflow integration for automated document creation';
COMMENT ON COLUMN smart_templates.regex_fallback IS 'Regex patterns for fallback extraction when AI extraction fails or has low confidence. Format: {"field_name": "regex_pattern"}';
COMMENT ON TABLE documents IS 'Stores uploaded documents and their processing metadata';
COMMENT ON COLUMN documents.processing_status IS 'Current processing stage: uploaded, analyzing, processing, completed, failed';
COMMENT ON COLUMN documents.metadata IS 'JSON metadata including document classification and extraction results';

-- Log completion
DO $$
BEGIN
  RAISE NOTICE 'FetchText database migration completed successfully!';
  RAISE NOTICE 'Created tables: smart_templates, templates, workflow_templates, documents, template_embeddings, workflow_instances, workflow_executions, template_categories';
  RAISE NOTICE 'Seeded 8 smart templates for common document types';
  RAISE NOTICE 'Enabled Row Level Security (RLS) on all user data tables';
  RAISE NOTICE 'IMPORTANT: Create storage bucket manually in Supabase Dashboard (Storage > Create bucket > name: documents)';
END $$;
