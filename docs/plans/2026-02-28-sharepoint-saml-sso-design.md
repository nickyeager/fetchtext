# Phase 1: SharePoint/OneDrive Connector + SAML SSO — Design

**Date**: 2026-02-28
**Status**: Approved
**Goal**: Remove the two biggest enterprise adoption blockers: document source integration (SharePoint) and enterprise auth (SAML SSO).

---

## Overview

Two parallel workstreams shipping together:

1. **SharePoint/OneDrive connector** — Bidirectional: browse, import, export, and watch folders via Microsoft Graph API. Follows the existing Google Docs connector pattern.
2. **Generic SAML 2.0 SSO** — Any SAML-compliant IdP (Azure AD, Okta, OneLogin, etc.). Both managed and self-hosted Supabase. JIT user provisioning.

---

## SharePoint/OneDrive Connector

### Architecture

New FastAPI router (`sharepoint.py`) following the Google Docs connector pattern. Uses Microsoft Graph API via the existing OAuth manager. Microsoft 365 OAuth with SharePoint scopes is already configured in `registry.py`.

### Backend Endpoints (`/api/sharepoint/`)

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/sites` | GET | List accessible SharePoint sites |
| `/sites/{site_id}/drives` | GET | List document libraries in a site |
| `/drives/{drive_id}/items` | GET | Browse folder contents (files + subfolders) |
| `/items/{item_id}/download` | POST | Download a file and optionally process with Docling |
| `/items/batch-download` | POST | Batch download + process multiple files |
| `/upload` | POST | Upload a generated document to a SharePoint location |
| `/search` | GET | Search across SharePoint for documents by name/type |
| `/health` | GET | Verify Microsoft Graph connectivity |
| `/watches` | GET | List active folder watches for the org |
| `/watches` | POST | Create a new folder watch |
| `/watches/{watch_id}` | PATCH | Update watch config |
| `/watches/{watch_id}` | DELETE | Remove a folder watch |

### Data Flows

**Import:**
```
User browses SharePoint → selects files → POST /items/{id}/download
  → OAuth token from vault → Graph API download → temp file
  → (optional) Docling processing → return result
```

**Export:**
```
Document generated → user clicks "Save to SharePoint"
  → picks destination folder → POST /upload
  → OAuth token from vault → Graph API upload → confirm
```

### Watch Folders (Poll-Based Auto-Import)

- User configures a watch on a SharePoint folder via Settings UI
- Database table `sharepoint_watches` stores: org_id, drive_id, folder_id, folder_path, poll_interval_minutes, last_polled_at, is_active
- Background `asyncio` task polls at configured intervals, compares `lastModifiedDateTime` against `last_polled_at`
- New/modified files automatically downloaded and processed through standard pipeline
- Processed results trigger the event bus (webhooks/N8N fire too)
- Deduplicates by file ID + lastModifiedDateTime to avoid reprocessing
- Poll-based first; can upgrade to Graph API change notifications later

### Key Decisions

- Reuse `OAuthManager.get_access_token()` for automatic token refresh
- SharePoint items addressed via Microsoft Graph: `GET /drives/{drive-id}/items/{item-id}`
- OneDrive is just another "drive" in Graph API — same endpoints cover both
- File browser uses pagination (Graph API `@odata.nextLink`)
- Concurrent downloads limited with semaphore (max 3, like Google Docs)

---

## SAML SSO

### Architecture

Leverage Supabase Auth's built-in SAML 2.0 support. For managed Supabase (production), use Supabase Management API. For self-hosted Docker, configure GoTrue admin API directly. An `SSOService` abstraction layer detects environment and routes to the correct API.

### Login Flow

```
Login page → user enters email → detect domain
  → if domain has SSO configured → signInWithSSO({ domain })
  → Supabase redirects to IdP → user authenticates
  → IdP posts assertion to ACS URL → Supabase validates
  → session created → redirect to app with tokens
  → if no SSO → normal email/password login
```

### Backend Endpoints (`/api/sso/`)

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/status` | GET | Check if SSO is configured for the org |
| `/configure` | POST | Register a SAML IdP (metadata URL or XML) |
| `/update` | PATCH | Update IdP metadata (key rotation) |
| `/remove` | DELETE | Remove SSO configuration |
| `/domains` | GET | List verified domains for SSO |
| `/provision` | POST | JIT provision an SSO user into an org |

### SSO Service Abstraction

