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
