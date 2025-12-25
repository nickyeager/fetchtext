import { DotsHorizontalIcon } from '@radix-ui/react-icons'
import { Row } from '@tanstack/react-table'
import {
  IconEdit,
  IconTrash,
  IconSend,
  IconX,
  IconUserCog,
} from '@tabler/icons-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from '@/components/ui/dropdown-menu'
import { useAuth } from '@/context/auth-context'
import { useOrganization } from '@/context/organization-context'
import {
  useUpdateMemberRole,
  useRemoveMember,
  useCancelInvitation,
  useResendInvitation,
} from '../hooks/use-organization-members'
import { useUsers } from '../context/users-context'
import type { MemberTableRow } from '../data/schema'
import { invitableRoles } from '../data/data'

interface DataTableRowActionsProps {
  row: Row<MemberTableRow>
}

export function DataTableRowActions({ row }: DataTableRowActionsProps) {
  const { user } = useAuth()
  const { setOpen, setCurrentRow } = useUsers()
  const { canManage } = useOrganization()

  const updateRoleMutation = useUpdateMemberRole()
  const removeMemberMutation = useRemoveMember()
  const cancelInvitationMutation = useCancelInvitation()
  const resendInvitationMutation = useResendInvitation()

  const member = row.original
  const isInvitation = member.type === 'invitation'
  const isOwner = member.role === 'owner'
  const isCurrentUser = user?.id === member.userId

  // Hide actions for non-admins or if user is the owner (can't modify owner)
  if (!canManage) {
    return null
  }

  const handleRoleChange = (newRole: string) => {
    if (!member.userId || newRole === member.role) return
    updateRoleMutation.mutate({
      userId: member.userId,
      newRole: newRole as 'admin' | 'member',
    })
  }

  const handleRemove = () => {
    if (isInvitation) {
      cancelInvitationMutation.mutate(member.id)
    } else if (member.userId) {
      removeMemberMutation.mutate(member.userId)
    }
  }

  const handleResend = () => {
    if (isInvitation) {
      resendInvitationMutation.mutate(member.id)
    }
  }

  const isLoading =
    updateRoleMutation.isPending ||
    removeMemberMutation.isPending ||
    cancelInvitationMutation.isPending ||
    resendInvitationMutation.isPending

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button
          variant='ghost'
          className='data-[state=open]:bg-muted flex h-8 w-8 p-0'
          disabled={isLoading}
        >
          <DotsHorizontalIcon className='h-4 w-4' />
          <span className='sr-only'>Open menu</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align='end' className='w-[180px]'>
        {/* Member Actions */}
        {!isInvitation && !isOwner && (
          <>
            {/* Change Role Submenu */}
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <IconUserCog size={16} className='mr-2' />
                Change Role
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                <DropdownMenuRadioGroup
                  value={member.role}
                  onValueChange={handleRoleChange}
                >
                  {invitableRoles.map((role) => (
                    <DropdownMenuRadioItem
                      key={role.value}
                      value={role.value}
                      disabled={role.value === member.role}
                    >
                      <role.icon size={14} className='mr-2' />
                      {role.label}
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
              </DropdownMenuSubContent>
            </DropdownMenuSub>

            {/* Edit Member (opens dialog) */}
            <DropdownMenuItem
              onClick={() => {
                setCurrentRow(member)
                setOpen('edit')
              }}
            >
              <IconEdit size={16} className='mr-2' />
              Edit Details
            </DropdownMenuItem>

            <DropdownMenuSeparator />

            {/* Remove Member - disabled for current user */}
            <DropdownMenuItem
              onClick={handleRemove}
              className='text-destructive focus:text-destructive'
              disabled={removeMemberMutation.isPending || isCurrentUser}
            >
              <IconTrash size={16} className='mr-2' />
              {isCurrentUser ? "Can't remove yourself" : 'Remove Member'}
            </DropdownMenuItem>
          </>
        )}

        {/* Invitation Actions */}
        {isInvitation && (
          <>
            {/* Resend Invitation */}
            <DropdownMenuItem
              onClick={handleResend}
              disabled={resendInvitationMutation.isPending}
            >
              <IconSend size={16} className='mr-2' />
              Resend Invitation
            </DropdownMenuItem>

            <DropdownMenuSeparator />

            {/* Cancel Invitation */}
            <DropdownMenuItem
              onClick={handleRemove}
              className='text-destructive focus:text-destructive'
              disabled={cancelInvitationMutation.isPending}
            >
              <IconX size={16} className='mr-2' />
              Cancel Invitation
            </DropdownMenuItem>
          </>
        )}

        {/* Owner - no actions available */}
        {!isInvitation && isOwner && (
          <DropdownMenuItem disabled>
            <span className='text-muted-foreground text-sm'>
              Owner cannot be modified
            </span>
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
