/**
 * Organization Service
 *
 * Service for managing organizations, members, and invitations
 */

import { supabase } from '@/lib/supabase';
import { withAuthentication } from '@/lib/supabase-auth-utils';
import { sendInvitationEmail } from '@/lib/email-service';
import type {
  Organization,
  OrganizationMember,
  OrganizationInvitation,
  OrganizationWithRole,
  CreateOrganizationInput,
  UpdateOrganizationInput,
  InviteMemberInput,
  OrganizationRole,
} from '@/types/organization';

export class OrganizationService {
  /**
   * Get all organizations the current user is a member of
   */
  static async getUserOrganizations(): Promise<OrganizationWithRole[]> {
    return withAuthentication(async (user) => {
      const { data, error } = await supabase
        .from('organization_members')
        .select(`
          role,
          organization:organizations(*)
        `)
        .eq('user_id', user.id);

      if (error) {
        console.error('Error fetching user organizations:', error);
        throw error;
      }

      if (!data) return [];

      // Transform the data to include role with organization
      return data.map((item) => ({
        ...(item.organization as Organization),
        role: item.role as OrganizationRole,
      }));
    }, 'getUserOrganizations');
  }

  /**
   * Get a single organization by ID
   */
  static async getOrganization(id: string): Promise<Organization | null> {
    return withAuthentication(async () => {
      const { data, error } = await supabase
        .from('organizations')
        .select('*')
        .eq('id', id)
        .single();

      if (error) {
        if (error.code === 'PGRST116') return null; // Not found
        console.error('Error fetching organization:', error);
        throw error;
      }

      return data;
    }, 'getOrganization');
  }

  /**
   * Create a new organization
   */
  static async createOrganization(
    input: CreateOrganizationInput
  ): Promise<Organization> {
    return withAuthentication(async (user) => {
      // Generate slug from name
      const slug = input.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');

      const { data, error } = await supabase
        .from('organizations')
        .insert({
          name: input.name,
          slug,
          description: input.description,
          logo_url: input.logo_url,
          organization_type: 'team',
          owner_id: user.id,
          settings: {},
        })
        .select()
        .single();

      if (error) {
        console.error('Error creating organization:', error);
        throw error;
      }

      // The database trigger should automatically create the owner membership,
      // but we'll verify it exists
      const { data: membership } = await supabase
        .from('organization_members')
        .select('id')
        .eq('organization_id', data.id)
        .eq('user_id', user.id)
        .single();

      if (!membership) {
        // Create ownership membership if trigger didn't
        await supabase.from('organization_members').insert({
          organization_id: data.id,
          user_id: user.id,
          role: 'owner',
        });
      }

      return data;
    }, 'createOrganization');
  }

