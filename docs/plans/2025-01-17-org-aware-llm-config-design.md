# Organization-Aware LLM Configuration Design

**Date:** 2025-01-17
**Status:** ✅ Implemented (Integration tests passing)

## Overview

Enable per-organization LLM provider configuration to support different compliance tiers and deployment models while maintaining backwards compatibility with the current system-wide Azure OpenAI setup.

## Tiers

| Tier | Provider | Compliance | Pricing Model | Use Case |
|------|----------|------------|---------------|----------|
| **Free** | `none` | N/A | $0 | Template-only, no AI |
| **Non-Managed** | `shared` | None needed | Low $ + usage limits | Price-sensitive, no compliance |
| **Professional** | `byok_*` | Customer handles | Mid $$ | SOC 2 customers, own keys |
| **Enterprise** | `self_hosted` | Full isolation | $$$ | HIPAA, regulated industries |

## Provider Types

```
none         - No LLM, template-only document generation
shared       - FetchText's shared Azure OpenAI (system default)
byok_azure   - Customer's Azure OpenAI API key
byok_openai  - Customer's OpenAI API key
self_hosted  - Customer's VPC endpoint (Ollama, vLLM, etc.)
```

## Enterprise Deployment Models

For enterprise tier customers needing dedicated Azure instances:

| Model | Description | BAA Responsibility |
|-------|-------------|-------------------|
| `managed_ours` | FetchText provisions in our Azure subscription | FetchText signs BAA |
| `lighthouse` | FetchText provisions in customer's Azure via Lighthouse | Customer signs BAA |
| `marketplace` | Customer deploys via Azure Marketplace managed app | Customer signs BAA |

## Database Schema

```sql
CREATE TABLE organization_llm_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- Tier and provider
  tier TEXT NOT NULL DEFAULT 'non_managed',
  provider_type TEXT NOT NULL DEFAULT 'shared',

  -- Enterprise deployment model
  deployment_model TEXT,  -- 'managed_ours' | 'lighthouse' | 'marketplace'

  -- Credentials (encrypted via Supabase Vault)
  credentials_vault_id TEXT,  -- Reference to Vault secret

  -- Self-hosted / custom endpoint
  custom_endpoint TEXT,

  -- Azure resource details (enterprise tier)
  azure_resource_id TEXT,
  azure_subscription_id TEXT,
  azure_resource_group TEXT,
  azure_instance_name TEXT,

  -- Lighthouse delegation (enterprise)
  lighthouse_delegation_id TEXT,

  -- Marketplace (enterprise)
  marketplace_subscription_id TEXT,

  -- Provisioning status (enterprise)
  provisioning_status TEXT DEFAULT 'active',
  provisioning_error TEXT,
  provisioned_at TIMESTAMPTZ,

  -- Usage limits (non_managed tier)
  daily_document_limit INT DEFAULT 10,
  monthly_document_limit INT DEFAULT 200,
  documents_processed_today INT DEFAULT 0,
  documents_processed_month INT DEFAULT 0,
  usage_reset_daily TIMESTAMPTZ DEFAULT NOW(),
  usage_reset_monthly TIMESTAMPTZ DEFAULT NOW(),

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),

  UNIQUE(organization_id)
);

-- RLS: Only org admins can manage LLM config
ALTER TABLE organization_llm_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org admins can view LLM config"
  ON organization_llm_configs
  FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid() AND role IN ('admin', 'owner')
    )
  );

CREATE POLICY "Org admins can manage LLM config"
  ON organization_llm_configs
  FOR ALL
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid() AND role IN ('admin', 'owner')
    )
  );
```

## Fallback Strategy

```
Request with organization_id
    │
    ├─ No org_id → System default (current Azure config)
    │
    └─ Has org_id → Check organization_llm_configs
                      │
                      ├─ No row → System default (current Azure config)
                      │
                      └─ Has row → Use org-specific config
```

**Key principle:** The app works exactly as today without any org config. Org configs are optional overrides.

## Backend Changes

### 1. Extend ProviderConfig (providers.py)

Add `get_effective_config(organization_id)` method that:
- Returns system default if no org_id
- Queries Supabase for org config
- Falls back to system default if no row
- Caches configs for 5 minutes

### 2. Extend LLMService (llm_service.py)

Add `organization_id` parameter to `complete()` method:
- Gets effective config via ProviderConfig
- Routes to appropriate provider based on config
- Checks usage limits for non_managed tier

### 3. Extend Models Router (models.py)

Add org-aware endpoints:
- `GET /models/providers?organization_id=xxx`
- `POST /models/provider/select` with org_id in body
- `GET /models/org-config/{organization_id}`
- `PUT /models/org-config/{organization_id}`

## Frontend Changes

### 1. Extend Organization Types

Add LLM config types to organization.ts

### 2. Create LLM Config Service

New service for managing org LLM configs

### 3. Update Provider Selector

Make it org-aware, show current org's config vs system default

### 4. Pass org_id Through Document Processing

All document processing calls include activeOrganization.id

## Implementation Order

1. Database migration
2. Backend ProviderConfig extension
3. Backend LLMService extension
4. Backend API endpoints
5. Frontend types and service
6. Frontend UI updates
7. Integration testing

## Compliance Roadmap

| Phase | Timeline | Investment | Unlocks |
|-------|----------|------------|---------|
| Now | - | $0 | Non-managed tier (shared Azure) |
| +3 months | Sprinto/Vanta setup | ~$5-8K | Evidence collection for SOC 2 |
| +6 months | SOC 2 Type I audit | ~$12-15K | Professional tier credibility |
| +12 months | SOC 2 Type II | ~$15-20K | Enterprise conversations |
| As needed | HIPAA BAA template | ~$2-5K legal | Healthcare customers |
