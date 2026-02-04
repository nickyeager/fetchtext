import { IconCrown, IconShield, IconUser } from '@tabler/icons-react'
import type { MemberStatus } from '../types/member-table'
import type { OrganizationRole } from '@/types/organization'

/**
 * Status badge styles for member table rows
 */
export const statusStyles = new Map<MemberStatus, string>([
  ['active', 'bg-teal-100/30 text-teal-900 dark:text-teal-200 border-teal-200'],
  ['invited', 'bg-sky-200/40 text-sky-900 dark:text-sky-100 border-sky-300'],
])

/**
 * Member status options for filtering
 */
export const memberStatuses: { label: string; value: MemberStatus }[] = [
  { label: 'Active', value: 'active' },
  { label: 'Invited', value: 'invited' },
]

/**
 * Organization role definitions with icons
 */
export const organizationRoles: {
  label: string
  value: OrganizationRole
  icon: typeof IconCrown
  description: string
}[] = [
  {
    label: 'Owner',
    value: 'owner',
    icon: IconCrown,
    description: 'Full control over organization',
  },
  {
    label: 'Admin',
    value: 'admin',
    icon: IconShield,
    description: 'Manage members and content',
  },
  {
    label: 'Member',
    value: 'member',
    icon: IconUser,
    description: 'View and create content',
  },
]

/**
 * Roles available for invitation (excludes owner)
 */
export const invitableRoles = organizationRoles.filter(
  (role) => role.value !== 'owner'
)

/**
 * Get role configuration by value
 */
export function getRoleConfig(role: OrganizationRole) {
  return organizationRoles.find((r) => r.value === role)
}
