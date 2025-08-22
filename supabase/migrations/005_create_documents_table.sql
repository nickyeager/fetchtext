-- Create documents table for document management system
-- This table stores uploaded documents and their processing status

-- Create documents table
CREATE TABLE IF NOT EXISTS documents (
  id SERIAL PRIMARY KEY,
  uuid UUID DEFAULT gen_random_uuid() UNIQUE,
  name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_size INTEGER,
  content_text TEXT,
  metadata JSONB DEFAULT '{}',
  processing_status TEXT NOT NULL DEFAULT 'uploaded' 
    CHECK (processing_status IN ('uploaded', 'analyzing', 'processing', 'completed', 'failed')),
  uploaded_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_documents_uploaded_by ON documents(uploaded_by);
CREATE INDEX IF NOT EXISTS idx_documents_processing_status ON documents(processing_status);
CREATE INDEX IF NOT EXISTS idx_documents_file_type ON documents(file_type);
CREATE INDEX IF NOT EXISTS idx_documents_created_at ON documents(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_documents_metadata ON documents USING GIN(metadata);

-- Create update timestamp function if it doesn't exist
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Add update trigger
DROP TRIGGER IF EXISTS update_documents_updated_at ON documents;
CREATE TRIGGER update_documents_updated_at BEFORE UPDATE ON documents
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

-- Documents RLS Policies
-- Users can read their own documents
DROP POLICY IF EXISTS "documents_select_policy" ON documents;
CREATE POLICY "documents_select_policy" ON documents
    FOR SELECT TO authenticated USING (
        uploaded_by = auth.uid()
    );

-- Users can insert their own documents
DROP POLICY IF EXISTS "documents_insert_policy" ON documents;
CREATE POLICY "documents_insert_policy" ON documents
    FOR INSERT TO authenticated WITH CHECK (
        uploaded_by = auth.uid()
    );

-- Users can update their own documents
DROP POLICY IF EXISTS "documents_update_policy" ON documents;
CREATE POLICY "documents_update_policy" ON documents
    FOR UPDATE TO authenticated USING (
        uploaded_by = auth.uid()
    ) WITH CHECK (
        uploaded_by = auth.uid()
    );

-- Users can delete their own documents
DROP POLICY IF EXISTS "documents_delete_policy" ON documents;
CREATE POLICY "documents_delete_policy" ON documents
    FOR DELETE TO authenticated USING (
        uploaded_by = auth.uid()
    );

-- Grant necessary permissions
GRANT ALL ON documents TO authenticated;
GRANT USAGE ON SEQUENCE documents_id_seq TO authenticated;

-- Insert sample documents for testing (only if table is empty)
INSERT INTO documents (name, file_path, file_type, file_size, content_text, metadata, processing_status, uploaded_by)
SELECT 
  'Sample_Document.pdf',
  '/documents/uploads/sample_document.pdf',
  'application/pdf',
  123456,
  'This is a sample document for testing purposes.',
  '{"document_type": "general", "classification": {"primary_category": "general", "confidence": 0.95}}',
  'completed',
  (SELECT id FROM auth.users LIMIT 1)
WHERE NOT EXISTS (SELECT 1 FROM documents LIMIT 1)
  AND EXISTS (SELECT 1 FROM auth.users LIMIT 1);

-- Comments for documentation
COMMENT ON TABLE documents IS 'Stores uploaded documents and their processing metadata';
COMMENT ON COLUMN documents.processing_status IS 'Current processing stage: uploaded, analyzing, processing, completed, failed';
COMMENT ON COLUMN documents.metadata IS 'JSON metadata including document classification and extraction results';
COMMENT ON COLUMN documents.uploaded_by IS 'Reference to the user who uploaded this document';

COMMENT ON POLICY "documents_select_policy" ON documents IS 'Users can only read documents they uploaded';
COMMENT ON POLICY "documents_insert_policy" ON documents IS 'Users can only create documents with themselves as uploader';
COMMENT ON POLICY "documents_update_policy" ON documents IS 'Users can only update documents they uploaded';
COMMENT ON POLICY "documents_delete_policy" ON documents IS 'Users can only delete documents they uploaded';