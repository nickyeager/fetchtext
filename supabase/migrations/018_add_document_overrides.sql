-- Migration: Add document override columns
-- Purpose: Store document-level field overrides without modifying global templates

-- Add override columns to documents table
ALTER TABLE documents ADD COLUMN IF NOT EXISTS field_overrides JSONB DEFAULT NULL;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS template_content_override TEXT DEFAULT NULL;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS overrides_modified_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS overrides_modified_by UUID REFERENCES auth.users(id) DEFAULT NULL;

-- Create index for faster override queries
CREATE INDEX IF NOT EXISTS idx_documents_has_overrides
ON documents ((field_overrides IS NOT NULL OR template_content_override IS NOT NULL));

-- Add comments for documentation
COMMENT ON COLUMN documents.field_overrides IS 'JSON object storing per-field value overrides with metadata (original_value, modified_by, modified_at, reason)';
COMMENT ON COLUMN documents.template_content_override IS 'Custom template content for this document only (overrides the template)';
COMMENT ON COLUMN documents.overrides_modified_at IS 'Timestamp of last override modification';
COMMENT ON COLUMN documents.overrides_modified_by IS 'User who last modified overrides';

-- Example field_overrides structure:
-- {
--   "invoice_amount": {
--     "value": "$1,750.00",
--     "original_value": "$1,500.00",
--     "original_confidence": 0.95,
--     "override_reason": "manual_edit",
--     "modified_at": "2024-01-15T10:30:00Z",
--     "modified_by": "user-uuid",
--     "modified_by_name": "John Doe"
--   }
-- }
