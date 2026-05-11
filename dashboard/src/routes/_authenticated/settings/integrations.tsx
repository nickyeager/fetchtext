import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import Integrations from '@/features/settings/integrations'

// Search params schema for OAuth callback handling
// Note: TanStack Router parses ?success=true as boolean, not string
const searchSchema = z.object({
  success: z.union([z.string(), z.boolean()]).optional(),
  error: z.string().optional(),
  provider: z.string().optional(),
})

export const Route = createFileRoute('/_authenticated/settings/integrations')({
  validateSearch: searchSchema,
  component: Integrations,
})
