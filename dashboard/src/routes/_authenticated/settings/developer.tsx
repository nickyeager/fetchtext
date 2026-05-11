import { createFileRoute } from '@tanstack/react-router'
import DeveloperSettings from '@/features/settings/developer'

export const Route = createFileRoute('/_authenticated/settings/developer')({
  component: DeveloperSettings,
})
