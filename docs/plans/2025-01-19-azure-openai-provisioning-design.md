# Azure OpenAI Auto-Provisioning Design

**Date:** 2025-01-19
**Status:** Draft

## Overview

Enable automatic provisioning of dedicated Azure OpenAI instances for enterprise customers when they upgrade to a paid tier. This builds on the existing organization-aware LLM configuration system.

## Goal

When a customer upgrades to Enterprise tier, automatically provision a dedicated Azure OpenAI instance in FetchText's Azure subscription, deploy their selected model, and configure the organization to use it.

## Tier Progression

| Tier | LLM Access | Model Selection |
|------|------------|-----------------|
| Free | None (template-only) | N/A |
| Non-managed | Shared FetchText Azure OpenAI | Fixed (GPT-4o-mini) |
| Professional | Customer's own API key (BYOK) | Whatever their key has |
| Enterprise | Dedicated instance in FetchText's Azure | Customer selects at signup |

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    Enterprise Signup Flow                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  [Payment Confirmed] ──► [Provisioning Service] ──► [Azure]     │
│         │                       │                      │         │
│         │                       ▼                      ▼         │
│         │              ┌──────────────┐      ┌──────────────┐   │
│         │              │ Create Azure │      │ Azure OpenAI │   │
│         │              │ OpenAI       │──────│ Resource     │   │
│         │              │ Resource     │      │ (East US)    │   │
│         │              └──────────────┘      └──────────────┘   │
│         │                       │                      │         │
│         │                       ▼                      ▼         │
│         │              ┌──────────────┐      ┌──────────────┐   │
│         │              │ Deploy Model │      │ GPT-4o       │   │
│         │              │ (customer    │──────│ Deployment   │   │
│         │              │  selected)   │      │              │   │
│         │              └──────────────┘      └──────────────┘   │
│         │                       │                               │
│         ▼                       ▼                               │
│  ┌─────────────┐       ┌──────────────┐                        │
│  │ Update      │◄──────│ Store creds  │                        │
│  │ org_llm_    │       │ in Vault     │                        │
│  │ configs     │       └──────────────┘                        │
│  └─────────────┘                                                │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Database Schema

### Existing Columns (in `organization_llm_configs`)

Already available from migration 019:

```sql
-- Enterprise deployment tracking
deployment_model TEXT       -- 'managed_ours', 'lighthouse', 'marketplace'
azure_resource_id TEXT      -- Full Azure resource ID after provisioning
azure_subscription_id TEXT  -- FetchText's subscription ID (for managed_ours)
azure_resource_group TEXT   -- Resource group name
azure_instance_name TEXT    -- Azure OpenAI instance name

-- Provisioning status
provisioning_status TEXT    -- 'pending', 'provisioning', 'active', 'failed', 'deprovisioning'
provisioning_error TEXT     -- Error message if failed
provisioned_at TIMESTAMPTZ  -- When provisioning completed

-- Credentials (stored in Supabase Vault)
credentials_vault_id TEXT   -- Reference to vault.secrets
```

### New Table: `azure_provisioning_logs`

```sql
CREATE TABLE azure_provisioning_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id),
  action TEXT NOT NULL,  -- 'create', 'deploy_model', 'get_keys', 'delete'
  status TEXT NOT NULL,  -- 'started', 'completed', 'failed'
  details JSONB,         -- Azure API responses, errors
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Provisioning State Machine

```
┌─────────┐    Payment     ┌──────────────┐
│ pending │───Confirmed───►│ provisioning │
└─────────┘                └──────┬───────┘
                                  │
                    ┌─────────────┴─────────────┐
                    │                           │
                    ▼                           ▼
             ┌──────────┐               ┌────────────┐
             │  active  │               │   failed   │
             └──────────┘               └─────┬──────┘
                    │                         │
                    │ Tier                    │ Retry
                    │ Downgrade               │
                    ▼                         ▼
          ┌────────────────┐          ┌──────────────┐
          │ deprovisioning │          │ provisioning │
          └────────────────┘          └──────────────┘
```

## Provisioning Service

**Location:** `document-processor/app/services/azure_provisioning_service.py`

### Service Interface

```python
class AzureProvisioningService:
    """Provisions dedicated Azure OpenAI instances for enterprise customers"""

    async def provision_instance(
        self,
        organization_id: str,
        selected_model: str,  # e.g., "gpt-4o", "gpt-4o-mini"
        instance_name: str,   # Auto-generated: "fetchtext-{org_slug}-aoai"
    ) -> ProvisioningResult:
        """
        Creates Azure OpenAI resource and deploys model.

        Steps:
        1. Create resource group (if needed)
        2. Create Azure OpenAI resource
        3. Deploy selected model
        4. Retrieve API keys
        5. Store keys in Supabase Vault
        6. Update org_llm_configs with resource details

        Returns: ProvisioningResult with endpoint, status, error
        """

    async def deprovision_instance(
        self,
        organization_id: str,
    ) -> bool:
        """Deletes Azure OpenAI resource when customer downgrades"""

    async def get_provisioning_status(
        self,
        organization_id: str,
    ) -> ProvisioningStatus:
        """Checks current provisioning status from Azure"""
```

### Authentication

Uses Azure Service Principal with:
- `AZURE_TENANT_ID`
- `AZURE_CLIENT_ID`
- `AZURE_CLIENT_SECRET`
- `AZURE_SUBSCRIPTION_ID`

### Naming Convention

```
Resource Group: rg-fetchtext-customers-eastus
Resource Name:  fetchtext-{org_slug}-aoai
Deployment:     {model_name}-deployment
```

## API Endpoints

**New endpoints in `document-processor/app/routers/models.py`:**

```python
# Provisioning endpoints
POST   /models/provision/{organization_id}        # Trigger provisioning
GET    /models/provision/{organization_id}/status # Check status
DELETE /models/provision/{organization_id}        # Deprovision (downgrade)

