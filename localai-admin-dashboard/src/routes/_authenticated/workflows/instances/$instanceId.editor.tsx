import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute(
  '/_authenticated/workflows/instances/$instanceId/editor',
)({
  component: RouteComponent,
})

function RouteComponent() {
  return (
    <div>Hello "/_authenticated/workflows/instances/$instanceId/editor"!</div>
  )
}
