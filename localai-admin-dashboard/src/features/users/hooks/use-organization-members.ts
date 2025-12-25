/**
 * Organization Members Hook
 *
 * Provides unified interface for managing organization members and invitations.
 * Combines members and pending invitations into a single table view.
 *
 * Pattern reference: use-document-gallery.ts
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useOrganization } from '@/context/organization-context';
import { OrganizationService } from '@/lib/organization-service';
import { supabase } from '@/lib/supabase';
import { withAuthentication } from '@/lib/supabase-auth-utils';
import type {
  OrganizationMember,
  OrganizationInvitation,
  OrganizationRole,
  InviteMemberInput,
} from '@/types/organization';
import type { MemberTableRow } from '../types/member-table';

// ============================================================================
// QUERY KEY FACTORY
// ============================================================================

export const memberQueries = {
  all: ['organization-members'] as const,

  // Members queries
  members: () => [...memberQueries.all, 'members'] as const,
  membersByOrg: (orgId: string) => [...memberQueries.members(), orgId] as const,

  // Invitations queries
  invitations: () => [...memberQueries.all, 'invitations'] as const,
  invitationsByOrg: (orgId: string) =>
    [...memberQueries.invitations(), orgId] as const,

  // Combined view
  combined: () => [...memberQueries.all, 'combined'] as const,
  combinedByOrg: (orgId: string) => [...memberQueries.combined(), orgId] as const,
};

// ============================================================================
// DATA FETCHING (with user details)
// ============================================================================

/**
 * Fetch organization members with user details
 */
async function fetchMembersWithUserDetails(
  organizationId: string
): Promise<OrganizationMember[]> {
  return withAuthentication(async () => {
    // Fetch members with a join to get user email from auth.users
    const { data, error } = await supabase
      .from('organization_members')
      .select(
        `
        *,
        user:user_id (
          id,
          email,
          raw_user_meta_data
        )
      `
      )
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error fetching members with user details:', error);
      // Fallback to basic member fetch if join fails
      return OrganizationService.getOrganizationMembers(organizationId);
    }

    // Transform the nested user data
    return (data || []).map((member) => ({
      ...member,
      user: member.user
        ? {
            id: member.user.id,
            email: member.user.email,
            user_metadata: {
              full_name: member.user.raw_user_meta_data?.full_name,
              avatar_url: member.user.raw_user_meta_data?.avatar_url,
            },
          }
        : undefined,
    }));
  }, 'fetchMembersWithUserDetails');
}

// ============================================================================
// QUERY HOOKS
// ============================================================================

/**
 * Fetch organization members
 */
export function useOrganizationMembersQuery(organizationId: string) {
  return useQuery({
    queryKey: memberQueries.membersByOrg(organizationId),
    queryFn: () => fetchMembersWithUserDetails(organizationId),
    enabled: !!organizationId,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });
}

/**
 * Fetch pending invitations
 */
