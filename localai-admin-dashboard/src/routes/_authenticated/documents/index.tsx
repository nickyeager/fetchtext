import { createFileRoute } from '@tanstack/react-router'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { Search } from '@/components/search'
import { ThemeSwitch } from '@/components/theme-switch'
import { DocumentGallery } from '@/components/documents/DocumentGallery'

export const Route = createFileRoute('/_authenticated/documents/')({
  component: DocumentsListPage,
})

function DocumentsListPage() {
  return (
    <>
      <Header>
        <Search />
        <div className='ml-auto flex items-center space-x-4'>
          <ThemeSwitch />
          <ProfileDropdown />
        </div>
      </Header>
      <Main>
        <DocumentGallery viewMode='list' showFilters showStats />
      </Main>
    </>
  )
}
