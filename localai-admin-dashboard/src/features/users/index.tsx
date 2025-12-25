import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { Search } from '@/components/search'
import { ThemeSwitch } from '@/components/theme-switch'
import { Skeleton } from '@/components/ui/skeleton'
import { useOrganization } from '@/context/organization-context'
import { columns } from './components/users-columns'
import { UsersDialogs } from './components/users-dialogs'
import { UsersPrimaryButtons } from './components/users-primary-buttons'
import { UsersTable } from './components/users-table'
import UsersProvider from './context/users-context'
import { useOrganizationMembers } from './hooks/use-organization-members'

export default function Users() {
  const { activeOrganization, isLoading: isOrgLoading } = useOrganization()
  const {
    members,
    isLoading: isMembersLoading,
    organizationName,
    hasOrganization,
  } = useOrganizationMembers()

  const isLoading = isOrgLoading || isMembersLoading

  // Show skeleton while loading organization
  if (isLoading) {
    return (
      <UsersProvider>
        <Header fixed>
          <Search />
          <div className='ml-auto flex items-center space-x-4'>
            <ThemeSwitch />
            <ProfileDropdown />
          </div>
        </Header>

        <Main>
          <div className='mb-2 flex flex-wrap items-center justify-between space-y-2'>
            <div>
              <Skeleton className='h-8 w-48' />
              <Skeleton className='mt-2 h-4 w-64' />
            </div>
            <Skeleton className='h-10 w-32' />
          </div>
          <div className='-mx-4 flex-1 overflow-auto px-4 py-1'>
            <div className='space-y-3'>
              <Skeleton className='h-10 w-full' />
              <Skeleton className='h-12 w-full' />
              <Skeleton className='h-12 w-full' />
              <Skeleton className='h-12 w-full' />
            </div>
          </div>
        </Main>
      </UsersProvider>
    )
  }

  // No organization selected
  if (!hasOrganization || !activeOrganization) {
    return (
      <UsersProvider>
        <Header fixed>
          <Search />
          <div className='ml-auto flex items-center space-x-4'>
            <ThemeSwitch />
            <ProfileDropdown />
          </div>
        </Header>

        <Main>
          <div className='flex h-[50vh] flex-col items-center justify-center'>
            <h2 className='text-xl font-semibold'>No Organization Selected</h2>
            <p className='text-muted-foreground mt-2'>
              Please select an organization from the sidebar to manage team
              members.
            </p>
          </div>
        </Main>
      </UsersProvider>
    )
  }

  return (
    <UsersProvider>
      <Header fixed>
        <Search />
        <div className='ml-auto flex items-center space-x-4'>
          <ThemeSwitch />
          <ProfileDropdown />
        </div>
      </Header>

      <Main>
        <div className='mb-2 flex flex-wrap items-center justify-between space-y-2'>
          <div>
            <h2 className='text-2xl font-bold tracking-tight'>Team Members</h2>
            <p className='text-muted-foreground'>
              Manage members and invitations for {organizationName}.
            </p>
          </div>
          <UsersPrimaryButtons />
        </div>
        <div className='-mx-4 flex-1 overflow-auto px-4 py-1 lg:flex-row lg:space-y-0 lg:space-x-12'>
          <UsersTable data={members} columns={columns} />
        </div>
      </Main>

      <UsersDialogs />
    </UsersProvider>
  )
}
