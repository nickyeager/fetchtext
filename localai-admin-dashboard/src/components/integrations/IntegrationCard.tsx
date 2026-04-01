/**
 * IntegrationCard Component
 *
 * Reusable card component for displaying and managing OAuth integrations.
 * Used in Settings > Integrations to show connection status and actions.
 */

import { useState } from 'react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  AlertCircle,
  Check,
  RefreshCw,
  Unlink,
  ExternalLink,
  Loader2,
  Clock,
  AlertTriangle,
} from 'lucide-react'
import {
  integrationService,
  type IntegrationType,
  type IntegrationStatus,
} from '@/lib/services/integration-service'
import { toast } from 'sonner'

// =============================================================================
// Types
// =============================================================================

interface IntegrationCardProps {
  /** Integration identifier */
  id: IntegrationType
  /** Display name */
  name: string
  /** Description of what the integration does */
  description: string
  /** Icon component or element */
  icon: React.ReactNode
  /** Current connection status */
  status: IntegrationStatus
  /** Whether the integration has credentials configured on backend */
  configured?: boolean
  /** Granted OAuth scopes */
  scopes?: string[]
  /** Additional metadata (e.g., connected account) */
  metadata?: Record<string, unknown>
  /** Error message if status is 'error' */
  lastError?: string
  /** When the connection was established */
  connectedAt?: string
  /** When the token expires */
  tokenExpiresAt?: string
  /** Organization ID for API calls */
  organizationId: string
  /** Callback after successful connection */
  onConnected?: () => void
  /** Callback after disconnection */
  onDisconnected?: () => void
  /** Optional scope preset to request */
  scopePreset?: string
}

// =============================================================================
// Status Badge Component
// =============================================================================

function StatusBadge({ status }: { status: IntegrationStatus }) {
  switch (status) {
    case 'connected':
      return (
        <Badge variant="default" className="bg-green-100 text-green-800">
          <Check className="mr-1 h-3 w-3" />
          Connected
        </Badge>
      )
    case 'expired':
      return (
        <Badge variant="destructive">
          <Clock className="mr-1 h-3 w-3" />
          Expired
        </Badge>
      )
    case 'error':
      return (
        <Badge variant="destructive">
          <AlertCircle className="mr-1 h-3 w-3" />
          Error
        </Badge>
      )
    case 'pending':
      return (
        <Badge variant="secondary">
          <Loader2 className="mr-1 h-3 w-3 animate-spin" />
          Pending
        </Badge>
      )
    case 'revoked':
      return (
        <Badge variant="outline">
          <Unlink className="mr-1 h-3 w-3" />
          Revoked
        </Badge>
      )
    default:
      return null
  }
}

// =============================================================================
// Connected State Component
// =============================================================================

interface ConnectedStateProps {
  scopes?: string[]
  metadata?: Record<string, unknown>
  connectedAt?: string
  tokenExpiresAt?: string
  onTest: () => void
  onRefresh: () => void
  onDisconnect: () => void
  testing: boolean
  refreshing: boolean
}

