-- Create documents storage bucket if it doesn't exist
-- This bucket stores uploaded documents for processing

-- Create the documents storage bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'documents',
  'documents',
  false, -- Private bucket (authenticated access only)
  52428800, -- 50MB file size limit
  ARRAY[
    'application/pdf',
    'image/png',
    'image/jpeg',
    'image/jpg',
    'image/gif',
    'image/webp',
    'text/plain',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ]
)
ON CONFLICT (id) DO NOTHING;

-- Verify bucket was created
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'documents') THEN
    RAISE EXCEPTION 'Failed to create documents storage bucket';
  END IF;
  RAISE NOTICE 'Documents storage bucket created successfully';
END
$$;

-- Comment for documentation
COMMENT ON TABLE storage.buckets IS 'Storage buckets for file uploads';
