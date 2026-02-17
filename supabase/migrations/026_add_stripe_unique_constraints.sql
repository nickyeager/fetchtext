-- Migration: Add unique constraints to Stripe columns
-- Prevents multiple organizations from sharing the same Stripe customer/subscription ID
-- which could cause webhook processing to update the wrong organization.

CREATE UNIQUE INDEX IF NOT EXISTS organizations_stripe_customer_id_key
ON organizations(stripe_customer_id) WHERE stripe_customer_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS organizations_stripe_subscription_id_key
ON organizations(stripe_subscription_id) WHERE stripe_subscription_id IS NOT NULL;

-- Verify indexes
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'organizations'
AND indexname LIKE '%stripe%';
