'use client'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { getRoleConfig, statusStyles } from '../data/data'
import type { MemberTableRow } from '../data/schema'

interface Props {
  currentRow?: MemberTableRow
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function UsersActionDialog({ currentRow, open, onOpenChange }: Props) {
  if (!currentRow) {
    return null
  }

  const roleConfig = getRoleConfig(currentRow.role)
  const RoleIcon = roleConfig?.icon
  const statusColor = statusStyles.get(currentRow.status) || ''

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='sm:max-w-md'>
        <DialogHeader className='text-left'>
          <DialogTitle>Member Details</DialogTitle>
          <DialogDescription>
            View details for this team member.
          </DialogDescription>
        </DialogHeader>

        <div className='space-y-4 py-4'>
          {/* Avatar and Name */}
          <div className='flex items-center gap-4'>
            <Avatar className='h-16 w-16'>
              <AvatarImage
                src={currentRow.avatarUrl || undefined}
                alt={currentRow.name || currentRow.email}
              />
              <AvatarFallback className='text-lg'>
                {currentRow.name
                  ? currentRow.name
                      .split(' ')
                      .map((n) => n[0])
                      .join('')
                      .toUpperCase()
                  : currentRow.email.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div>
              <p className='text-lg font-medium'>
                {currentRow.name || 'No name set'}
              </p>
              <p className='text-muted-foreground text-sm'>
                {currentRow.email}
              </p>
            </div>
          </div>

          {/* Status and Role */}
          <div className='grid grid-cols-2 gap-4'>
            <div>
              <p className='text-muted-foreground mb-1 text-sm font-medium'>
                Status
              </p>
              <Badge variant='outline' className={cn('capitalize', statusColor)}>
                {currentRow.status}
              </Badge>
            </div>
            <div>
              <p className='text-muted-foreground mb-1 text-sm font-medium'>
                Role
              </p>
              <div className='flex items-center gap-1'>
                {RoleIcon && <RoleIcon size={16} />}
                <span className='capitalize'>{currentRow.role}</span>
              </div>
            </div>
          </div>

          {/* Join Date */}
          <div>
            <p className='text-muted-foreground mb-1 text-sm font-medium'>
              {currentRow.type === 'invitation' ? 'Invited' : 'Joined'}
            </p>
            <p>{new Date(currentRow.joinedAt).toLocaleDateString()}</p>
          </div>

          {/* Expiration for invitations */}
          {currentRow.type === 'invitation' && currentRow.expiresAt && (
            <div>
              <p className='text-muted-foreground mb-1 text-sm font-medium'>
                Invitation Expires
              </p>
              <p>{new Date(currentRow.expiresAt).toLocaleDateString()}</p>
            </div>
          )}

          {/* Member ID */}
          <div>
            <p className='text-muted-foreground mb-1 text-sm font-medium'>
              {currentRow.type === 'invitation' ? 'Invitation ID' : 'Member ID'}
            </p>
            <p className='font-mono text-xs'>{currentRow.id}</p>
          </div>
        </div>

        <DialogFooter>
          <Button variant='outline' onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
