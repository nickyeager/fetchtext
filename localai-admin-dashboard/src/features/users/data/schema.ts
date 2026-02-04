import { z } from 'zod'

// Re-export types from member-table for convenience
export type { MemberTableRow, MemberStatus } from '../types/member-table'
export { isMember, isInvitation } from '../types/member-table'

/**
 * Zod schema for organization roles
 */
export const organizationRoleSchema = z.enum(['owner', 'admin', 'member'])

/**
 * Zod schema for member status
 */
export const memberStatusSchema = z.enum(['active', 'invited'])

/**
 * Zod schema for member table row (runtime validation)
 */
export const memberTableRowSchema = z.object({
  id: z.string(),
  userId: z.string().nullable(),
  email: z.string().email(),
  name: z.string().nullable(),
  avatarUrl: z.string().nullable(),
  role: organizationRoleSchema,
  status: memberStatusSchema,
  joinedAt: z.string(),
  invitedBy: z.string().nullable(),
  expiresAt: z.string().optional(),
  type: z.enum(['member', 'invitation']),
})

/**
 * Zod schema for array of member table rows
 */
export const memberTableRowListSchema = z.array(memberTableRowSchema)
