import { createFileRoute } from '@tanstack/react-router'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { DocumentGallery } from '@/components/documents/DocumentGallery'

export const Route = createFileRoute('/_authenticated/documents/')({
  component: DocumentsListPage,
})

function DocumentsListPage() {
  return (
    <>
      <Header />
      <Main>
        <DocumentGallery viewMode='list' showFilters showStats />
      </Main>
    </>
  )
}
