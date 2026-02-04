/**
 * Member Table Types
 *
 * UI-specific types for unified member/invitation table display.
 * Combines organization members and pending invitations into a single view.
 */

import type { OrganizationRole } from '@/types/organization';

export type MemberStatus = 'active' | 'invited';

export interface MemberTableRow {
  /** Unique identifier (member ID or invitation ID) */
  id: string;

  /** User ID from auth.users (null for pending invitations) */
  userId: string | null;

  /** Email address */
  email: string;

  /** Full name from user metadata (null if not set or invitation) */
  name: string | null;

  /** Avatar URL from user metadata */
  avatarUrl: string | null;

  /** Organization role: owner, admin, or member */
  role: OrganizationRole;

  /** Status: active member or pending invitation */
  status: MemberStatus;

  /** When the member joined or invitation was created */
  joinedAt: string;

  /** ID of user who invited this member */
  invitedBy: string | null;

  /** Invitation expiration (only for pending invitations) */
  expiresAt?: string;

  /** Discriminator for row type */
  type: 'member' | 'invitation';
}

/**
 * Type guard to check if row is an active member
 */
export function isMember(row: MemberTableRow): boolean {
  return row.type === 'member' && row.userId !== null;
}

/**
 * Type guard to check if row is a pending invitation
 */
export function isInvitation(row: MemberTableRow): boolean {
  return row.type === 'invitation' && row.userId === null;
}
