import { createFileRoute } from '@tanstack/react-router'
import SSOSettings from '@/features/settings/organization/sso-settings'

export const Route = createFileRoute('/_authenticated/settings/organization')({
  component: SSOSettings,
})
