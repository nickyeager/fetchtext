import { createFileRoute } from '@tanstack/react-router'
import AIModelsSettings from '@/features/settings/ai-models'

export const Route = createFileRoute('/_authenticated/settings/ai-models')({
  component: AIModelsSettings,
})