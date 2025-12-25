import { ColumnDef } from '@tanstack/react-table'
import { Row } from '@tanstack/react-table'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import LongText from '@/components/long-text'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { useAuth } from '@/context/auth-context'
import { statusStyles, getRoleConfig } from '../data/data'
import type { MemberTableRow } from '../data/schema'
import { DataTableColumnHeader } from './data-table-column-header'
import { DataTableRowActions } from './data-table-row-actions'

/**
 * Get initials from email or name
 */
function getInitials(name: string | null, email: string): string {
  if (name) {
    const parts = name.split(' ')
    return parts
      .slice(0, 2)
      .map((p) => p[0])
      .join('')
      .toUpperCase()
  }
  return email.slice(0, 2).toUpperCase()
}

/**
 * Member cell component that shows "(You)" label for the current user
 */
function MemberCell({ row }: { row: Row<MemberTableRow> }) {
  const { user } = useAuth()
  const { email, name, avatarUrl, userId } = row.original
  const displayName = name || email.split('@')[0]
  const initials = getInitials(name, email)
  const isCurrentUser = user?.id === userId

  return (
    <div className='flex items-center gap-3'>
      <Avatar className='h-8 w-8'>
        <AvatarImage src={avatarUrl || undefined} alt={displayName} />
        <AvatarFallback className='text-xs'>{initials}</AvatarFallback>
      </Avatar>
      <div className='flex flex-col'>
        <span className='font-medium'>
          {displayName}
          {isCurrentUser && (
            <span className='ml-1.5 text-xs text-muted-foreground'>(You)</span>
          )}
        </span>
        <span className='text-xs text-muted-foreground'>{email}</span>
      </div>
    </div>
  )
}

export const columns: ColumnDef<MemberTableRow>[] = [
  {
    id: 'select',
    header: ({ table }) => (
      <Checkbox
        checked={
          table.getIsAllPageRowsSelected() ||
          (table.getIsSomePageRowsSelected() && 'indeterminate')
        }
        onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
        aria-label='Select all'
        className='translate-y-[2px]'
      />
    ),
    meta: {
      className: cn(
        'sticky md:table-cell left-0 z-10 rounded-tl',
        'bg-background transition-colors duration-200 group-hover/row:bg-muted group-data-[state=selected]/row:bg-muted'
      ),
    },
    cell: ({ row }) => (
      <Checkbox
        checked={row.getIsSelected()}
        onCheckedChange={(value) => row.toggleSelected(!!value)}
        aria-label='Select row'
        className='translate-y-[2px]'
      />
    ),
    enableSorting: false,
    enableHiding: false,
  },
  {
    id: 'member',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Member' />
    ),
    cell: ({ row }) => <MemberCell row={row} />,
    meta: {
      className: cn(
        'drop-shadow-[0_1px_2px_rgb(0_0_0_/_0.1)] dark:drop-shadow-[0_1px_2px_rgb(255_255_255_/_0.1)] lg:drop-shadow-none',
        'bg-background transition-colors duration-200 group-hover/row:bg-muted group-data-[state=selected]/row:bg-muted',
        'sticky left-6 md:table-cell'
      ),
    },
    enableHiding: false,
  },
  {
    accessorKey: 'email',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Email' />
    ),
    cell: ({ row }) => (
      <LongText className='max-w-48'>{row.getValue('email')}</LongText>
    ),
    meta: { className: 'hidden lg:table-cell' },
  },
  {
    accessorKey: 'status',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Status' />
    ),
    cell: ({ row }) => {
      const status = row.original.status
      const badgeColor = statusStyles.get(status) || ''

      return (
        <div className='flex space-x-2'>
          <Badge variant='outline' className={cn('capitalize', badgeColor)}>
            {status}
          </Badge>
        </div>
      )
    },
    filterFn: (row, id, value) => {
      return value.includes(row.getValue(id))
    },
    enableHiding: false,
    enableSorting: false,
  },
  {
    accessorKey: 'role',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Role' />
    ),
    cell: ({ row }) => {
      const role = row.original.role
      const roleConfig = getRoleConfig(role)

      if (!roleConfig) {
        return null
      }

      return (
        <div className='flex items-center gap-x-2'>
          {roleConfig.icon && (
            <roleConfig.icon size={16} className='text-muted-foreground' />
          )}
          <span className='text-sm capitalize'>{role}</span>
        </div>
      )
    },
    filterFn: (row, id, value) => {
      return value.includes(row.getValue(id))
    },
    enableSorting: false,
    enableHiding: false,
  },
  {
    accessorKey: 'joinedAt',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Joined' />
    ),
    cell: ({ row }) => {
      const date = new Date(row.getValue('joinedAt'))
      return (
        <div className='text-sm text-muted-foreground'>
          {date.toLocaleDateString()}
        </div>
      )
    },
    meta: { className: 'hidden xl:table-cell' },
  },
  {
    id: 'actions',
    cell: DataTableRowActions,
  },
]