  /**
   * Update an organization
   */
  static async updateOrganization(
    id: string,
    input: UpdateOrganizationInput
  ): Promise<Organization> {
    return withAuthentication(async () => {
      const updates: Record<string, unknown> = {};
      if (input.name !== undefined) {
        updates.name = input.name;
        updates.slug = input.name
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-|-$/g, '');
      }
      if (input.description !== undefined) updates.description = input.description;
      if (input.logo_url !== undefined) updates.logo_url = input.logo_url;
      if (input.settings !== undefined) updates.settings = input.settings;

      const { data, error } = await supabase
        .from('organizations')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        console.error('Error updating organization:', error);
        throw error;
      }

      return data;
    }, 'updateOrganization');
  }

  /**
   * Delete an organization (owner only)
   */
  static async deleteOrganization(id: string): Promise<void> {
    return withAuthentication(async () => {
      const { error } = await supabase
        .from('organizations')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('Error deleting organization:', error);
        throw error;
      }
    }, 'deleteOrganization');
  }

  // ============================================================================
  // Member Management
  // ============================================================================

  /**
   * Get all members of an organization
   */
  static async getOrganizationMembers(
    organizationId: string
  ): Promise<OrganizationMember[]> {
    return withAuthentication(async () => {
      const { data, error } = await supabase
        .from('organization_members')
        .select('*')
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Error fetching organization members:', error);
        throw error;
      }

      return data || [];
    }, 'getOrganizationMembers');
  }

  /**
   * Update a member's role
   */
  static async updateMemberRole(
    organizationId: string,
    userId: string,
    newRole: OrganizationRole
  ): Promise<void> {
    return withAuthentication(async () => {
      // Prevent changing owner role through this method
      if (newRole === 'owner') {
        throw new Error('Cannot assign owner role through this method');
      }

      const { error } = await supabase
        .from('organization_members')
        .update({ role: newRole })
        .eq('organization_id', organizationId)
        .eq('user_id', userId)
        .neq('role', 'owner'); // Prevent changing owner's role

      if (error) {
        console.error('Error updating member role:', error);
        throw error;
      }
    }, 'updateMemberRole');
  }

  /**
   * Remove a member from an organization
   */
  static async removeMember(
    organizationId: string,
    userId: string
  ): Promise<void> {
    return withAuthentication(async (currentUser) => {
      // Prevent self-removal if owner
      if (userId === currentUser.id) {
        const { data: membership } = await supabase
          .from('organization_members')
          .select('role')
          .eq('organization_id', organizationId)
          .eq('user_id', userId)
          .single();

        if (membership?.role === 'owner') {
          throw new Error('Owner cannot remove themselves from the organization');
        }
      }

      const { error } = await supabase
        .from('organization_members')
        .delete()
        .eq('organization_id', organizationId)
        .eq('user_id', userId)
        .neq('role', 'owner'); // Prevent removing owner

      if (error) {
        console.error('Error removing member:', error);
        throw error;
      }
    }, 'removeMember');
  }

  // ============================================================================
  // Invitation Management
  // ============================================================================

  /**
   * Invite a user to an organization
   */
  static async inviteMember(
    organizationId: string,
    input: InviteMemberInput
  ): Promise<OrganizationInvitation> {
    return withAuthentication(async (user) => {
      // Check if user is already a member
      const { data: existingMember } = await supabase
        .from('organization_members')
        .select('id')
        .eq('organization_id', organizationId)
        .eq('user_id', user.id) // This checks if the inviter is a member
        .single();

      if (!existingMember) {
        throw new Error('You are not a member of this organization');
      }

      // Check for existing pending invitation
      const { data: existingInvite } = await supabase
        .from('organization_invitations')
        .select('id')
        .eq('organization_id', organizationId)
        .eq('email', input.email.toLowerCase())
        .eq('status', 'pending')
        .single();

      if (existingInvite) {
        throw new Error('An invitation is already pending for this email');
      }

      // Calculate expiration (7 days from now)
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);

      const { data, error } = await supabase
        .from('organization_invitations')
        .insert({
          organization_id: organizationId,
          email: input.email.toLowerCase(),
          role: input.role,
          invited_by: user.id,
          status: 'pending',
          expires_at: expiresAt.toISOString(),
        })
        .select()
        .single();

      if (error) {
        console.error('Error creating invitation:', error);
        throw error;
      }

      // Send invitation email (non-blocking - don't fail if email fails)
      try {
        // Fetch organization name for the email
        const { data: org } = await supabase
          .from('organizations')
          .select('name')
          .eq('id', organizationId)
          .single();

        const organizationName = org?.name || 'an organization';

        const emailResult = await sendInvitationEmail(
          input.email.toLowerCase(),
          organizationName,
          user.email || 'A team member',
          data.token,
          input.role
        );

        if (!emailResult.success) {
          console.warn('Failed to send invitation email:', emailResult.error);
        } else {
          console.log('Invitation email sent:', emailResult.messageId);
        }
      } catch (emailError) {
        // Log but don't fail the invitation
        console.warn('Error sending invitation email:', emailError);
      }

      return data;
    }, 'inviteMember');
  }

  /**
   * Get pending invitations for an organization
   */
  static async getOrganizationInvitations(
    organizationId: string
  ): Promise<OrganizationInvitation[]> {
    return withAuthentication(async () => {
      const { data, error } = await supabase
        .from('organization_invitations')
        .select('*')
        .eq('organization_id', organizationId)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching invitations:', error);
        throw error;
      }

      return data || [];
    }, 'getOrganizationInvitations');
  }

  /**
   * Get invitations for the current user's email
   */
  static async getMyInvitations(): Promise<OrganizationInvitation[]> {
    return withAuthentication(async (user) => {
      if (!user.email) {
        throw new Error('User email not available');
      }

      const { data, error } = await supabase
        .from('organization_invitations')
        .select(`
          *,
          organization:organizations(id, name, slug, logo_url)
        `)
        .eq('email', user.email.toLowerCase())
        .eq('status', 'pending')
        .gt('expires_at', new Date().toISOString());

      if (error) {
        console.error('Error fetching my invitations:', error);
        throw error;
      }

      return data || [];
    }, 'getMyInvitations');
  }

  /**
   * Accept an invitation
   */
  static async acceptInvitation(invitationId: string): Promise<void> {
    return withAuthentication(async (user) => {
      // Get the invitation
      const { data: invitation, error: inviteError } = await supabase
        .from('organization_invitations')
        .select('*')
        .eq('id', invitationId)
        .eq('email', user.email?.toLowerCase())
        .eq('status', 'pending')
        .single();

      if (inviteError || !invitation) {
        throw new Error('Invitation not found or already processed');
      }

      // Check if expired
      if (new Date(invitation.expires_at) < new Date()) {
        await supabase
          .from('organization_invitations')
          .update({ status: 'expired' })
          .eq('id', invitationId);
        throw new Error('Invitation has expired');
      }

      // Create membership
      const { error: memberError } = await supabase
        .from('organization_members')
        .insert({
          organization_id: invitation.organization_id,
          user_id: user.id,
          role: invitation.role,
          invited_by: invitation.invited_by,
        });

      if (memberError) {
        console.error('Error creating membership:', memberError);
        throw memberError;
      }

      // Update invitation status
      await supabase
        .from('organization_invitations')
        .update({ status: 'accepted' })
        .eq('id', invitationId);
    }, 'acceptInvitation');
  }

  /**
   * Reject an invitation
   */
  static async rejectInvitation(invitationId: string): Promise<void> {
    return withAuthentication(async (user) => {
      const { error } = await supabase
        .from('organization_invitations')
        .update({ status: 'rejected' })
        .eq('id', invitationId)
        .eq('email', user.email?.toLowerCase());

      if (error) {
        console.error('Error rejecting invitation:', error);
        throw error;
      }
    }, 'rejectInvitation');
  }

  /**
   * Cancel a pending invitation (admin/owner only)
   */
  static async cancelInvitation(invitationId: string): Promise<void> {
    return withAuthentication(async () => {
      const { error } = await supabase
        .from('organization_invitations')
        .delete()
        .eq('id', invitationId)
        .eq('status', 'pending');

      if (error) {
        console.error('Error canceling invitation:', error);
        throw error;
      }
    }, 'cancelInvitation');
  }

  /**
   * Get an invitation by token (public - no auth required)
   * Used for invitation acceptance flow from email links
   */
  static async getInvitationByToken(
    token: string
  ): Promise<OrganizationInvitation | null> {
    // This query doesn't require authentication
    // The RLS policy allows select if email = auth.email() OR user is org member
    // But for anonymous access, we need to use a more permissive query
    const { data, error } = await supabase
      .from('organization_invitations')
      .select(`
        *,
        organization:organizations(id, name, slug, logo_url),
        inviter:auth_user_view(id, email)
      `)
      .eq('token', token)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null; // Not found
      console.error('Error fetching invitation by token:', error);
      // If we get permission denied, try without joins
      const { data: basicData, error: basicError } = await supabase
        .from('organization_invitations')
        .select('*')
        .eq('token', token)
        .single();

      if (basicError) {
        if (basicError.code === 'PGRST116') return null;
        throw basicError;
      }

      return basicData;
    }

    return data;
  }

  /**
   * Accept an invitation by token
   */
  static async acceptInvitationByToken(token: string): Promise<void> {
    return withAuthentication(async (user) => {
      // Get the invitation by token
      const { data: invitation, error: inviteError } = await supabase
        .from('organization_invitations')
        .select('*')
        .eq('token', token)
        .eq('status', 'pending')
        .single();

      if (inviteError || !invitation) {
        throw new Error('Invitation not found or already processed');
      }

      // Verify email matches
      if (user.email?.toLowerCase() !== invitation.email.toLowerCase()) {
        throw new Error(
          `This invitation was sent to ${invitation.email}. You are signed in as ${user.email}.`
        );
      }

      // Check if expired
      if (new Date(invitation.expires_at) < new Date()) {
        await supabase
          .from('organization_invitations')
          .update({ status: 'expired' })
          .eq('id', invitation.id);
        throw new Error('Invitation has expired');
      }

      // Check if already a member
      const { data: existingMember } = await supabase
        .from('organization_members')
        .select('id')
        .eq('organization_id', invitation.organization_id)
        .eq('user_id', user.id)
        .single();

      if (existingMember) {
        // Already a member, just mark invitation as accepted
        await supabase
          .from('organization_invitations')
          .update({ status: 'accepted' })
          .eq('id', invitation.id);
        return;
      }

      // Create membership
      const { error: memberError } = await supabase
        .from('organization_members')
        .insert({
          organization_id: invitation.organization_id,
          user_id: user.id,
          role: invitation.role,
          invited_by: invitation.invited_by,
        });

      if (memberError) {
        console.error('Error creating membership:', memberError);
        throw memberError;
      }

      // Update invitation status
      await supabase
        .from('organization_invitations')
        .update({ status: 'accepted' })
        .eq('id', invitation.id);
    }, 'acceptInvitationByToken');
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  /**
   * Get the user's role in an organization
   */
  static async getUserRole(
    organizationId: string
  ): Promise<OrganizationRole | null> {
    return withAuthentication(async (user) => {
      const { data, error } = await supabase
        .from('organization_members')
        .select('role')
        .eq('organization_id', organizationId)
        .eq('user_id', user.id)
        .single();

      if (error) {
        if (error.code === 'PGRST116') return null; // Not a member
        console.error('Error getting user role:', error);
        throw error;
      }

      return data?.role as OrganizationRole;
    }, 'getUserRole');
  }

  /**
   * Check if user can manage organization (owner or admin)
   */
  static async canManageOrganization(organizationId: string): Promise<boolean> {
    const role = await this.getUserRole(organizationId);
    return role === 'owner' || role === 'admin';
  }

  /**
   * Get the user's personal organization
   */
  static async getPersonalOrganization(): Promise<Organization | null> {
    return withAuthentication(async (user) => {
      const { data, error } = await supabase
        .from('organizations')
        .select('*')
        .eq('owner_id', user.id)
        .eq('organization_type', 'personal')
        .single();

      if (error) {
        if (error.code === 'PGRST116') return null; // Not found
        console.error('Error fetching personal organization:', error);
        throw error;
      }

      return data;
    }, 'getPersonalOrganization');
  }

  /**
   * Get member count for an organization
   */
  static async getMemberCount(organizationId: string): Promise<number> {
    return withAuthentication(async () => {
      const { count, error } = await supabase
        .from('organization_members')
        .select('*', { count: 'exact', head: true })
        .eq('organization_id', organizationId);

      if (error) {
        console.error('Error getting member count:', error);
        throw error;
      }

      return count || 0;
    }, 'getMemberCount');
  }
}
