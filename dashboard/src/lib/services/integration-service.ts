/**
 * Integration Service
 *
 * Client for managing OAuth integrations (Google, QuickBooks, Microsoft, etc.)
 * Communicates with the document-processor backend's /api/integrations endpoints.
 */

import { supabase } from '@/lib/supabase'
import { withAuthentication } from '@/lib/supabase-auth-utils'

// =============================================================================
// Types
// =============================================================================

export type IntegrationType =
  | 'google'
  | 'quickbooks'
  | 'microsoft'
  | 'dropbox'
  | 'slack'
  | 'xero'
  | 'snowflake'

export type IntegrationStatus =
  | 'pending'
  | 'connected'
  | 'expired'
  | 'revoked'
  | 'error'
  | 'disconnected'

export interface CredentialField {
  name: string
  label: string
  type: string // text, password, textarea
  required: string
  placeholder?: string
  help?: string
}

export interface IntegrationInfo {
  id: string
  name: string
  description: string
  icon: string
  configured: boolean
  auth_mode: 'oauth' | 'credential' | 'dual'
  auth_modes?: string[] // For dual-mode: ["credential", "oauth"]
  credential_fields?: CredentialField[]
  scope_presets: string[]
  features: {
    refresh: boolean
    revoke: boolean
  }
}

export interface OrganizationIntegration {
  id?: string
  integration_type: IntegrationType
  status: IntegrationStatus
  scopes: string[]
  metadata: Record<string, unknown>
  last_error?: string
  last_sync_at?: string
  connected_at?: string
  token_expires_at?: string
}

export interface OAuthInitiateResponse {
  authorization_url: string
  state: string
}

export interface TokenRefreshResult {
  success: boolean
  error?: string
  expires_in?: number
  new_expires_at?: string
}

export interface ConnectionTestResult {
  success: boolean
  message: string
  user_info?: Record<string, unknown>
}

// =============================================================================
// Configuration
// =============================================================================

// MUST be set via VITE_DOCUMENT_PROCESSOR_URL - no localhost fallback
const DOCUMENT_PROCESSOR_URL = import.meta.env.VITE_DOCUMENT_PROCESSOR_URL || ''

if (!DOCUMENT_PROCESSOR_URL && import.meta.env.DEV) {
  console.warn('[Integration Service] VITE_DOCUMENT_PROCESSOR_URL is not set. Integration features will not work.')
}

// =============================================================================
// Integration Service Class
// =============================================================================

class IntegrationService {
  private baseUrl: string

  constructor() {
    this.baseUrl = `${DOCUMENT_PROCESSOR_URL}/api/integrations`
  }