function ConnectedState({
  scopes,
  metadata,
  connectedAt,
  onTest,
  onRefresh,
  onDisconnect,
  testing,
  refreshing,
}: ConnectedStateProps) {
  return (
    <div className="space-y-4">
      {/* Connection Info */}
      {connectedAt && (
        <p className="text-sm text-muted-foreground">
          Connected {new Date(connectedAt).toLocaleDateString()}
        </p>
      )}

      {/* Metadata (e.g., account info) */}
      {metadata && Object.keys(metadata).length > 0 && (
        <div className="rounded-md bg-muted/50 p-3">
          <p className="text-sm font-medium">Account Details</p>
          <dl className="mt-2 space-y-1 text-sm">
            {Object.entries(metadata).map(([key, value]) => (
              <div key={key} className="flex justify-between">
                <dt className="text-muted-foreground">{formatKey(key)}</dt>
                <dd>{String(value)}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}

      {/* Scopes */}
      {scopes && scopes.length > 0 && (
        <div>
          <p className="mb-2 text-sm font-medium">Permissions</p>
          <div className="flex flex-wrap gap-1">
            {scopes.map((scope) => (
              <Badge key={scope} variant="outline" className="text-xs">
                {formatScope(scope)}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={onTest} disabled={testing}>
          {testing ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="mr-2 h-4 w-4" />
          )}
          Test Connection
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={onRefresh}
          disabled={refreshing}
        >
          {refreshing ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="mr-2 h-4 w-4" />
          )}
          Refresh Token
        </Button>
        <Button variant="destructive" size="sm" onClick={onDisconnect}>
          <Unlink className="mr-2 h-4 w-4" />
          Disconnect
        </Button>
      </div>
    </div>
  )
}

// =============================================================================
// Disconnected State Component
// =============================================================================

interface DisconnectedStateProps {
  configured: boolean
  description: string
  onConnect: () => void
  connecting: boolean
}

function DisconnectedState({
  configured,
  description,
  onConnect,
  connecting,
}: DisconnectedStateProps) {
  if (!configured) {
    return (
      <div className="space-y-4">
        <div className="flex items-start gap-2 rounded-md bg-amber-50 p-3 text-amber-800">
          <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
          <div className="text-sm">
            <p className="font-medium">Not Configured</p>
            <p className="text-amber-700">
              This integration requires API credentials to be configured on the
              server. Contact your administrator.
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{description}</p>
      <Button onClick={onConnect} disabled={connecting}>
        {connecting ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <ExternalLink className="mr-2 h-4 w-4" />
        )}
        Connect
      </Button>
    </div>
  )
}

// =============================================================================
// Error State Component
// =============================================================================

interface ErrorStateProps {
  error: string
  onRetry: () => void
  onDisconnect: () => void
}

function ErrorState({ error, onRetry, onDisconnect }: ErrorStateProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-start gap-2 rounded-md bg-red-50 p-3 text-red-800">
        <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
        <div className="text-sm">
          <p className="font-medium">Connection Error</p>
          <p className="text-red-700">{error}</p>
        </div>
      </div>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={onRetry}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Retry
        </Button>
        <Button variant="destructive" size="sm" onClick={onDisconnect}>
          <Unlink className="mr-2 h-4 w-4" />
          Disconnect
        </Button>
      </div>
    </div>
  )
}

// =============================================================================
// Main IntegrationCard Component
// =============================================================================

export function IntegrationCard({
  id,
  name,
  description,
  icon,
  status,
  configured = true,
  scopes,
  metadata,
  lastError,
  connectedAt,
  tokenExpiresAt,
  organizationId,
  onConnected,
  onDisconnected,
  scopePreset,
}: IntegrationCardProps) {
  const [connecting, setConnecting] = useState(false)
  const [testing, setTesting] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  const handleConnect = async () => {
    setConnecting(true)
    try {
      await integrationService.connectIntegration(
        organizationId,
        id,
        scopePreset
      )
      // Note: This will redirect, so onConnected won't be called here
      onConnected?.()
    } catch (error) {
      toast.error('Failed to connect', {
        description:
          error instanceof Error ? error.message : 'Unknown error occurred',
      })
    } finally {
      setConnecting(false)
    }
  }

  const handleDisconnect = async () => {
    try {
      await integrationService.disconnectIntegration(organizationId, id)
      toast.success(`${name} disconnected`)
      onDisconnected?.()
    } catch (error) {
      toast.error('Failed to disconnect', {
        description:
          error instanceof Error ? error.message : 'Unknown error occurred',
      })
    }
  }

  const handleTest = async () => {
    setTesting(true)
    try {
      const result = await integrationService.testConnection(organizationId, id)
      if (result.success) {
        toast.success('Connection successful', {
          description: result.message,
        })
      } else {
        toast.error('Connection failed', {
          description: result.message,
        })
      }
    } catch (error) {
      toast.error('Test failed', {
        description:
          error instanceof Error ? error.message : 'Unknown error occurred',
      })
    } finally {
      setTesting(false)
    }
  }

  const handleRefresh = async () => {
    setRefreshing(true)
    try {
      const result = await integrationService.refreshToken(organizationId, id)
      if (result.success) {
        toast.success('Token refreshed', {
          description: `New token expires in ${Math.round((result.expires_in || 3600) / 60)} minutes`,
        })
      } else {
        toast.error('Refresh failed', {
          description: result.error,
        })
      }
    } catch (error) {
      toast.error('Refresh failed', {
        description:
          error instanceof Error ? error.message : 'Unknown error occurred',
      })
    } finally {
      setRefreshing(false)
    }
  }

  const isConnected = status === 'connected'
  const isError = status === 'error' || status === 'expired'
  const isPending = status === 'pending'

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
              {icon}
            </div>
            <div>
              <CardTitle className="flex items-center gap-2">
                {name}
                <StatusBadge status={status} />
              </CardTitle>
              <CardDescription>{description}</CardDescription>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isConnected && (
          <ConnectedState
            scopes={scopes}
            metadata={metadata}
            connectedAt={connectedAt}
            tokenExpiresAt={tokenExpiresAt}
            onTest={handleTest}
            onRefresh={handleRefresh}
            onDisconnect={handleDisconnect}
            testing={testing}
            refreshing={refreshing}
          />
        )}
        {isError && lastError && (
          <ErrorState
            error={lastError}
            onRetry={handleConnect}
            onDisconnect={handleDisconnect}
          />
        )}
        {isPending && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Authorization is pending. If you did not complete the OAuth flow or
              got stuck, you can cancel and try again.
            </p>
            <Button variant="outline" size="sm" onClick={handleDisconnect}>
              <Unlink className="mr-2 h-4 w-4" />
              Cancel &amp; Reset
            </Button>
          </div>
        )}
        {!isConnected && !isError && !isPending && (
          <DisconnectedState
            configured={configured}
            description={description}
            onConnect={handleConnect}
            connecting={connecting}
          />
        )}
      </CardContent>
    </Card>
  )
}

// =============================================================================
// Utility Functions
// =============================================================================

function formatKey(key: string): string {
  return key
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (l) => l.toUpperCase())
}

function formatScope(scope: string): string {
  // Extract the last part of URL-like scopes
  if (scope.includes('/')) {
    const parts = scope.split('/')
    return parts[parts.length - 1]
  }
  return scope
}

// =============================================================================
// Export
// =============================================================================

export default IntegrationCard
