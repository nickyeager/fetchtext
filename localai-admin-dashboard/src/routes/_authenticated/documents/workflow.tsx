import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_authenticated/documents/workflow')({
  component: RouteComponent,
})

function RouteComponent() {
  return <div>Hello "/_authenticated/documents/workflow"!</div>
}
