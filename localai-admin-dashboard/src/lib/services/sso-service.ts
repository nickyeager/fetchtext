import { supabase } from '@/lib/supabase'

const BACKEND_URL = import.meta.env.VITE_DOCUMENT_PROCESSOR_URL || 'http://localhost:8090'

interface SSOStatus {
  configured: boolean
  domain: string | null
  idp_name: string | null
  sso_provider_id: string | null
  auto_provision: boolean
  default_role: string
  acs_url: string
  metadata_url: string
  entity_id: string
}

interface SSOConfigurePayload {
  domain: string
  idp_name?: string
  metadata_url?: string
  metadata_xml?: string
  auto_provision?: boolean
  default_role?: string
}

interface DomainCheckResult {
  domain: string
  has_sso: boolean
  organization_name: string | null
}

async function getAuthHeaders(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.access_token) throw new Error('Not authenticated')
  return {
    Authorization: `Bearer ${session.access_token}`,
    'Content-Type': 'application/json',
  }
}

export const ssoService = {
  async getStatus(organizationId: string): Promise<SSOStatus> {
    const headers = await getAuthHeaders()
    const resp = await fetch(
      `${BACKEND_URL}/api/sso/status?organization_id=${organizationId}`,
      { headers },
    )
    if (!resp.ok) throw new Error(`SSO status failed: ${resp.status}`)
    return resp.json()
  },

  async configure(organizationId: string, payload: SSOConfigurePayload): Promise<SSOStatus> {
    const headers = await getAuthHeaders()
    const resp = await fetch(
      `${BACKEND_URL}/api/sso/configure?organization_id=${organizationId}`,
      { method: 'POST', headers, body: JSON.stringify(payload) },
    )
    if (!resp.ok) throw new Error(`SSO configure failed: ${resp.status}`)
    return resp.json()
  },

  async update(organizationId: string, updates: Partial<SSOConfigurePayload>): Promise<void> {
    const headers = await getAuthHeaders()
    const resp = await fetch(
      `${BACKEND_URL}/api/sso/update?organization_id=${organizationId}`,
      { method: 'PATCH', headers, body: JSON.stringify(updates) },
    )
    if (!resp.ok) throw new Error(`SSO update failed: ${resp.status}`)
  },

  async remove(organizationId: string): Promise<void> {
    const headers = await getAuthHeaders()
    const resp = await fetch(
      `${BACKEND_URL}/api/sso/remove?organization_id=${organizationId}`,
      { method: 'DELETE', headers },
    )
    if (!resp.ok) throw new Error(`SSO remove failed: ${resp.status}`)
  },

  async checkDomain(domain: string): Promise<DomainCheckResult> {
    const resp = await fetch(`${BACKEND_URL}/api/sso/check-domain?domain=${domain}`)
    if (!resp.ok) throw new Error(`Domain check failed: ${resp.status}`)
    return resp.json()
  },

  async provision(ssoProviderId: string): Promise<{ organization_id: string; role: string }> {
    const headers = await getAuthHeaders()
    const resp = await fetch(
      `${BACKEND_URL}/api/sso/provision`,
      { method: 'POST', headers, body: JSON.stringify({ sso_provider_id: ssoProviderId }) },
    )
    if (!resp.ok) throw new Error(`SSO provision failed: ${resp.status}`)
    return resp.json()
  },
}

export type { SSOStatus, SSOConfigurePayload, DomainCheckResult }
