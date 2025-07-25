import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/workflow-test')({
  component: RouteComponent,
})

function RouteComponent() {
  return <div>Hello "/workflow-test"!</div>
}