```python
class SSOService:
    def __init__(self):
        self.is_managed = bool(os.getenv("SUPABASE_PROJECT_REF"))

    async def register_provider(self, metadata_url, domain):
        if self.is_managed:
            # Call Supabase Management API
        else:
            # Call GoTrue admin API directly
```

### JIT User Provisioning

When a user authenticates via SAML for the first time:

1. Supabase creates `auth.users` record from SAML assertion
2. App detects new SSO user (no org membership)
3. JIT provisioner reads `sso_provider_id` from JWT
4. Maps provider to organization via `sso_provider_mappings` table
5. Creates `organization_members` record with configured default role
6. User lands in the app with org access

Configurable: "Auto-provision SSO users" toggle + default role selector in admin UI.

### SAML Attribute Mapping

- Map IdP attributes to user profile fields (display name, department, role)
- Supabase supports `attribute_mapping` in SSO provider config
- Mapped attributes stored in `user_metadata`

### Key Decisions

- SP-initiated flow only (IdP-initiated has PKCE incompatibility)
- Domain-based routing: email domain maps to IdP
- SSO users are separate from email/password users (Supabase behavior)
- No SLO support (Supabase limitation) — session expires naturally
- Supabase Pro plan required for managed instance ($0.015/SSO MAU)

---

## Frontend Components

### SharePoint

- `settings/integrations/sharepoint-settings.tsx` — Connection status, connect/disconnect (follows Google Drive pattern)
- `features/documents/components/SharePointBrowser.tsx` — File browser modal: site picker → library → folder tree → file selection
- "Import from SharePoint" button on Documents page
- "Save to SharePoint" button on generated document view
- `settings/integrations/sharepoint-watches.tsx` — Watch folder management (add/edit/remove watches, show poll status)

### SAML SSO

- `settings/organization/sso-settings.tsx` — Configure IdP, upload metadata, verify domain, toggle JIT provisioning, set default role
- `features/auth/components/SSOLoginButton.tsx` — "Sign in with SSO" on login page
- Login page updated: email input detects SSO domain → shows SSO button instead of password field

---

## Database Migrations

### Migration 029: SharePoint Watches

```sql
CREATE TABLE IF NOT EXISTS sharepoint_watches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    drive_id TEXT NOT NULL,
    folder_id TEXT NOT NULL,
    folder_path TEXT NOT NULL,
    poll_interval_minutes INTEGER NOT NULL DEFAULT 15,
    last_polled_at TIMESTAMPTZ,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_sharepoint_watches_org ON sharepoint_watches(organization_id);
CREATE INDEX idx_sharepoint_watches_active ON sharepoint_watches(is_active) WHERE is_active = true;

ALTER TABLE sharepoint_watches ENABLE ROW LEVEL SECURITY;
```

### Migration 030: SSO Provider Mappings

```sql
CREATE TABLE IF NOT EXISTS sso_provider_mappings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    sso_provider_id UUID NOT NULL UNIQUE,
    default_role TEXT NOT NULL DEFAULT 'member',
    auto_provision BOOLEAN NOT NULL DEFAULT true,
    domain TEXT NOT NULL UNIQUE,
    metadata_url TEXT,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_sso_mappings_org ON sso_provider_mappings(organization_id);
CREATE INDEX idx_sso_mappings_domain ON sso_provider_mappings(domain);

ALTER TABLE sso_provider_mappings ENABLE ROW LEVEL SECURITY;
```

---

## Testing Strategy

| Test Type | What | How |
|-----------|------|-----|
| Backend unit | SharePoint router endpoints, SSO service | pytest with real Graph API calls (test tenant) |
| Backend integration | OAuth flow → Graph API → download/upload | Real Microsoft 365 dev tenant |
| Playwright E2E | SharePoint browser UI, SSO login flow | Real browser, real backend |
| SAML flow | End-to-end SSO login | Test IdP (samlidp.io or Azure AD test app) |

### Prerequisites

- Microsoft 365 developer tenant (free) for Graph API testing
- Azure AD app registration with SharePoint/Graph scopes
- Test SAML IdP for SSO flow testing

---

## Dependencies

- Existing: `OAuthManager`, `IntegrationRegistry`, `VaultService`, `admin_auth` middleware
- New: Microsoft Graph Python SDK (`msgraph-sdk`) or raw `httpx` calls
- Supabase: Pro plan for managed SAML ($0.015/SSO MAU)
