import { createFileRoute, Outlet } from '@tanstack/react-router'

export const Route = createFileRoute('/_authenticated/documents')({
  component: RouteComponent,
})

function RouteComponent() {
  return <Outlet />
}
