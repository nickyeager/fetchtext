# Feature: Complete Google Docs Integration Settings UI

The following plan should be complete, but validate documentation and codebase patterns before implementing.

Pay special attention to naming of existing utils, types and models. Import from the right files.

## Feature Description

Complete the Google Docs integration by wiring up the existing OAuth infrastructure to the Settings UI. The backend OAuth flow, Vault storage, and API endpoints are **already fully implemented**. This task replaces the placeholder "Coming Soon" settings card with a functional integration card that allows users to connect their Google account.

## User Story

As an organization administrator
I want to connect my organization's Google account via the Settings page
So that I can import documents from Google Drive and generate Google Docs from templates

## Problem Statement

The Google Docs integration has complete backend infrastructure (OAuth endpoints, Vault storage, token management) but the Settings UI shows only a placeholder card with "Coming Soon" badge. Users cannot actually connect their Google account.

## Solution Statement

Replace the placeholder GoogleDriveSettings component with the existing IntegrationCard component, wire up React Query to fetch integration status, handle OAuth callback redirects, and add visual feedback for connection state.

## Feature Metadata

**Feature Type**: Enhancement (wiring existing infrastructure)
**Estimated Complexity**: Low
**Primary Systems Affected**: Frontend Settings UI only
**Dependencies**: None - all backend infrastructure exists

---

## CONTEXT REFERENCES

### Relevant Codebase Files - MUST READ BEFORE IMPLEMENTING!

**Backend (already complete - for reference only):**
- [registry.py](document-processor/app/services/integrations/registry.py) (lines 127-162) - Google OAuth configuration with scopes
- [oauth_manager.py](document-processor/app/services/integrations/oauth_manager.py) - Full OAuth flow implementation
- [integrations.py](document-processor/app/routers/integrations.py) - API endpoints for OAuth

**Frontend (to modify/use):**
- [google-drive-settings.tsx](localai-admin-dashboard/src/features/settings/integrations/google-drive-settings.tsx) - **REPLACE** placeholder with IntegrationCard
- [index.tsx](localai-admin-dashboard/src/features/settings/integrations/index.tsx) - Parent page that renders GoogleDriveSettings
- [IntegrationCard.tsx](localai-admin-dashboard/src/components/integrations/IntegrationCard.tsx) - **USE** existing component
- [integration-service.ts](localai-admin-dashboard/src/lib/services/integration-service.ts) - **USE** existing service methods
- [ai-models/index.tsx](localai-admin-dashboard/src/features/settings/ai-models/index.tsx) - Reference for useQuery patterns

**Settings Pattern Reference:**
- [profile-form.tsx](localai-admin-dashboard/src/features/settings/profile/profile-form.tsx) - useQuery + useMutation pattern
- [content-section.tsx](localai-admin-dashboard/src/features/settings/components/content-section.tsx) - Wrapper component

### New Files to Create

None - all components exist. Only updating existing files.

### Relevant Documentation

