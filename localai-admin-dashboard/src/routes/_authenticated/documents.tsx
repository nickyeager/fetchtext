import { createFileRoute } from '@tanstack/react-router'
import DocumentsPage from '@/features/documents'

export const Route = createFileRoute('/_authenticated/documents')({
  component: RouteComponent,
})

function RouteComponent() {
  return <DocumentsPage />
}
