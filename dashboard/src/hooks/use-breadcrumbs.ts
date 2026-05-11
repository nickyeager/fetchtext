import { useLocation } from '@tanstack/react-router'
import { useQueryClient } from '@tanstack/react-query'

export interface BreadcrumbItem {
  label: string
  href?: string
}

const SEGMENT_LABELS: Record<string, string> = {
  dashboard: 'Dashboard',
  documents: 'Documents',
  templates: 'Templates',
  settings: 'Settings',
  upload: 'Upload',
  account: 'Account',
  'ai-models': 'AI Models',
  developer: 'Developer',
  notifications: 'Notifications',
  appearance: 'Appearance',
  billing: 'Billing',
  integrations: 'Integrations',
  organization: 'Organization',
  webhooks: 'Webhooks',
}

function isUuid(segment: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(segment)
}

function isNumericId(segment: string): boolean {
  return /^\d+$/.test(segment)
}

export function useBreadcrumbs(): BreadcrumbItem[] {
  const { pathname } = useLocation()
  const queryClient = useQueryClient()

  const segments = pathname.split('/').filter(Boolean)

  // Filter out layout segments (prefixed with _ or wrapped in parens)
  const visibleSegments = segments.filter(
    (s) => !s.startsWith('_') && !s.startsWith('(')
  )

  if (visibleSegments.length === 0) return []

  const items: BreadcrumbItem[] = []

  for (let i = 0; i < visibleSegments.length; i++) {
    const segment = visibleSegments[i]
    const isLast = i === visibleSegments.length - 1
    const href = '/' + visibleSegments.slice(0, i + 1).join('/')

    if (isUuid(segment) || isNumericId(segment)) {
      // Try to get a human-readable name from query cache
      const parentSegment = visibleSegments[i - 1]
      let label = segment.slice(0, 8) + '...'

      if (parentSegment === 'documents') {
        const cached = queryClient.getQueryData<{ name?: string; file_name?: string }>([
          'processedDocument',
          segment,
        ])
        if (cached?.name || cached?.file_name) {
          label = (cached.name || cached.file_name)!
        }
      } else if (parentSegment === 'templates') {
        const cached = queryClient.getQueryData<{ name?: string }>([
          'template',
          segment,
        ])
        if (cached?.name) {
          label = cached.name
        }
      }

      items.push({ label, href: isLast ? undefined : href })
    } else {
      const label = SEGMENT_LABELS[segment] || segment.charAt(0).toUpperCase() + segment.slice(1)
      items.push({ label, href: isLast ? undefined : href })
    }
  }

  return items
}
