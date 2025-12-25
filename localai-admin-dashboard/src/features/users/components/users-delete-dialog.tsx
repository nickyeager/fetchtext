'use client'

import { useState } from 'react'
import { IconAlertTriangle } from '@tabler/icons-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ConfirmDialog } from '@/components/confirm-dialog'
import {
  useRemoveMember,
  useCancelInvitation,
} from '../hooks/use-organization-members'
import type { MemberTableRow } from '../data/schema'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  currentRow: MemberTableRow
}

export function UsersDeleteDialog({ open, onOpenChange, currentRow }: Props) {
  const [value, setValue] = useState('')
  const removeMemberMutation = useRemoveMember()
  const cancelInvitationMutation = useCancelInvitation()

  const isInvitation = currentRow.type === 'invitation'
  const confirmText = currentRow.email

  const handleDelete = () => {
    if (value.trim() !== confirmText) return

    if (isInvitation) {
      cancelInvitationMutation.mutate(currentRow.id, {
        onSuccess: () => {
          onOpenChange(false)
          setValue('')
        },
      })
    } else if (currentRow.userId) {
      removeMemberMutation.mutate(currentRow.userId, {
        onSuccess: () => {
          onOpenChange(false)
          setValue('')
        },
      })
    }
  }

  const isLoading =
    removeMemberMutation.isPending || cancelInvitationMutation.isPending

  const actionLabel = isInvitation ? 'Cancel Invitation' : 'Remove'
  const buttonText = isLoading ? 'Processing...' : actionLabel

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={(state) => {
        if (!isLoading) {
          onOpenChange(state)
          setValue('')
        }
      }}
      handleConfirm={handleDelete}
      disabled={value.trim() !== confirmText || isLoading}
      title={
        <span className='text-destructive'>
          <IconAlertTriangle
            className='stroke-destructive mr-1 inline-block'
            size={18}
          />{' '}
          {isInvitation ? 'Cancel Invitation' : 'Remove Member'}
        </span>
      }
      desc={
        <div className='space-y-4'>
          <p className='mb-2'>
            Are you sure you want to {isInvitation ? 'cancel the invitation for' : 'remove'}{' '}
            <span className='font-bold'>{currentRow.email}</span>?
            <br />
            {isInvitation
              ? 'This will cancel the pending invitation.'
              : `This will remove the ${currentRow.role} from the organization.`}
          </p>

          <Label className='my-2'>
            Email:
            <Input
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder='Enter email to confirm'
              disabled={isLoading}
            />
          </Label>

          <Alert variant='destructive'>
            <AlertTitle>Warning!</AlertTitle>
            <AlertDescription>
              {isInvitation
                ? 'The invitation link will no longer work.'
                : 'The member will lose access to this organization.'}
            </AlertDescription>
          </Alert>
        </div>
      }
      confirmText={buttonText}
      destructive
    />
  )
}
