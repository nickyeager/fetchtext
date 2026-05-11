import { createFileRoute } from '@tanstack/react-router'
import BillingSettings from '@/features/settings/billing'

export const Route = createFileRoute('/_authenticated/settings/billing')({
  component: BillingSettings,
  validateSearch: (search: Record<string, unknown>) => {
    return {
      success: search.success as string | undefined,
      canceled: search.canceled as string | undefined,
      session_id: search.session_id as string | undefined,
    }
  },
})
