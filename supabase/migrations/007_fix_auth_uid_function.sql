-- Fix auth.uid() function to manually parse JWT claims
-- This addresses PostgREST not setting individual claim variables (request.jwt.claim.sub)

CREATE OR REPLACE FUNCTION auth.uid()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT 
    CASE 
      WHEN current_setting('request.jwt.claims', true) IS NULL OR current_setting('request.jwt.claims', true) = '' 
      THEN NULL
      ELSE (current_setting('request.jwt.claims', true)::jsonb->>'sub')::uuid
    END;
$$;

-- Ensure the function has proper permissions
GRANT EXECUTE ON FUNCTION auth.uid() TO anon, authenticated, service_role;

-- Add comment explaining the fix
COMMENT ON FUNCTION auth.uid() IS 'Fixed version that manually parses JWT claims instead of relying on PostgREST claim variables';