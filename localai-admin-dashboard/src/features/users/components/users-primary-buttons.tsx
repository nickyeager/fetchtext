import { IconMailPlus } from '@tabler/icons-react'
import { Button } from '@/components/ui/button'
import { useOrganization } from '@/context/organization-context'
import { useUsers } from '../context/users-context'

export function UsersPrimaryButtons() {
  const { setOpen } = useUsers()
  const { canManage } = useOrganization()

  // Only admins/owners can invite members
  if (!canManage) {
    return null
  }

  return (
    <div className='flex gap-2'>
      <Button className='space-x-1' onClick={() => setOpen('invite')}>
        <span>Invite Member</span> <IconMailPlus size={18} />
      </Button>
    </div>
  )
}