- [Google OAuth 2.0 Policies](https://developers.google.com/identity/protocols/oauth2/policies)
  - Verification requirements if using sensitive scopes
- [Configure OAuth Consent Screen](https://developers.google.com/workspace/guides/configure-oauth-consent)
  - Required for production deployment

### Patterns to Follow

**React Query Pattern (from ai-models/index.tsx):**
```typescript
const { data: integrations, isLoading, refetch } = useQuery({
  queryKey: integrationKeys.list(),
  queryFn: () => integrationService.listIntegrations(true),
})
```

**IntegrationCard Usage Pattern:**
```typescript
<IntegrationCard
  id="google"
  name="Google Drive & Docs"
  description="Import documents from Drive and generate Google Docs"
  icon={<Chrome className="h-5 w-5" />}
  status={googleStatus?.status || 'disconnected'}
  configured={googleConfig?.configured}
  scopes={googleStatus?.scopes}
  metadata={googleStatus?.metadata}
  lastError={googleStatus?.last_error}
  connectedAt={googleStatus?.connected_at}
  tokenExpiresAt={googleStatus?.token_expires_at}
  organizationId={activeOrganization?.id || ''}
  onConnected={() => refetch()}
  onDisconnected={() => refetch()}
/>
```

**URL Parameter Handling (for OAuth callback):**
```typescript
const { success, error } = useSearch({ strict: false })

useEffect(() => {
  if (success === 'true') {
    toast.success('Google account connected successfully')
    // Clear URL params
    router.navigate({ search: {} })
    refetch()
  } else if (error) {
    toast.error('Failed to connect Google account', { description: error })
    router.navigate({ search: {} })
  }
}, [success, error])
```

---

## IMPLEMENTATION PLAN

### Phase 1: Update GoogleDriveSettings Component

Replace the placeholder with a functional integration card that:
- Fetches available integrations from backend
- Fetches current status for the organization
- Renders IntegrationCard with proper props
- Handles loading states

### Phase 2: Add OAuth Callback Handling

After OAuth redirect back to `/settings/integrations`:
- Parse `?success=true` or `?error=...` query params
- Show toast notification
- Clear query params from URL
- Refresh integration status

### Phase 3: Handle Organization Context

- Get active organization from useOrganization hook
- Show appropriate message if no organization selected
- Gate connect button on organization availability

### Phase 4: Testing

- Verify with GOOGLE_CLIENT_ID/SECRET configured
- Test connect flow redirects to Google
- Test callback handling shows success/error
- Test disconnect removes connection

---

## STEP-BY-STEP TASKS

### UPDATE [google-drive-settings.tsx](localai-admin-dashboard/src/features/settings/integrations/google-drive-settings.tsx)

- **IMPLEMENT**: Replace entire component with IntegrationCard-based implementation
- **PATTERN**: Follow ai-models/index.tsx (lines 1-150) for useQuery patterns
- **IMPORTS**:
  ```typescript
  import { useQuery, useQueryClient } from '@tanstack/react-query'
  import { useSearch, useRouter } from '@tanstack/react-router'
  import { useEffect } from 'react'
  import { toast } from 'sonner'
  import { Chrome } from 'lucide-react'
  import { IntegrationCard } from '@/components/integrations/IntegrationCard'
  import { integrationService, integrationKeys } from '@/lib/services/integration-service'
  import { useOrganization } from '@/context/organization-context'
  import { Skeleton } from '@/components/ui/skeleton'
  import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
  import { AlertCircle } from 'lucide-react'
  ```
- **GOTCHA**: Must check if organization is selected before making API calls
- **GOTCHA**: Use `strict: false` in useSearch to handle optional params
- **VALIDATE**: `cd localai-admin-dashboard && npx pnpm build`

**Full Implementation:**
```typescript
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useSearch, useRouter } from '@tanstack/react-router'
import { useEffect } from 'react'
import { toast } from 'sonner'
import { Chrome, AlertCircle } from 'lucide-react'
import { IntegrationCard } from '@/components/integrations/IntegrationCard'
import {
  integrationService,
  integrationKeys,
  type IntegrationType,
} from '@/lib/services/integration-service'
import { useOrganization } from '@/context/organization-context'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export function GoogleDriveSettings() {
  const { activeOrganization } = useOrganization()
  const queryClient = useQueryClient()
  const router = useRouter()

  // Parse OAuth callback params
  const searchParams = useSearch({ strict: false }) as { success?: string; error?: string }

  // Fetch available integrations (to check if Google is configured)
  const { data: integrations, isLoading: loadingIntegrations } = useQuery({
    queryKey: integrationKeys.list(),
    queryFn: () => integrationService.listIntegrations(),
  })

  // Fetch Google integration status for this organization
  const {
    data: googleStatus,
    isLoading: loadingStatus,
    refetch
  } = useQuery({
    queryKey: integrationKeys.status(activeOrganization?.id || '', 'google'),
    queryFn: () => integrationService.getIntegrationStatus(
      activeOrganization!.id,
      'google' as IntegrationType
    ),
    enabled: !!activeOrganization?.id,
  })

  // Handle OAuth callback
  useEffect(() => {
    if (searchParams?.success === 'true') {
      toast.success('Google account connected successfully')
      router.navigate({
        to: '/settings/integrations',
        search: {},
        replace: true
      })
      refetch()
    } else if (searchParams?.error) {
      toast.error('Failed to connect Google account', {
        description: searchParams.error,
      })
      router.navigate({
        to: '/settings/integrations',
        search: {},
        replace: true
      })
    }
  }, [searchParams?.success, searchParams?.error, router, refetch])

  // Get Google config from integrations list
  const googleConfig = integrations?.find((i) => i.id === 'google')

  // Loading state
  if (loadingIntegrations) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64 mt-2" />
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
          Please select an organization to configure integrations.
        </AlertDescription>
      </Alert>
    )
  }

  return (
    <IntegrationCard
      id="google"
      name="Google Drive & Docs"
      description="Import documents from Google Drive and generate Google Docs from extracted data"
      icon={<Chrome className="h-5 w-5" />}
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
```

### UPDATE Route to Accept Search Params

The integrations route needs to accept search params for OAuth callback.

- **CHECK**: Verify [integrations.tsx](localai-admin-dashboard/src/routes/_authenticated/settings/integrations.tsx) has `validateSearch` or allows search params
- **PATTERN**: TanStack Router search validation
- **VALIDATE**: `cd localai-admin-dashboard && npx pnpm build`

Read the route file first - if it doesn't have search validation, add:
```typescript
import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'

const searchSchema = z.object({
  success: z.string().optional(),
  error: z.string().optional(),
})

export const Route = createFileRoute('/_authenticated/settings/integrations')({
  validateSearch: searchSchema,
  component: IntegrationsPage,
})
```

---

## TESTING STRATEGY

### Unit Tests

No unit tests needed - using existing tested components.

### Integration Tests

**Manual Testing Required:**

1. **Prerequisites:**
   - Set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` in `.env`
   - Restart document-processor: `docker compose -p localai up -d --build document-processor`
   - Ensure services are running

2. **Test Flow:**
   - Navigate to `/settings/integrations`
   - Verify Google card shows "Not Configured" if env vars missing
   - Verify Google card shows "Connect" button if configured
   - Click "Connect" - should redirect to Google OAuth
   - Complete OAuth - should redirect back with `?success=true`
   - Verify toast shows "Connected successfully"
   - Verify card now shows connected state with scopes
   - Click "Test Connection" - should show success toast
   - Click "Disconnect" - should show disconnected state

### Edge Cases

- No organization selected → Shows "No Organization Selected" alert
- Backend not configured → Shows "Not Configured" warning
- OAuth cancelled → Returns with `?error=access_denied`
- Token refresh needed → Auto-refresh on next API call

---

## VALIDATION COMMANDS

### Level 1: Syntax & Style

```bash
cd localai-admin-dashboard && npx pnpm build
```

### Level 2: Type Checking

```bash
cd localai-admin-dashboard && npx pnpm check
```

### Level 3: Linting

```bash
cd localai-admin-dashboard && npx pnpm lint
```

### Level 4: Manual Validation

1. Start services: `python start_services.py --profile cpu`
2. Navigate to http://localhost:5173/settings/integrations
3. Verify UI renders without errors
4. Check browser console for errors
5. If GOOGLE_CLIENT_ID set, test OAuth flow

---

## ACCEPTANCE CRITERIA

- [ ] Google integration card renders on Settings > Integrations page
- [ ] Card shows "Not Configured" when GOOGLE_CLIENT_ID not set
- [ ] Card shows "Connect" button when credentials are configured
- [ ] Clicking "Connect" redirects to Google OAuth
- [ ] OAuth callback shows success/error toast
- [ ] Connected state shows account details, scopes, and action buttons
- [ ] "Test Connection" button verifies connection works
- [ ] "Disconnect" button revokes access and updates UI
- [ ] Loading states show skeleton while fetching
- [ ] "No Organization Selected" shown when no org context
- [ ] Build passes with no TypeScript errors
- [ ] No console errors in browser

---

## COMPLETION CHECKLIST

- [ ] GoogleDriveSettings component updated with IntegrationCard
- [ ] Route search params validation added
- [ ] Build passes: `npx pnpm build`
- [ ] Manual testing confirms OAuth flow works
- [ ] Connected/disconnected states display correctly
- [ ] Error handling shows appropriate messages

---

## NOTES

### Why This Is Low Complexity

The entire OAuth infrastructure is already implemented:
- Backend: Registry, OAuth Manager, Vault storage, API endpoints
- Frontend: IntegrationCard component, IntegrationService

This task is purely **wiring** - connecting existing components together.

### Environment Variables Required

For testing, you need:
```bash
GOOGLE_CLIENT_ID=your-client-id
GOOGLE_CLIENT_SECRET=your-client-secret
```

These should be added to the root `.env` file.

### Google Cloud Console Setup

To get credentials:
1. Go to [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
2. Create OAuth 2.0 Client ID
3. Add authorized redirect URI: `http://localhost:8090/api/integrations/google/oauth/callback`
4. Copy Client ID and Secret to `.env`

### Future Integrations

This same pattern applies to all other integrations (QuickBooks, Microsoft, etc.):
1. Add IntegrationCard to settings page
2. Wire up useQuery for status
3. Handle OAuth callback params

Consider creating a generic `IntegrationsGrid` component that renders cards for all configured integrations.
