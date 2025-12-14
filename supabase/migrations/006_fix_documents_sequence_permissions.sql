-- Fix permissions for documents sequence
-- The authenticated role needs permission to use the sequence for ID generation

-- Grant usage permission on the documents_id_seq sequence to authenticated role
GRANT USAGE ON SEQUENCE documents_id_seq TO authenticated;

-- Also ensure authenticated role has proper permissions on the documents table
GRANT ALL ON documents TO authenticated;

-- Verify the sequence exists and is owned by the right column
-- This ensures the sequence is properly associated with the id column
ALTER SEQUENCE documents_id_seq OWNED BY documents.id;

-- Additional safety: Grant permissions to anon role as well (for public operations if needed)
GRANT USAGE ON SEQUENCE documents_id_seq TO anon;

-- Log the fix
DO $$
BEGIN
  RAISE NOTICE 'Fixed permissions for documents_id_seq - authenticated and anon roles can now use the sequence';
END $$;