  /**
   * Get auth headers from the current Supabase session.
   * Required for all endpoints that use admin_auth on the backend.
   */
  private async getAuthHeaders(): Promise<Record<string, string>> {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.access_token) {
      throw new Error('Not authenticated')
    }
    return {
      Authorization: `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
    }
  }

  // ===========================================================================
  // List Available Integrations
  // ===========================================================================

  /**
   * Get all available integrations
   */
  async listIntegrations(configuredOnly = false): Promise<IntegrationInfo[]> {
    const url = new URL(this.baseUrl)
    if (configuredOnly) {
      url.searchParams.set('configured_only', 'true')
    }

    const response = await fetch(url.toString())
    if (!response.ok) {
      throw new Error(`Failed to list integrations: ${response.status}`)
    }

    return response.json()
  }

  /**
   * Get detailed info about a specific integration
   */
  async getIntegrationInfo(integrationType: IntegrationType): Promise<IntegrationInfo> {
    const response = await fetch(`${this.baseUrl}/${integrationType}`)
    if (!response.ok) {
      throw new Error(`Integration not found: ${integrationType}`)
    }

    return response.json()
  }

  // ===========================================================================
  // OAuth Flow
  // ===========================================================================

  /**
   * Initiate OAuth flow for an integration
   *
   * @param organizationId - Organization initiating the connection
   * @param integrationType - Type of integration (google, quickbooks, etc.)
   * @param scopePreset - Optional scope preset (default, full, etc.)
   * @returns Authorization URL to redirect user to
   */
  async initiateOAuth(
    organizationId: string,
    integrationType: IntegrationType,
    scopePreset?: string
  ): Promise<OAuthInitiateResponse> {
    // Build redirect URI for OAuth callback
    const redirectUri = `${DOCUMENT_PROCESSOR_URL}/api/integrations/${integrationType}/oauth/callback`

    const url = new URL(`${this.baseUrl}/${integrationType}/oauth/initiate`)
    url.searchParams.set('organization_id', organizationId)
    url.searchParams.set('redirect_uri', redirectUri)
    if (scopePreset) {
      url.searchParams.set('scope_preset', scopePreset)
    }

    // Get current user ID for audit
    const { data: { user } } = await supabase.auth.getUser()
    if (user?.id) {
      url.searchParams.set('user_id', user.id)
    }

    const headers = await this.getAuthHeaders()
    const response = await fetch(url.toString(), { headers })
    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.detail || 'Failed to initiate OAuth')
    }

    return response.json()
  }

  /**
   * Start OAuth flow by redirecting to the provider
   *
   * This is a convenience method that initiates OAuth and redirects the browser.
   */
  async connectIntegration(
    organizationId: string,
    integrationType: IntegrationType,
    scopePreset?: string
  ): Promise<void> {
    const { authorization_url } = await this.initiateOAuth(
      organizationId,
      integrationType,
      scopePreset
    )

    // Redirect to OAuth provider
    window.location.href = authorization_url
  }

  // ===========================================================================
  // Credential-Based Connection
  // ===========================================================================

  /**
   * Connect an integration using direct credentials (non-OAuth).
   *
   * Used for integrations like Snowflake that use key-pair auth.
   */
  async connectWithCredentials(
    organizationId: string,
    integrationType: IntegrationType,
    credentials: Record<string, string>
  ): Promise<{ success: boolean; message: string; metadata?: Record<string, unknown> }> {
    const headers = await this.getAuthHeaders()
    const response = await fetch(
      `${this.baseUrl}/${integrationType}/connect-credentials`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({
          organization_id: organizationId,
          credentials,
        }),
      }
    )

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.detail || 'Failed to connect with credentials')
    }

    return response.json()
  }

  // ===========================================================================
  // Per-Account OAuth (Snowflake)
  // ===========================================================================

  /**
   * Initiate OAuth flow for Snowflake (per-account OAuth).
   *
   * The customer provides their own client_id and client_secret from
   * their Snowflake Security Integration (DESCRIBE INTEGRATION output).
   */
  async initiateSnowflakeOAuth(
    organizationId: string,
    accountIdentifier: string,
    clientId: string,
    clientSecret: string
  ): Promise<OAuthInitiateResponse> {
    const redirectUri = `${DOCUMENT_PROCESSOR_URL}/api/integrations/snowflake/oauth/callback`

    const headers = await this.getAuthHeaders()
    const response = await fetch(
      `${this.baseUrl}/snowflake/oauth/initiate-with-account`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({
          organization_id: organizationId,
          account_identifier: accountIdentifier,
          client_id: clientId,
          client_secret: clientSecret,
          redirect_uri: redirectUri,
        }),
      }
    )

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.detail || 'Failed to initiate Snowflake OAuth')
    }

    return response.json()
  }

  // ===========================================================================
  // Integration Status
  // ===========================================================================

  /**
   * Get status of a specific integration for an organization
   */
  async getIntegrationStatus(
    organizationId: string,
    integrationType: IntegrationType
  ): Promise<OrganizationIntegration> {
    const url = new URL(`${this.baseUrl}/${integrationType}/status`)
    url.searchParams.set('organization_id', organizationId)

    const headers = await this.getAuthHeaders()
    const response = await fetch(url.toString(), { headers })
    if (!response.ok) {
      throw new Error(`Failed to get integration status: ${response.status}`)
    }

    return response.json()
  }

  /**
   * Get status of all integrations for an organization
   *
   * Returns a map of integration type to status, useful for settings page.
   */
  async getAllIntegrationStatuses(
    organizationId: string
  ): Promise<Record<IntegrationType, Partial<OrganizationIntegration>>> {
    const url = new URL(`${this.baseUrl}/status/all`)
    url.searchParams.set('organization_id', organizationId)

    const headers = await this.getAuthHeaders()
    const response = await fetch(url.toString(), { headers })
    if (!response.ok) {
      throw new Error(`Failed to get integration statuses: ${response.status}`)
    }

    return response.json()
  }

  /**
   * Check if an integration is connected
   */
  async isConnected(
    organizationId: string,
    integrationType: IntegrationType
  ): Promise<boolean> {
    try {
      const status = await this.getIntegrationStatus(organizationId, integrationType)
      return status.status === 'connected'
    } catch {
      return false
    }
  }

  // ===========================================================================
  // Token Management
  // ===========================================================================

  /**
   * Manually refresh an integration's access token
   */
  async refreshToken(
    organizationId: string,
    integrationType: IntegrationType
  ): Promise<TokenRefreshResult> {
    const url = new URL(`${this.baseUrl}/${integrationType}/refresh`)
    url.searchParams.set('organization_id', organizationId)

    const headers = await this.getAuthHeaders()
    const response = await fetch(url.toString(), { method: 'POST', headers })
    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.detail || 'Failed to refresh token')
    }

    return response.json()
  }

  /**
   * Disconnect an integration
   *
   * This will revoke tokens and update status to 'revoked'.
   */
  async disconnectIntegration(
    organizationId: string,
    integrationType: IntegrationType
  ): Promise<void> {
    const url = new URL(`${this.baseUrl}/${integrationType}/disconnect`)
    url.searchParams.set('organization_id', organizationId)

    const headers = await this.getAuthHeaders()
    const response = await fetch(url.toString(), { method: 'DELETE', headers })
    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.detail || 'Failed to disconnect integration')
    }
  }

  // ===========================================================================
  // Connection Testing
  // ===========================================================================

  /**
   * Test an integration connection
   *
   * Makes a simple API call to verify the connection is working.
   */
  async testConnection(
    organizationId: string,
    integrationType: IntegrationType
  ): Promise<ConnectionTestResult> {
    const url = new URL(`${this.baseUrl}/${integrationType}/test`)
    url.searchParams.set('organization_id', organizationId)

    const headers = await this.getAuthHeaders()
    const response = await fetch(url.toString(), { headers })
    if (!response.ok) {
      return {
        success: false,
        message: `Connection test failed: ${response.status}`,
      }
    }

    return response.json()
  }

  // ===========================================================================
  // Database Queries (via Supabase)
  // ===========================================================================

  /**
   * Get integrations from database directly
   *
   * This uses Supabase client for real-time updates and RLS.
   */
  async getIntegrationsFromDatabase(
    organizationId: string
  ): Promise<OrganizationIntegration[]> {
    return withAuthentication(async () => {
      const { data, error } = await supabase
        .from('organization_integrations')
        .select('*')
        .eq('organization_id', organizationId)
        .order('integration_type')

      if (error) throw error
      return (data || []) as OrganizationIntegration[]
    })
  }
}

// =============================================================================
// Export Singleton Instance
// =============================================================================

export const integrationService = new IntegrationService()

// =============================================================================
// React Query Keys
// =============================================================================

export const integrationKeys = {
  all: ['integrations'] as const,
  list: () => [...integrationKeys.all, 'list'] as const,
  detail: (type: IntegrationType) => [...integrationKeys.all, 'detail', type] as const,
  status: (orgId: string, type: IntegrationType) =>
    [...integrationKeys.all, 'status', orgId, type] as const,
  allStatuses: (orgId: string) =>
    [...integrationKeys.all, 'statuses', orgId] as const,
}
