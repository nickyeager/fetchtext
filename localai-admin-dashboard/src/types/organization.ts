/**
 * Organization Types
 *
 * Types for multi-organization support in FetchText
 */

export type OrganizationRole = 'owner' | 'admin' | 'member';
export type OrganizationType = 'personal' | 'team';
export type InvitationStatus = 'pending' | 'accepted' | 'rejected' | 'expired';

export interface Organization {
  id: string;
  name: string;
  slug: string;
  description?: string;
  logo_url?: string;
  organization_type: OrganizationType;
  owner_id: string;
  settings: OrganizationSettings;
  created_at: string;
  updated_at: string;
}

export interface OrganizationSettings {
  allow_public_templates?: boolean;
  default_template_visibility?: 'private' | 'organization';
  max_members?: number;
}

export interface OrganizationMember {
  id: string;
  organization_id: string;
  user_id: string;
  role: OrganizationRole;
  invited_by?: string;
  created_at: string;
  updated_at: string;
  // Joined user data
  user?: {
    id: string;
    email: string;
    user_metadata?: {
      full_name?: string;
      avatar_url?: string;
    };
  };
}

export interface OrganizationInvitation {
  id: string;
  organization_id: string;
  email: string;
  role: OrganizationRole;
  token: string;
  invited_by: string;
  status: InvitationStatus;
  expires_at: string;
  created_at: string;
  // Joined data
  organization?: Organization;
  inviter?: {
    id: string;
    email: string;
  };
}

export interface OrganizationWithRole extends Organization {
  role: OrganizationRole;
  member_count?: number;
}

export interface CreateOrganizationInput {
  name: string;
  description?: string;
  logo_url?: string;
}

export interface UpdateOrganizationInput {
  name?: string;
  description?: string;
  logo_url?: string;
  settings?: Partial<OrganizationSettings>;
}

export interface InviteMemberInput {
  email: string;
  role: OrganizationRole;
}

export interface UpdateMemberRoleInput {
  user_id: string;
  role: OrganizationRole;
}

// Helper type for team switcher UI
export interface OrganizationDisplayItem {
  id: string;
  name: string;
  slug: string;
  organization_type: OrganizationType;
  role: OrganizationRole;
  logo_url?: string;
}

// =============================================================================
// Organization LLM Configuration Types
// =============================================================================

/**
 * LLM pricing/feature tiers
 */
export type LLMTier = 'free' | 'non_managed' | 'professional' | 'enterprise';

/**
 * How the LLM is accessed
 */
export type LLMProviderType =
  | 'none'          // No LLM (free tier)
  | 'shared'        // FetchText's shared Azure OpenAI
  | 'byok_azure'    // Customer's Azure OpenAI key
  | 'byok_openai'   // Customer's OpenAI key
  | 'self_hosted';  // Customer's endpoint (Ollama, vLLM)

/**
 * Enterprise deployment models
 */
export type DeploymentModel = 'managed_ours' | 'lighthouse' | 'marketplace';

/**
 * Organization LLM configuration
 */
export interface OrganizationLLMConfig {
  organization_id: string;
  tier: LLMTier;
  provider_type: LLMProviderType;
  deployment_model?: DeploymentModel;
  custom_endpoint?: string;
  daily_document_limit?: number;
  monthly_document_limit?: number;
  documents_processed_today: number;
  documents_processed_month: number;
  provisioning_status: string;
  source: 'system_default' | 'organization';
}

/**
 * Effective LLM configuration (resolved from org config or system default)
 */
export interface EffectiveLLMConfig {
  source: 'system_default' | 'organization';
  provider: string;
  tier: LLMTier;
  organization_id?: string;
  has_usage_limits: boolean;
  is_within_limits: boolean;
  daily_limit?: number;
  monthly_limit?: number;
  documents_today: number;
  documents_month: number;
}

/**
 * Request to create/update org LLM config
 */
export interface UpdateOrganizationLLMConfigInput {
  tier: LLMTier;
  provider_type: LLMProviderType;
  deployment_model?: DeploymentModel;
  custom_endpoint?: string;
  daily_document_limit?: number;
  monthly_document_limit?: number;
}

/**
 * LLM tier display information
 */
export interface LLMTierInfo {
  tier: LLMTier;
  name: string;
  description: string;
  features: string[];
  hasAI: boolean;
  hasUsageLimits: boolean;
}

/**
 * Available LLM tiers with their details
 */
export const LLM_TIERS: Record<LLMTier, LLMTierInfo> = {
  free: {
    tier: 'free',
    name: 'Free',
    description: 'Template-only document generation, no AI extraction',
    features: ['Template-based document creation', 'No AI extraction'],
    hasAI: false,
    hasUsageLimits: false,
  },
  non_managed: {
    tier: 'non_managed',
    name: 'Non-Managed',
    description: 'Shared AI with usage limits',
    features: ['AI-powered extraction', 'Usage limits apply', 'Shared infrastructure'],
    hasAI: true,
    hasUsageLimits: true,
  },
  professional: {
    tier: 'professional',
    name: 'Professional',
    description: 'Bring your own API key',
    features: ['Your own API key', 'Unlimited usage', 'SOC 2 ready'],
    hasAI: true,
    hasUsageLimits: false,
  },
  enterprise: {
    tier: 'enterprise',
    name: 'Enterprise',
    description: 'Dedicated infrastructure',
    features: ['Dedicated instance', 'HIPAA/FedRAMP ready', 'Custom deployment'],
    hasAI: true,
    hasUsageLimits: false,
  },
};
