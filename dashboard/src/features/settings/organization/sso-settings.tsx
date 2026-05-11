import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useOrganization } from '@/context/organization-context'
import { ssoService } from '@/lib/services/sso-service'
import type { SSOConfigurePayload } from '@/lib/services/sso-service'
import ContentSection from '../components/content-section'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { IconShieldLock, IconCopy, IconTrash } from '@tabler/icons-react'

export default function SSOSettings() {
  const { activeOrganization } = useOrganization()
  const queryClient = useQueryClient()
  const [showConfigForm, setShowConfigForm] = useState(false)

  // Form state
  const [domain, setDomain] = useState('')
  const [idpName, setIdpName] = useState('')
  const [metadataUrl, setMetadataUrl] = useState('')
  const [autoProvision, setAutoProvision] = useState(true)
  const [defaultRole, setDefaultRole] = useState('member')

  const queryKey = ['sso-status', activeOrganization?.id]

  const { data: ssoStatus, isLoading } = useQuery({
    queryKey,
    queryFn: () => ssoService.getStatus(activeOrganization!.id),
    enabled: !!activeOrganization?.id,
  })

  const configureMutation = useMutation({
    mutationFn: (payload: SSOConfigurePayload) =>
      ssoService.configure(activeOrganization!.id, payload),
    onSuccess: () => {
      toast.success('SSO configured successfully')
      queryClient.invalidateQueries({ queryKey })
      setShowConfigForm(false)
    },
    onError: (error: Error) => {
      toast.error('Failed to configure SSO', { description: error.message })
    },
  })

  const removeMutation = useMutation({
    mutationFn: () => ssoService.remove(activeOrganization!.id),
    onSuccess: () => {
      toast.success('SSO configuration removed')
      queryClient.invalidateQueries({ queryKey })
    },
    onError: (error: Error) => {
      toast.error('Failed to remove SSO', { description: error.message })
    },
  })

  const updateMutation = useMutation({
    mutationFn: (updates: Partial<SSOConfigurePayload>) =>
      ssoService.update(activeOrganization!.id, updates),
    onSuccess: () => {
      toast.success('SSO settings updated')
      queryClient.invalidateQueries({ queryKey })
    },
    onError: (error: Error) => {
      toast.error('Failed to update SSO', { description: error.message })
    },
  })

  function handleConfigure() {
    if (!domain) {
      toast.error('Domain is required')
      return
    }
    if (!metadataUrl) {
      toast.error('IdP metadata URL is required')
      return
    }
    configureMutation.mutate({
      domain,
      idp_name: idpName,
      metadata_url: metadataUrl,
      auto_provision: autoProvision,
      default_role: defaultRole,
    })
  }

  function handleRemove() {
    if (confirm('Are you sure you want to remove SSO configuration? Users will need to use password login.')) {
      removeMutation.mutate()
    }
  }

  function copyToClipboard(text: string, label: string) {
    navigator.clipboard.writeText(text)
    toast.success(`${label} copied to clipboard`)
  }

  if (!activeOrganization) {
    return (
      <ContentSection title="Single Sign-On" desc="Configure SAML 2.0 SSO for your organization.">
        <Alert>
          <AlertDescription>Please select an organization to configure SSO.</AlertDescription>
        </Alert>
      </ContentSection>
    )
  }

  if (isLoading) {
    return (
      <ContentSection title="Single Sign-On" desc="Configure SAML 2.0 SSO for your organization.">
        <div className="text-muted-foreground text-sm">Loading SSO status...</div>
      </ContentSection>
    )
  }

  return (
    <ContentSection title="Single Sign-On" desc="Configure SAML 2.0 SSO for your organization.">
      <div className="space-y-6">
        {/* Status Card */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <IconShieldLock size={20} />
                <CardTitle className="text-lg">SAML SSO</CardTitle>
              </div>
              <Badge variant={ssoStatus?.configured ? 'default' : 'secondary'}>
                {ssoStatus?.configured ? 'Configured' : 'Not Configured'}
              </Badge>
            </div>
            <CardDescription>
              Enable SAML 2.0 Single Sign-On for your organization. Users with matching email domains
              will be redirected to your Identity Provider.
            </CardDescription>
          </CardHeader>

          {ssoStatus?.configured && (
            <CardContent className="space-y-4">
              <div className="grid gap-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Domain</span>
                  <span className="font-medium">{ssoStatus.domain}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">IdP Name</span>
                  <span className="font-medium">{ssoStatus.idp_name || '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Auto-Provision</span>
                  <Switch
                    checked={ssoStatus.auto_provision}
                    onCheckedChange={(checked) =>
                      updateMutation.mutate({ auto_provision: checked })
                    }
                  />
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Default Role</span>
                  <Select
                    value={ssoStatus.default_role}
                    onValueChange={(value) =>
                      updateMutation.mutate({ default_role: value })
                    }
                  >
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="member">Member</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                      <SelectItem value="viewer">Viewer</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="pt-2">
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleRemove}
                  disabled={removeMutation.isPending}
                >
                  <IconTrash size={16} className="mr-1" />
                  Remove SSO
                </Button>
              </div>
            </CardContent>
          )}
        </Card>

        {/* SP Metadata — always shown so admin can set up IdP */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Service Provider Metadata</CardTitle>
            <CardDescription>
              Use these values when configuring your Identity Provider (Okta, Azure AD, OneLogin, etc.).
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {[
              { label: 'ACS URL', value: ssoStatus?.acs_url },
              { label: 'Entity ID', value: ssoStatus?.entity_id },
              { label: 'Metadata URL', value: ssoStatus?.metadata_url },
            ].map(({ label, value }) => (
              <div key={label} className="flex items-center gap-2">
                <Label className="w-28 shrink-0 text-sm">{label}</Label>
                <Input value={value || ''} readOnly className="font-mono text-xs" />
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => copyToClipboard(value || '', label)}
                >
                  <IconCopy size={16} />
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Configure Form */}
        {!ssoStatus?.configured && (
          <>
            {!showConfigForm ? (
              <Button onClick={() => setShowConfigForm(true)}>
                <IconShieldLock size={16} className="mr-1" />
                Configure SSO
              </Button>
            ) : (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Configure SAML Identity Provider</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="domain">Email Domain</Label>
                    <Input
                      id="domain"
                      placeholder="acme.com"
                      value={domain}
                      onChange={(e) => setDomain(e.target.value)}
                    />
                    <p className="text-muted-foreground text-xs">
                      Users with @{domain || 'yourdomain.com'} emails will be redirected to SSO.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="idp-name">IdP Display Name</Label>
                    <Input
                      id="idp-name"
                      placeholder="Acme Corp Okta"
                      value={idpName}
                      onChange={(e) => setIdpName(e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="metadata-url">IdP Metadata URL</Label>
                    <Input
                      id="metadata-url"
                      placeholder="https://your-idp.com/app/xyz/sso/saml/metadata"
                      value={metadataUrl}
                      onChange={(e) => setMetadataUrl(e.target.value)}
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <Switch
                      id="auto-provision"
                      checked={autoProvision}
                      onCheckedChange={setAutoProvision}
                    />
                    <Label htmlFor="auto-provision">Auto-provision new SSO users</Label>
                  </div>

                  <div className="space-y-2">
                    <Label>Default Role for SSO Users</Label>
                    <Select value={defaultRole} onValueChange={setDefaultRole}>
                      <SelectTrigger className="w-40">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="member">Member</SelectItem>
                        <SelectItem value="admin">Admin</SelectItem>
                        <SelectItem value="viewer">Viewer</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex gap-2 pt-2">
                    <Button
                      onClick={handleConfigure}
                      disabled={configureMutation.isPending}
                    >
                      {configureMutation.isPending ? 'Configuring...' : 'Save SSO Configuration'}
                    </Button>
                    <Button variant="outline" onClick={() => setShowConfigForm(false)}>
                      Cancel
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>
    </ContentSection>
  )
}
