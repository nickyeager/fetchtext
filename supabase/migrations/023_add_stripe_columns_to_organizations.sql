-- Migration: Add Stripe subscription columns to organizations table
-- Required for Stripe subscription webhook handling
-- Apply to production Supabase: https://app.supabase.com/project/your-project-id/sql/new

-- Add columns for Stripe subscription tracking
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS tier text DEFAULT 'free';
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS stripe_customer_id text;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS stripe_subscription_id text;

-- Notify PostgREST to reload schema cache
NOTIFY pgrst, 'reload schema';

-- Verify columns were added
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'organizations'
AND column_name IN ('tier', 'stripe_customer_id', 'stripe_subscription_id');
