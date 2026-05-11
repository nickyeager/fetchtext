/**
 * Google Drive Settings Component
 *
 * Allows users to connect their Google account for:
 * - Importing documents from Google Drive
 * - Generating Google Docs from extracted data
 *
 * Uses the existing OAuth infrastructure via IntegrationCard.
 */

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { AlertCircle } from 'lucide-react'
import { IntegrationCard } from '@/components/integrations/IntegrationCard'
import {
  integrationService,
  integrationKeys,
  type IntegrationType,
} from '@/lib/services/integration-service'
import { useOrganization } from '@/context/organization-context'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Card, CardContent, CardHeader } from '@/components/ui/card'

// Google icon SVG component
function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  )
}

export function GoogleDriveSettings() {
  const { activeOrganization } = useOrganization()
  const queryClient = useQueryClient()
  const navigate = useNavigate()

  // Track if we've already processed the OAuth callback to prevent duplicate processing
  const [callbackProcessed, setCallbackProcessed] = useState(false)

  // Fetch available integrations (to check if Google is configured on backend)
  const { data: integrations, isLoading: loadingIntegrations } = useQuery({
    queryKey: integrationKeys.list(),
    queryFn: () => integrationService.listIntegrations(),
  })

  // Fetch Google integration status for this organization
  const {
    data: googleStatus,
    refetch,
  } = useQuery({
    queryKey: integrationKeys.status(activeOrganization?.id || '', 'google'),
    queryFn: () =>
      integrationService.getIntegrationStatus(
        activeOrganization!.id,
        'google' as IntegrationType
      ),
    enabled: !!activeOrganization?.id,
  })

  // Handle OAuth callback - show toast and clear URL params
  // Using window.location.search directly for reliable OAuth callback handling
  useEffect(() => {
    // Skip if already processed to prevent duplicate toasts
    if (callbackProcessed) return

    const urlParams = new URLSearchParams(window.location.search)
    const success = urlParams.get('success')
    const error = urlParams.get('error')

    if (success === 'true') {
      setCallbackProcessed(true)
      toast.success('Google account connected successfully')
      // Clear URL params by navigating without them
      navigate({
        to: '/settings/integrations',
        search: {},
        replace: true,
      })
      // Refetch status if we have an active organization
      if (activeOrganization?.id) {
        refetch()
      }
    } else if (error) {
      setCallbackProcessed(true)
      toast.error('Failed to connect Google account', {
        description: decodeURIComponent(error),
      })
      navigate({
        to: '/settings/integrations',
        search: {},
        replace: true,
      })
    }
  }, [callbackProcessed, navigate, refetch, activeOrganization?.id])

  // Get Google config from integrations list
  const googleConfig = integrations?.find((i) => i.id === 'google')

  // Loading state
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

  // No organization selected
  if (!activeOrganization) {
    return (
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>No Organization Selected</AlertTitle>
        <AlertDescription>
          Please select an organization from the sidebar to configure
          integrations.
        </AlertDescription>
      </Alert>
    )
  }

  return (
    <IntegrationCard
      id="google"
      name="Google Drive & Docs"
      description="Import documents from Google Drive and generate Google Docs from extracted data"
      icon={<GoogleIcon className="h-5 w-5" />}
      status={googleStatus?.status || 'disconnected'}
      configured={googleConfig?.configured ?? false}
      scopes={googleStatus?.scopes}
      metadata={googleStatus?.metadata}
      lastError={googleStatus?.last_error}
      connectedAt={googleStatus?.connected_at}
      tokenExpiresAt={googleStatus?.token_expires_at}
      organizationId={activeOrganization.id}
      onConnected={() => {
        queryClient.invalidateQueries({ queryKey: integrationKeys.all })
        refetch()
      }}
      onDisconnected={() => {
        queryClient.invalidateQueries({ queryKey: integrationKeys.all })
        refetch()
      }}
      scopePreset="default"
    />
  )
}
