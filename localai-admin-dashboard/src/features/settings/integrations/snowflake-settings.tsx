/**
 * Snowflake Settings Component
 *
 * Allows users to connect their Snowflake account using either:
 * - Key-Pair authentication (credential fields form)
 * - OAuth (SSO) via a Snowflake Security Integration
 *
 * Uses tabs to switch between the two auth methods.
 */

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { toast } from 'sonner'
import { AlertCircle, Loader2, Snowflake, Unlink, RefreshCw, KeyRound, ShieldCheck } from 'lucide-react'
import {
  integrationService,
  integrationKeys,
  type CredentialField,
} from '@/lib/services/integration-service'
import { useOrganization } from '@/context/organization-context'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

function SnowflakeIcon({ className }: { className?: string }) {
  return <Snowflake className={className} />
}

export function SnowflakeSettings() {
  const { activeOrganization } = useOrganization()
  const queryClient = useQueryClient()
  const [connecting, setConnecting] = useState(false)
  const [testing, setTesting] = useState(false)
  const [credentials, setCredentials] = useState<Record<string, string>>({})

  // OAuth form state
  const [oauthAccount, setOauthAccount] = useState('')
  const [oauthClientId, setOauthClientId] = useState('')
  const [oauthClientSecret, setOauthClientSecret] = useState('')
  const [connectingOAuth, setConnectingOAuth] = useState(false)

  // Fetch available integrations
  const { data: integrations, isLoading: loadingIntegrations } = useQuery({
    queryKey: integrationKeys.list(),
    queryFn: () => integrationService.listIntegrations(),
  })

  // Fetch Snowflake status
  const { data: snowflakeStatus, refetch } = useQuery({
    queryKey: integrationKeys.status(
      activeOrganization?.id || '',
      'snowflake'
    ),
    queryFn: () =>
      integrationService.getIntegrationStatus(
        activeOrganization!.id,
        'snowflake'
      ),
    enabled: !!activeOrganization?.id,
  })

  const snowflakeConfig = integrations?.find((i) => i.id === 'snowflake')
  const isConnected = snowflakeStatus?.status === 'connected'
  const authMethod = (snowflakeStatus?.metadata as Record<string, unknown>)?.auth_method as string | undefined

  const handleConnect = async () => {
    if (!activeOrganization) return

    setConnecting(true)
    try {
      await integrationService.connectWithCredentials(
        activeOrganization.id,
        'snowflake',
        credentials
      )
      toast.success('Snowflake connected successfully')
      setCredentials({})
      queryClient.invalidateQueries({ queryKey: integrationKeys.all })
      refetch()
    } catch (error) {
      toast.error('Failed to connect Snowflake', {
        description:
          error instanceof Error ? error.message : 'Unknown error occurred',
      })
    } finally {
      setConnecting(false)
    }
  }

  const handleConnectOAuth = async () => {
    if (!activeOrganization) return
    if (!oauthAccount || !oauthClientId || !oauthClientSecret) {
      toast.error('Please fill in all OAuth fields')
      return
    }

    setConnectingOAuth(true)
    try {
      const { authorization_url } = await integrationService.initiateSnowflakeOAuth(
        activeOrganization.id,
        oauthAccount,
        oauthClientId,
        oauthClientSecret
      )
      // Redirect to Snowflake OAuth consent screen
      window.location.href = authorization_url
    } catch (error) {
      toast.error('Failed to initiate Snowflake OAuth', {
        description:
          error instanceof Error ? error.message : 'Unknown error occurred',
      })
      setConnectingOAuth(false)
    }
  }

  const handleTestConnection = async () => {
    if (!activeOrganization) return

    setTesting(true)
    try {
      const result = await integrationService.testConnection(
        activeOrganization.id,
        'snowflake'
      )
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

  const handleDisconnect = async () => {
    if (!activeOrganization) return

    try {
      await integrationService.disconnectIntegration(
        activeOrganization.id,
        'snowflake'
      )
      toast.success('Snowflake disconnected')
      queryClient.invalidateQueries({ queryKey: integrationKeys.all })
      refetch()
    } catch (error) {
      toast.error('Failed to disconnect', {
        description:
          error instanceof Error ? error.message : 'Unknown error occurred',
      })
    }
  }

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
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
              <SnowflakeIcon className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="flex items-center gap-2">
                Snowflake Stages
                {isConnected && (
                  <Badge
                    variant="default"
                    className="bg-green-100 text-green-800"
                  >
                    Connected
                  </Badge>
                )}
                {isConnected && authMethod && (
                  <Badge variant="outline" className="text-xs">
                    {authMethod === 'oauth' ? 'OAuth' : 'Key-Pair'}
                  </Badge>
                )}
              </CardTitle>
              <CardDescription>
                Browse and import documents from Snowflake Stages for processing
              </CardDescription>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isConnected ? (
          <div className="space-y-4">
            {/* Account details */}
            {snowflakeStatus?.metadata &&
              Object.keys(snowflakeStatus.metadata).length > 0 && (
                <div className="rounded-md bg-muted/50 p-3">
                  <p className="text-sm font-medium">Account Details</p>
                  <dl className="mt-2 space-y-1 text-sm">
                    {(snowflakeStatus.metadata as Record<string, unknown>).account_identifier && (
                      <div className="flex justify-between">
                        <dt className="text-muted-foreground">Account</dt>
                        <dd>
                          {String((snowflakeStatus.metadata as Record<string, unknown>).account_identifier)}
                        </dd>
                      </div>
                    )}
                    {(snowflakeStatus.metadata as Record<string, unknown>).username && (
                      <div className="flex justify-between">
                        <dt className="text-muted-foreground">Username</dt>
                        <dd>{String((snowflakeStatus.metadata as Record<string, unknown>).username)}</dd>
                      </div>
                    )}
                    {(snowflakeStatus.metadata as Record<string, unknown>).warehouse && (
                      <div className="flex justify-between">
                        <dt className="text-muted-foreground">Warehouse</dt>
                        <dd>{String((snowflakeStatus.metadata as Record<string, unknown>).warehouse)}</dd>
                      </div>
                    )}
                    {authMethod && (
                      <div className="flex justify-between">
                        <dt className="text-muted-foreground">Auth Method</dt>
                        <dd>{authMethod === 'oauth' ? 'OAuth (SSO)' : 'Key-Pair'}</dd>
                      </div>
                    )}
                  </dl>
                </div>
              )}

            {snowflakeStatus?.connected_at && (
              <p className="text-sm text-muted-foreground">
                Connected{' '}
                {new Date(snowflakeStatus.connected_at).toLocaleDateString()}
              </p>
            )}

            {/* Actions */}
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleTestConnection}
                disabled={testing}
              >
                {testing ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="mr-2 h-4 w-4" />
                )}
                Test Connection
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleDisconnect}
              >
                <Unlink className="mr-2 h-4 w-4" />
                Disconnect
              </Button>
            </div>
          </div>
        ) : (
          <Tabs defaultValue="keypair" className="w-full">
            <TabsList>
              <TabsTrigger value="keypair">
                <KeyRound className="mr-1.5 h-3.5 w-3.5" />
                Key-Pair
              </TabsTrigger>
              <TabsTrigger value="oauth">
                <ShieldCheck className="mr-1.5 h-3.5 w-3.5" />
                OAuth (SSO)
              </TabsTrigger>
            </TabsList>

            {/* Key-Pair Auth Tab */}
            <TabsContent value="keypair">
              <div className="space-y-4 pt-2">
                <p className="text-sm text-muted-foreground">
                  Connect using RSA key-pair authentication. Generate a key pair
                  and assign the public key to your Snowflake user.
                </p>

                {/* Dynamic credential form */}
                {snowflakeConfig?.credential_fields?.map(
                  (field: CredentialField) => (
                    <div key={field.name} className="space-y-2">
                      <Label htmlFor={`sf-${field.name}`}>
                        {field.label}
                        {field.required === 'true' && (
                          <span className="text-destructive"> *</span>
                        )}
                      </Label>
                      {field.type === 'textarea' ? (
                        <Textarea
                          id={`sf-${field.name}`}
                          placeholder={field.placeholder}
                          value={credentials[field.name] || ''}
                          onChange={(e) =>
                            setCredentials((prev) => ({
                              ...prev,
                              [field.name]: e.target.value,
                            }))
                          }
                          rows={5}
                          className="font-mono text-xs"
                        />
                      ) : (
                        <Input
                          id={`sf-${field.name}`}
                          type={field.type === 'password' ? 'password' : 'text'}
                          placeholder={field.placeholder}
                          value={credentials[field.name] || ''}
                          onChange={(e) =>
                            setCredentials((prev) => ({
                              ...prev,
                              [field.name]: e.target.value,
                            }))
                          }
                        />
                      )}
                      {field.help && (
                        <p className="text-xs text-muted-foreground">{field.help}</p>
                      )}
                    </div>
                  )
                )}

                <Button onClick={handleConnect} disabled={connecting}>
                  {connecting ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <KeyRound className="mr-2 h-4 w-4" />
                  )}
                  Connect with Key-Pair
                </Button>
              </div>
            </TabsContent>

            {/* OAuth Tab */}
            <TabsContent value="oauth">
              <div className="space-y-4 pt-2">
                <p className="text-sm text-muted-foreground">
                  Connect using Snowflake OAuth (SSO). Your Snowflake admin must
                  first create a Security Integration.
                </p>

                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Prerequisites</AlertTitle>
                  <AlertDescription className="text-xs">
                    <p className="mb-2">
                      A Snowflake admin must run the following SQL to create a
                      Security Integration:
                    </p>
                    <pre className="rounded bg-muted p-2 text-xs overflow-x-auto">
{`CREATE SECURITY INTEGRATION fetchtext_oauth
  TYPE = OAUTH
  ENABLED = TRUE
  OAUTH_CLIENT = CUSTOM
  OAUTH_CLIENT_TYPE = 'CONFIDENTIAL'
  OAUTH_REDIRECT_URI = '${window.location.origin.replace('5173', '8090')}/api/integrations/snowflake/oauth/callback'
  OAUTH_ISSUE_REFRESH_TOKENS = TRUE
  OAUTH_REFRESH_TOKEN_VALIDITY = 86400;`}
                    </pre>
                    <p className="mt-2">
                      Then run <code className="bg-muted px-1 rounded">DESCRIBE INTEGRATION fetchtext_oauth</code> to
                      get the Client ID and Client Secret.
                    </p>
                  </AlertDescription>
                </Alert>

                <div className="space-y-2">
                  <Label htmlFor="sf-oauth-account">
                    Account Identifier <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="sf-oauth-account"
                    placeholder="uzdboxw-snb92059"
                    value={oauthAccount}
                    onChange={(e) => setOauthAccount(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Your Snowflake account identifier (e.g., uzdboxw-snb92059)
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="sf-oauth-client-id">
                    Client ID <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="sf-oauth-client-id"
                    placeholder="From DESCRIBE INTEGRATION output"
                    value={oauthClientId}
                    onChange={(e) => setOauthClientId(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="sf-oauth-client-secret">
                    Client Secret <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="sf-oauth-client-secret"
                    type="password"
                    placeholder="From DESCRIBE INTEGRATION output"
                    value={oauthClientSecret}
                    onChange={(e) => setOauthClientSecret(e.target.value)}
                  />
                </div>

                <Button onClick={handleConnectOAuth} disabled={connectingOAuth}>
                  {connectingOAuth ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <ShieldCheck className="mr-2 h-4 w-4" />
                  )}
                  Connect with OAuth
                </Button>
              </div>
            </TabsContent>
          </Tabs>
        )}
      </CardContent>
    </Card>
  )
}