# Admin endpoints (for monitoring)
GET    /models/provision/logs/{organization_id}   # Get provisioning logs
```

## Trigger Flow

```
┌──────────────────────────────────────────────────────────────────┐
│                     Payment Webhook Flow                          │
├──────────────────────────────────────────────────────────────────┤
│                                                                   │
│  [Stripe Webhook]                                                 │
│        │                                                          │
│        ▼                                                          │
│  [N8N Workflow: enterprise-subscription-created]                  │
│        │                                                          │
│        ├─► Update org_llm_configs:                               │
│        │     tier = 'enterprise'                                  │
│        │     deployment_model = 'managed_ours'                    │
│        │     provisioning_status = 'pending'                      │
│        │                                                          │
│        └─► Call POST /models/provision/{org_id}                  │
│                  │                                                │
│                  ▼                                                │
│            [Provisioning Service]                                 │
│                  │                                                │
│                  ├─► Create Azure OpenAI resource (async)        │
│                  ├─► Deploy model                                 │
│                  ├─► Store credentials in Vault                   │
│                  └─► Update provisioning_status = 'active'        │
│                                                                   │
└──────────────────────────────────────────────────────────────────┘
```

### N8N Workflow Webhook

```
URL: http://n8n:5678/webhook/enterprise-subscription
Payload: {
  "event": "subscription.created",
  "organization_id": "uuid",
  "tier": "enterprise",
  "selected_model": "gpt-4o",
  "customer_email": "admin@company.com"
}
```

### Async Processing

Provisioning takes 2-5 minutes. The API returns immediately with `provisioning_status: 'provisioning'`. Frontend polls `/status` endpoint or subscribes via Supabase realtime.

## Frontend UI

### Enterprise Upgrade Flow

```
┌─────────────────────────────────────────────────────────────────┐
│  Organization Settings > AI Configuration                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Current Tier: [Non-managed ▼]                                  │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  Upgrade to Enterprise                                   │    │
│  │                                                          │    │
│  │  Get a dedicated Azure OpenAI instance:                  │    │
│  │  • Your own isolated instance                           │    │
│  │  • Choose your model (GPT-4o, GPT-4o-mini)              │    │
│  │  • No usage limits                                       │    │
│  │  • Data isolation & compliance                          │    │
│  │                                                          │    │
│  │  [Upgrade Now - $X/month]                               │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Provisioning Status UI

```
┌─────────────────────────────────────────────────────────────────┐
│  Organization Settings > AI Configuration                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Current Tier: Enterprise ✓                                      │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  Provisioning Your Instance...                           │    │
│  │                                                          │    │
│  │  ████████░░░░░░░░░░ 40%                                 │    │
│  │                                                          │    │
│  │  ✓ Creating Azure OpenAI resource                       │    │
│  │  ◉ Deploying GPT-4o model...                            │    │
│  │  ○ Retrieving API credentials                           │    │
│  │  ○ Finalizing configuration                             │    │
│  │                                                          │    │
│  │  Estimated time: 2-5 minutes                            │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### After Provisioning Complete

```
┌─────────────────────────────────────────────────────────────────┐
│  Current Tier: Enterprise ✓                                      │
│                                                                  │
│  Instance Status: ● Active                                       │
│  Model: GPT-4o                                                   │
│  Region: East US                                                 │
│                                                                  │
│  [Test Connection]  [View Usage]                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Implementation Plan

### Phase 1: Managed-Ours (Core Feature)

| Component | Description | Files |
|-----------|-------------|-------|
| Database | Add `azure_provisioning_logs` table | `supabase/migrations/020_*.sql` |
| Backend | Azure Provisioning Service | `document-processor/app/services/azure_provisioning_service.py` |
| Backend | Provisioning API endpoints | `document-processor/app/routers/models.py` |
| Backend | Supabase Vault integration | `document-processor/app/services/vault_service.py` |
| N8N | Enterprise subscription webhook | `n8n/workflows/enterprise-subscription.json` |
| Frontend | Enterprise upgrade UI | `localai-admin-dashboard/src/routes/settings/ai-config.tsx` |
| Frontend | Provisioning status component | `localai-admin-dashboard/src/components/ProvisioningStatus.tsx` |

### Environment Variables (new)

```
AZURE_TENANT_ID=xxx
AZURE_CLIENT_ID=xxx
AZURE_CLIENT_SECRET=xxx
AZURE_SUBSCRIPTION_ID=xxx
AZURE_CUSTOMER_RESOURCE_GROUP=rg-fetchtext-customers-eastus
```

### Phase 2: Marketplace (Future)

- Azure Marketplace listing
- Customer self-service deployment
- Separate design document when ready

## Key Decisions

1. **Deployment Model:** Managed-Ours first (FetchText's Azure subscription), then Marketplace later
2. **Provisioning Trigger:** Fully automated self-service (payment confirmed → auto-provision)
3. **Model Allocation:** Shared model for free tier, customer-selected model for enterprise
4. **Region:** Single region (East US) for initial simplicity
5. **UI Exposure:** Show only model name, status, region - no technical Azure details

## Related Documents

- [Organization-Aware LLM Configuration Design](./2025-01-17-org-aware-llm-config-design.md) - Foundation for this feature
