/**
 * Billing Service
 *
 * Handles Stripe checkout, subscription management, and billing status
 */

const DOCUMENT_PROCESSOR_URL =
  import.meta.env.VITE_DOCUMENT_PROCESSOR_URL || 'http://localhost:8090';

export type BillingTier = 'free' | 'non_managed' | 'professional' | 'enterprise';
export type AIModel = 'gpt-4o' | 'gpt-4o-mini';

export interface BillingConfig {
  stripe_configured: boolean;
  publishable_key: string | null;
  prices: {
    non_managed: string | null;
    professional: string | null;
    enterprise: string | null;
  };
}

export interface CheckoutSessionResponse {
  checkout_url: string;
  session_id: string;
}

export interface SubscriptionStatus {
  organization_id: string;
  tier: BillingTier;
  status: 'active' | 'trialing' | 'past_due' | 'canceled' | 'none';
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
}

export interface CustomerPortalResponse {
  portal_url: string;
}

/**
 * Get billing configuration (publishable key, available prices)
 */
export async function getBillingConfig(): Promise<BillingConfig> {
  const response = await fetch(`${DOCUMENT_PROCESSOR_URL}/billing/config`);
  if (!response.ok) {
    throw new Error(`Failed to get billing config: ${response.statusText}`);
  }
  return response.json();
}

/**
 * Create a Stripe checkout session for subscription upgrade
 */
export async function createCheckoutSession(params: {
  organizationId: string;
  tier: BillingTier;
  selectedModel?: AIModel;
  successUrl?: string;
  cancelUrl?: string;
}): Promise<CheckoutSessionResponse> {
  const response = await fetch(`${DOCUMENT_PROCESSOR_URL}/billing/checkout`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      organization_id: params.organizationId,
      tier: params.tier,
      selected_model: params.selectedModel || 'gpt-4o-mini',
      success_url: params.successUrl,
      cancel_url: params.cancelUrl,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: response.statusText }));
    throw new Error(error.detail || 'Failed to create checkout session');
  }

  return response.json();
}

/**
 * Get current subscription status for an organization
 */
export async function getSubscriptionStatus(
  organizationId: string
): Promise<SubscriptionStatus> {
  const response = await fetch(
    `${DOCUMENT_PROCESSOR_URL}/billing/subscription/${organizationId}`
  );

  if (!response.ok) {
    throw new Error(`Failed to get subscription status: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Create a customer portal session for managing subscription
 */
export async function createCustomerPortal(params: {
  organizationId: string;
  returnUrl?: string;
}): Promise<CustomerPortalResponse> {
  const response = await fetch(`${DOCUMENT_PROCESSOR_URL}/billing/portal`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      organization_id: params.organizationId,
      return_url: params.returnUrl,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: response.statusText }));
    throw new Error(error.detail || 'Failed to create portal session');
  }

  return response.json();
}

/**
 * Cancel subscription at period end
 */
export async function cancelSubscription(
  organizationId: string
): Promise<{ message: string; cancel_at: number }> {
  const response = await fetch(
    `${DOCUMENT_PROCESSOR_URL}/billing/cancel/${organizationId}`,
    {
      method: 'POST',
    }
  );

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: response.statusText }));
    throw new Error(error.detail || 'Failed to cancel subscription');
  }

  return response.json();
}

/**
 * Tier display information
 */
export const TIER_INFO: Record<
  BillingTier,
  {
    name: string;
    description: string;
    price: string;
    features: string[];
    highlighted?: boolean;
  }
> = {
  free: {
    name: 'Free',
    description: 'Get started with basic document processing',
    price: '$0',
    features: [
      'Template-based document creation',
      'Basic document upload',
      'Community support',
    ],
  },
  non_managed: {
    name: 'Starter',
    description: 'AI-powered extraction with usage limits',
    price: '$29/mo',
    features: [
      'AI-powered field extraction',
      '100 documents/month',
      'Shared infrastructure',
      'Email support',
    ],
  },
  professional: {
    name: 'Professional',
    description: 'Bring your own API key for unlimited usage',
    price: '$99/mo',
    highlighted: true,
    features: [
      'Unlimited documents',
      'Use your own API key',
      'Priority processing',
      'SOC 2 ready',
      'Priority support',
    ],
  },
  enterprise: {
    name: 'Enterprise',
    description: 'Dedicated infrastructure with full compliance',
    price: '$499/mo',
    features: [
      'Dedicated Azure OpenAI instance',
      'HIPAA/FedRAMP ready',
      'Custom model selection',
      'SLA guarantee',
      'Dedicated support',
      'Custom integrations',
    ],
  },
};
