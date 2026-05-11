import { useEffect, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useOrganization } from '@/context/organization-context'
import { integrationService, integrationKeys } from '@/lib/services/integration-service'
import { IntegrationCard } from '@/components/integrations/IntegrationCard'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

export function SharePointSettings() {
  const { activeOrganization } = useOrganization()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const [callbackProcessed, setCallbackProcessed] = useState(false)

  const { data: integrations, isLoading: loadingIntegrations } = useQuery({
    queryKey: integrationKeys.list(),
    queryFn: () => integrationService.listIntegrations(),
  })

  const { data: microsoftStatus, refetch } = useQuery({
    queryKey: integrationKeys.status(activeOrganization?.id || '', 'microsoft'),
    queryFn: () => integrationService.getIntegrationStatus(activeOrganization!.id, 'microsoft'),
    enabled: !!activeOrganization?.id,
  })

  // Handle OAuth callback
  useEffect(() => {
    if (callbackProcessed) return
    const urlParams = new URLSearchParams(window.location.search)
    const success = urlParams.get('success')
    const error = urlParams.get('error')

    if (success === 'true') {
      setCallbackProcessed(true)
      toast.success('Microsoft 365 connected successfully')
      navigate({ to: '/settings/integrations', search: {}, replace: true })
      if (activeOrganization?.id) refetch()
    } else if (error) {
      setCallbackProcessed(true)
      toast.error('Failed to connect Microsoft 365', { description: decodeURIComponent(error) })
      navigate({ to: '/settings/integrations', search: {}, replace: true })
    }
  }, [callbackProcessed, navigate, refetch, activeOrganization?.id])

  if (loadingIntegrations) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="mt-2 h-4 w-64" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-24 w-full" />
        </CardContent>
      </Card>
    )
  }

  if (!activeOrganization) return null

  const microsoftConfig = integrations?.find((i) => i.id === 'microsoft')

  return (
    <IntegrationCard
      id="microsoft"
      name="SharePoint & OneDrive"
      description="Browse, import, and export documents with SharePoint sites and OneDrive. Watch folders for automatic processing."
      icon={<MicrosoftIcon className="h-5 w-5" />}
      status={microsoftStatus?.status || 'disconnected'}
      configured={microsoftConfig?.configured ?? false}
      scopes={microsoftStatus?.scopes}
      metadata={microsoftStatus?.metadata}
      lastError={microsoftStatus?.last_error}
      connectedAt={microsoftStatus?.connected_at}
      tokenExpiresAt={microsoftStatus?.token_expires_at}
      organizationId={activeOrganization.id}
      onConnected={() => {
        queryClient.invalidateQueries({ queryKey: integrationKeys.status(activeOrganization.id, 'microsoft') })
      }}
      onDisconnected={() => {
        queryClient.invalidateQueries({ queryKey: integrationKeys.status(activeOrganization.id, 'microsoft') })
      }}
      scopePreset="sharepoint"
    />
  )
}

function MicrosoftIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 23 23" fill="none">
      <rect x="1" y="1" width="10" height="10" fill="#F25022" />
      <rect x="12" y="1" width="10" height="10" fill="#7FBA00" />
      <rect x="1" y="12" width="10" height="10" fill="#00A4EF" />
      <rect x="12" y="12" width="10" height="10" fill="#FFB900" />
    </svg>
  )
}
