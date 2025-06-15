import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute(
  '/_authenticated/workflows/instances/__tests__/instanceId/test',
)({
  component: RouteComponent,
})

function RouteComponent() {
  return (
    <div>
      Hello "/_authenticated/workflows/instances/__tests__/instanceId/test"!
    </div>
  )
}
