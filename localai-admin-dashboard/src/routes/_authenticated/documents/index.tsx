import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_authenticated/documents/')({
  component: RouteComponent,
})

function RouteComponent() {
  return <div>Hello "/_authenticated/documents/"!</div>
}