export function useOrganizationInvitationsQuery(organizationId: string) {
  return useQuery({
    queryKey: memberQueries.invitationsByOrg(organizationId),
    queryFn: () => OrganizationService.getOrganizationInvitations(organizationId),
    enabled: !!organizationId,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
}

/**
 * Combined members and invitations for table display
 */
export function useCombinedMembers(organizationId: string | undefined) {
  const membersQuery = useOrganizationMembersQuery(organizationId || '');
  const invitationsQuery = useOrganizationInvitationsQuery(organizationId || '');

  const isLoading =
    (membersQuery.isLoading || invitationsQuery.isLoading) && !!organizationId;
  const error = membersQuery.error || invitationsQuery.error;

  // Transform data for unified table display
  const tableRows: MemberTableRow[] = [
    // Active members
    ...(membersQuery.data || []).map(transformMemberToTableRow),
    // Pending invitations
    ...(invitationsQuery.data || []).map(transformInvitationToTableRow),
  ];

  // Sort by created_at descending (newest first)
  tableRows.sort(
    (a, b) => new Date(b.joinedAt).getTime() - new Date(a.joinedAt).getTime()
  );

  return {
    data: tableRows,
    isLoading,
    error,
    refetch: () => {
      membersQuery.refetch();
      invitationsQuery.refetch();
    },
  };
}

// ============================================================================
// MUTATION HOOKS
// ============================================================================

/**
 * Invite a new member
 */
export function useInviteMember() {
  const queryClient = useQueryClient();
  const { activeOrganization } = useOrganization();

  return useMutation({
    mutationFn: async (input: InviteMemberInput) => {
      if (!activeOrganization) throw new Error('No active organization');
      return OrganizationService.inviteMember(activeOrganization.id, input);
    },
    onSuccess: () => {
      if (!activeOrganization) return;

      // Invalidate invitations query
      queryClient.invalidateQueries({
        queryKey: memberQueries.invitationsByOrg(activeOrganization.id),
      });

      toast.success('Invitation sent successfully');
    },
    onError: (error) => {
      console.error('Failed to invite member:', error);
      toast.error(
        error instanceof Error ? error.message : 'Failed to send invitation'
      );
    },
  });
}

/**
 * Update member role
 */
export function useUpdateMemberRole() {
  const queryClient = useQueryClient();
  const { activeOrganization } = useOrganization();

  return useMutation({
    mutationFn: async ({
      userId,
      newRole,
    }: {
      userId: string;
      newRole: OrganizationRole;
    }) => {
      if (!activeOrganization) throw new Error('No active organization');
      return OrganizationService.updateMemberRole(
        activeOrganization.id,
        userId,
        newRole
      );
    },
    onMutate: async ({ userId, newRole }) => {
      if (!activeOrganization) return;

      // Cancel outgoing refetches
      await queryClient.cancelQueries({
        queryKey: memberQueries.membersByOrg(activeOrganization.id),
      });

      // Snapshot previous value
      const previousMembers = queryClient.getQueryData<OrganizationMember[]>(
        memberQueries.membersByOrg(activeOrganization.id)
      );

      // Optimistically update
      queryClient.setQueryData(
        memberQueries.membersByOrg(activeOrganization.id),
        (old: OrganizationMember[] | undefined) =>
          old?.map((m) => (m.user_id === userId ? { ...m, role: newRole } : m))
      );

      return { previousMembers };
    },
    onError: (err, _variables, context) => {
      // Rollback on error
      if (context?.previousMembers && activeOrganization) {
        queryClient.setQueryData(
          memberQueries.membersByOrg(activeOrganization.id),
          context.previousMembers
        );
      }
      console.error('Failed to update role:', err);
      toast.error('Failed to update role');
    },
    onSuccess: () => {
      toast.success('Role updated successfully');
    },
    onSettled: () => {
      if (!activeOrganization) return;

      // Always refetch after error or success
      queryClient.invalidateQueries({
        queryKey: memberQueries.membersByOrg(activeOrganization.id),
      });
    },
  });
}

/**
 * Remove member from organization
 */
export function useRemoveMember() {
  const queryClient = useQueryClient();
  const { activeOrganization } = useOrganization();

  return useMutation({
    mutationFn: async (userId: string) => {
      if (!activeOrganization) throw new Error('No active organization');
      return OrganizationService.removeMember(activeOrganization.id, userId);
    },
    onSuccess: () => {
      if (!activeOrganization) return;

      queryClient.invalidateQueries({
        queryKey: memberQueries.membersByOrg(activeOrganization.id),
      });

      toast.success('Member removed successfully');
    },
    onError: (error) => {
      console.error('Failed to remove member:', error);
      toast.error(
        error instanceof Error ? error.message : 'Failed to remove member'
      );
    },
  });
}

/**
 * Cancel/delete invitation
 */
export function useCancelInvitation() {
  const queryClient = useQueryClient();
  const { activeOrganization } = useOrganization();

  return useMutation({
    mutationFn: async (invitationId: string) => {
      return OrganizationService.cancelInvitation(invitationId);
    },
    onSuccess: () => {
      if (!activeOrganization) return;

      queryClient.invalidateQueries({
        queryKey: memberQueries.invitationsByOrg(activeOrganization.id),
      });

      toast.success('Invitation cancelled');
    },
    onError: () => {
      toast.error('Failed to cancel invitation');
    },
  });
}

/**
 * Resend invitation email
 */
export function useResendInvitation() {
  return useMutation({
    mutationFn: async (invitationId: string) => {
      return withAuthentication(async () => {
        // Update expires_at to extend invitation validity
        const newExpiresAt = new Date();
        newExpiresAt.setDate(newExpiresAt.getDate() + 7);

        const { error } = await supabase
          .from('organization_invitations')
          .update({ expires_at: newExpiresAt.toISOString() })
          .eq('id', invitationId);

        if (error) {
          console.error('Error resending invitation:', error);
          throw error;
        }

        // TODO: Trigger N8N webhook to send invitation email
        // await fetch('http://localhost:5678/webhook/organization-invite', {
        //   method: 'POST',
        //   body: JSON.stringify({ invitationId }),
        // });
      }, 'resendInvitation');
    },
    onSuccess: () => {
      toast.success('Invitation resent successfully');
    },
    onError: () => {
      toast.error('Failed to resend invitation');
    },
  });
}

// ============================================================================
// MAIN HOOK (combines all functionality)
// ============================================================================

export function useOrganizationMembers() {
  const { activeOrganization, canManage, userRole } = useOrganization();

  const combinedData = useCombinedMembers(activeOrganization?.id);

  const inviteMutation = useInviteMember();
  const updateRoleMutation = useUpdateMemberRole();
  const removeMemberMutation = useRemoveMember();
  const cancelInvitationMutation = useCancelInvitation();
  const resendInvitationMutation = useResendInvitation();

  return {
    // Data
    members: combinedData.data,
    isLoading: combinedData.isLoading,
    error: combinedData.error,

    // Organization info
    organizationName: activeOrganization?.name || '',
    hasOrganization: !!activeOrganization,

    // Permissions
    canManage,
    userRole,

    // Actions
    inviteMember: inviteMutation.mutate,
    updateRole: updateRoleMutation.mutate,
    removeMember: removeMemberMutation.mutate,
    cancelInvitation: cancelInvitationMutation.mutate,
    resendInvitation: resendInvitationMutation.mutate,

    // Loading states
    isInviting: inviteMutation.isPending,
    isUpdatingRole: updateRoleMutation.isPending,
    isRemoving: removeMemberMutation.isPending,
    isCancelling: cancelInvitationMutation.isPending,
    isResending: resendInvitationMutation.isPending,

    // Refetch
    refetch: combinedData.refetch,
  };
}

// ============================================================================
// TRANSFORMATION HELPERS
// ============================================================================

function transformMemberToTableRow(member: OrganizationMember): MemberTableRow {
  return {
    id: member.id,
    userId: member.user_id,
    email: member.user?.email || 'Unknown',
    name: member.user?.user_metadata?.full_name || null,
    avatarUrl: member.user?.user_metadata?.avatar_url || null,
    role: member.role,
    status: 'active',
    joinedAt: member.created_at,
    invitedBy: member.invited_by || null,
    type: 'member',
  };
}

function transformInvitationToTableRow(
  invitation: OrganizationInvitation
): MemberTableRow {
  return {
    id: invitation.id,
    userId: null,
    email: invitation.email,
    name: null,
    avatarUrl: null,
    role: invitation.role,
    status: 'invited',
    joinedAt: invitation.created_at,
    invitedBy: invitation.invited_by,
    expiresAt: invitation.expires_at,
    type: 'invitation',
  };
}
