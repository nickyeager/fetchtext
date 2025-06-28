import { createFileRoute } from '@tanstack/react-router'
import DocumentsPage from '@/features/documents'

console.log('RENDERED: /documents route (DocumentsPage)')
export const Route = createFileRoute('/_authenticated/documents')({
  component: DocumentsPage,
})
