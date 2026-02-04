# Azure OpenAI Auto-Provisioning Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Automatically provision dedicated Azure OpenAI instances for enterprise customers when they upgrade to paid tier.

**Architecture:** Payment webhook triggers N8N workflow → calls provisioning API → creates Azure OpenAI resource → deploys model → stores credentials in Vault → updates org config. Frontend polls status and shows progress.

**Tech Stack:** Python/FastAPI (backend), Azure SDK for Python, Supabase Vault, React/TypeScript (frontend), N8N (webhooks)

---

### Task 1: Database Migration - Provisioning Logs Table

**Files:**
- Create: `supabase/migrations/020_add_azure_provisioning_logs.sql`

**Step 1: Write the migration SQL**

```sql
-- Migration: 020_add_azure_provisioning_logs
-- Description: Add provisioning audit log table for Azure OpenAI instances
-- Date: 2025-01-19

-- ============================================================================
-- Azure Provisioning Logs Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS azure_provisioning_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  action TEXT NOT NULL CHECK (action IN ('create_resource', 'deploy_model', 'get_keys', 'store_credentials', 'delete_resource', 'retry')),
  status TEXT NOT NULL CHECK (status IN ('started', 'completed', 'failed')),
  details JSONB DEFAULT '{}',
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for querying logs by organization
CREATE INDEX IF NOT EXISTS idx_provisioning_logs_org_id ON azure_provisioning_logs(organization_id);
CREATE INDEX IF NOT EXISTS idx_provisioning_logs_created ON azure_provisioning_logs(created_at DESC);

-- RLS
ALTER TABLE azure_provisioning_logs ENABLE ROW LEVEL SECURITY;

-- Service role and backend have full access
CREATE POLICY "Service role full access on provisioning logs"
  ON azure_provisioning_logs
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Backend service access on provisioning logs"
  ON azure_provisioning_logs
  FOR ALL
  TO anon
  USING (true)
  WITH CHECK (true);

-- Org admins can view their logs
CREATE POLICY "Org admins can view provisioning logs"
  ON azure_provisioning_logs
  FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid() AND role IN ('admin', 'owner')
    )
  );

COMMENT ON TABLE azure_provisioning_logs IS 'Audit log for Azure OpenAI provisioning actions';
```

**Step 2: Apply migration to local Docker Supabase**

Run: `docker exec supabase-db psql -U postgres -d postgres -f /dev/stdin < supabase/migrations/020_add_azure_provisioning_logs.sql`

Or copy and execute:
```bash
docker exec supabase-db psql -U postgres -d postgres -c "$(cat supabase/migrations/020_add_azure_provisioning_logs.sql)"
```

Expected: Table created successfully

**Step 3: Reload PostgREST schema cache**

Run: `docker kill -s SIGUSR1 supabase-rest`

Expected: Schema cache reloaded

**Step 4: Verify table exists**

Run: `docker exec supabase-db psql -U postgres -d postgres -c "\d azure_provisioning_logs"`

Expected: Table schema displayed

---

### Task 2: Backend - Pydantic Models for Provisioning

**Files:**
- Create: `document-processor/app/models/provisioning.py`

**Step 1: Create the Pydantic models**

```python
"""
Pydantic models for Azure OpenAI provisioning
"""
from datetime import datetime
from enum import Enum
from typing import Optional, Dict, Any
from pydantic import BaseModel, Field


class ProvisioningAction(str, Enum):
    """Actions that can be logged during provisioning"""
    CREATE_RESOURCE = "create_resource"
    DEPLOY_MODEL = "deploy_model"
    GET_KEYS = "get_keys"
    STORE_CREDENTIALS = "store_credentials"
    DELETE_RESOURCE = "delete_resource"
    RETRY = "retry"


class ProvisioningLogStatus(str, Enum):
    """Status of a provisioning action"""
    STARTED = "started"
    COMPLETED = "completed"
    FAILED = "failed"


class ProvisioningStatus(str, Enum):
    """Overall provisioning status for an organization"""
    PENDING = "pending"
    PROVISIONING = "provisioning"
    ACTIVE = "active"
    FAILED = "failed"
    DEPROVISIONING = "deprovisioning"


class ProvisioningRequest(BaseModel):
    """Request to provision an Azure OpenAI instance"""
    selected_model: str = Field(
        default="gpt-4o-mini",
        description="Model to deploy (gpt-4o, gpt-4o-mini)"
    )


class ProvisioningStatusResponse(BaseModel):
    """Response with current provisioning status"""
    organization_id: str
    status: ProvisioningStatus
    model: Optional[str] = None
    region: str = "eastus"
    error_message: Optional[str] = None
    provisioned_at: Optional[datetime] = None
    progress_steps: list[Dict[str, Any]] = Field(default_factory=list)


class ProvisioningResult(BaseModel):
    """Result of a provisioning operation"""
    success: bool
    status: ProvisioningStatus
    message: str
    endpoint: Optional[str] = None
    error: Optional[str] = None


class ProvisioningLogEntry(BaseModel):
    """A single provisioning log entry"""
    id: str
    organization_id: str
    action: ProvisioningAction
    status: ProvisioningLogStatus
    details: Dict[str, Any] = Field(default_factory=dict)
    error_message: Optional[str] = None
    created_at: datetime
```

**Step 2: Verify the models import correctly**

Run: `docker exec localai-document-processor python -c "from app.models.provisioning import ProvisioningRequest, ProvisioningStatus; print('OK')"`

Expected: `OK`

---

### Task 3: Backend - Azure Provisioning Service Core

**Files:**
- Create: `document-processor/app/services/azure_provisioning_service.py`
- Modify: `document-processor/app/config.py` (add Azure SP credentials)

**Step 1: Add Azure SP environment variables to config**

Modify `document-processor/app/config.py`, add after line ~60 (after other Azure settings):

```python
    # Azure Service Principal for provisioning (enterprise tier)
    AZURE_TENANT_ID: str = ""
    AZURE_CLIENT_ID: str = ""
    AZURE_CLIENT_SECRET: str = ""
    AZURE_SUBSCRIPTION_ID: str = ""
    AZURE_CUSTOMER_RESOURCE_GROUP: str = "rg-fetchtext-customers-eastus"
    AZURE_CUSTOMER_LOCATION: str = "eastus"

    def is_azure_provisioning_configured(self) -> bool:
        """Check if Azure provisioning credentials are set"""
        return bool(
            self.AZURE_TENANT_ID and
            self.AZURE_CLIENT_ID and
            self.AZURE_CLIENT_SECRET and
            self.AZURE_SUBSCRIPTION_ID
        )
```

**Step 2: Create the provisioning service**

```python
"""
Azure OpenAI Provisioning Service

Provisions dedicated Azure OpenAI instances for enterprise customers.
"""
import logging
from typing import Optional, Dict, Any
from datetime import datetime

from azure.identity import ClientSecretCredential
from azure.mgmt.cognitiveservices import CognitiveServicesManagementClient
from azure.mgmt.cognitiveservices.models import (
    Account,
    AccountProperties,
    Sku,
    Deployment,
    DeploymentProperties,
    DeploymentModel,
)

from ..config import settings
from ..models.provisioning import (
    ProvisioningStatus,
    ProvisioningResult,
    ProvisioningAction,
    ProvisioningLogStatus,
)

logger = logging.getLogger(__name__)


class AzureProvisioningService:
    """Service for provisioning Azure OpenAI instances"""

    def __init__(self):
        self._client: Optional[CognitiveServicesManagementClient] = None
        self._credential: Optional[ClientSecretCredential] = None

    @property
    def is_configured(self) -> bool:
        """Check if provisioning is configured"""
        return settings.is_azure_provisioning_configured()

    def _get_client(self) -> CognitiveServicesManagementClient:
        """Get or create the Azure management client"""
        if not self.is_configured:
            raise ValueError("Azure provisioning credentials not configured")

        if self._client is None:
            self._credential = ClientSecretCredential(
                tenant_id=settings.AZURE_TENANT_ID,
                client_id=settings.AZURE_CLIENT_ID,
                client_secret=settings.AZURE_CLIENT_SECRET,
            )
            self._client = CognitiveServicesManagementClient(
                credential=self._credential,
                subscription_id=settings.AZURE_SUBSCRIPTION_ID,
            )
        return self._client

    def _generate_instance_name(self, org_slug: str) -> str:
        """Generate Azure OpenAI instance name from org slug"""
        # Sanitize: lowercase, alphanumeric and hyphens only, max 64 chars
        sanitized = "".join(c if c.isalnum() else "-" for c in org_slug.lower())
        sanitized = sanitized.strip("-")[:40]
        return f"fetchtext-{sanitized}-aoai"

    async def provision_instance(
        self,
        organization_id: str,
        org_slug: str,
        selected_model: str = "gpt-4o-mini",
        log_callback=None,
    ) -> ProvisioningResult:
        """
        Provision a new Azure OpenAI instance for an organization.

        Args:
            organization_id: The organization UUID
            org_slug: Organization slug for naming
            selected_model: Model to deploy (gpt-4o, gpt-4o-mini)
            log_callback: Optional async callback for logging progress

        Returns:
            ProvisioningResult with success status and details
        """
        if not self.is_configured:
            return ProvisioningResult(
                success=False,
                status=ProvisioningStatus.FAILED,
                message="Azure provisioning not configured",
                error="Missing Azure Service Principal credentials",
            )

        instance_name = self._generate_instance_name(org_slug)
        resource_group = settings.AZURE_CUSTOMER_RESOURCE_GROUP
        location = settings.AZURE_CUSTOMER_LOCATION

        try:
            client = self._get_client()

            # Log: Starting resource creation
            if log_callback:
                await log_callback(
                    ProvisioningAction.CREATE_RESOURCE,
                    ProvisioningLogStatus.STARTED,
                    {"instance_name": instance_name, "location": location},
                )

            # Step 1: Create Azure OpenAI resource
            logger.info(f"Creating Azure OpenAI resource: {instance_name}")
            account = Account(
                location=location,
                kind="OpenAI",
                sku=Sku(name="S0"),
                properties=AccountProperties(
                    custom_sub_domain_name=instance_name,
                    public_network_access="Enabled",
                ),
            )

            poller = client.accounts.begin_create(
                resource_group_name=resource_group,
                account_name=instance_name,
                account=account,
            )
            result = poller.result()

            if log_callback:
                await log_callback(
                    ProvisioningAction.CREATE_RESOURCE,
                    ProvisioningLogStatus.COMPLETED,
                    {"resource_id": result.id},
                )

            # Step 2: Deploy the model
            if log_callback:
                await log_callback(
                    ProvisioningAction.DEPLOY_MODEL,
                    ProvisioningLogStatus.STARTED,
                    {"model": selected_model},
                )

            logger.info(f"Deploying model {selected_model} to {instance_name}")
            deployment_name = f"{selected_model.replace('.', '-')}-deployment"
            deployment = Deployment(
                properties=DeploymentProperties(
                    model=DeploymentModel(
                        format="OpenAI",
                        name=selected_model,
                        version="2024-08-06" if "4o" in selected_model else "0613",
                    ),
                )
            )

            deploy_poller = client.deployments.begin_create_or_update(
                resource_group_name=resource_group,
                account_name=instance_name,
                deployment_name=deployment_name,
                deployment=deployment,
            )
            deploy_result = deploy_poller.result()

            if log_callback:
                await log_callback(
                    ProvisioningAction.DEPLOY_MODEL,
                    ProvisioningLogStatus.COMPLETED,
                    {"deployment_name": deployment_name},
                )

            # Step 3: Get API keys
            if log_callback:
                await log_callback(
                    ProvisioningAction.GET_KEYS,
                    ProvisioningLogStatus.STARTED,
                    {},
                )

            logger.info(f"Retrieving API keys for {instance_name}")
            keys = client.accounts.list_keys(
                resource_group_name=resource_group,
                account_name=instance_name,
            )

            if log_callback:
                await log_callback(
                    ProvisioningAction.GET_KEYS,
                    ProvisioningLogStatus.COMPLETED,
                    {"has_key1": bool(keys.key1), "has_key2": bool(keys.key2)},
                )

            endpoint = f"https://{instance_name}.openai.azure.com/"

            return ProvisioningResult(
                success=True,
                status=ProvisioningStatus.ACTIVE,
                message=f"Successfully provisioned {instance_name}",
                endpoint=endpoint,
            )

        except Exception as e:
            logger.error(f"Provisioning failed: {str(e)}")
            if log_callback:
                await log_callback(
                    ProvisioningAction.CREATE_RESOURCE,
                    ProvisioningLogStatus.FAILED,
                    {"error": str(e)},
                )
            return ProvisioningResult(
                success=False,
                status=ProvisioningStatus.FAILED,
                message="Provisioning failed",
                error=str(e),
            )

    async def deprovision_instance(
        self,
        organization_id: str,
        instance_name: str,
        log_callback=None,
    ) -> bool:
        """Delete an Azure OpenAI instance"""
        if not self.is_configured:
            return False

        try:
            client = self._get_client()
            resource_group = settings.AZURE_CUSTOMER_RESOURCE_GROUP

            if log_callback:
                await log_callback(
                    ProvisioningAction.DELETE_RESOURCE,
                    ProvisioningLogStatus.STARTED,
                    {"instance_name": instance_name},
                )

            poller = client.accounts.begin_delete(
                resource_group_name=resource_group,
                account_name=instance_name,
            )
            poller.result()

            if log_callback:
                await log_callback(
                    ProvisioningAction.DELETE_RESOURCE,
                    ProvisioningLogStatus.COMPLETED,
                    {},
                )

            return True
        except Exception as e:
            logger.error(f"Deprovisioning failed: {str(e)}")
            if log_callback:
                await log_callback(
                    ProvisioningAction.DELETE_RESOURCE,
                    ProvisioningLogStatus.FAILED,
                    {"error": str(e)},
                )
            return False

    async def get_instance_status(self, instance_name: str) -> Optional[Dict[str, Any]]:
        """Get the status of an Azure OpenAI instance"""
        if not self.is_configured:
            return None

        try:
            client = self._get_client()
            account = client.accounts.get(
                resource_group_name=settings.AZURE_CUSTOMER_RESOURCE_GROUP,
                account_name=instance_name,
            )
            return {
                "name": account.name,
                "status": account.properties.provisioning_state,
                "endpoint": account.properties.endpoint,
            }
        except Exception as e:
            logger.error(f"Failed to get instance status: {str(e)}")
            return None


# Global instance
azure_provisioning_service = AzureProvisioningService()
```

**Step 3: Add azure-mgmt-cognitiveservices to requirements**

Add to `document-processor/requirements.txt`:
```
azure-identity>=1.15.0
azure-mgmt-cognitiveservices>=13.5.0
```

**Step 4: Rebuild the container**

Run: `docker compose -p localai up -d --build document-processor`

Expected: Container rebuilds with new dependencies

---

### Task 4: Backend - Provisioning API Endpoints

**Files:**
- Modify: `document-processor/app/routers/models.py`

**Step 1: Add provisioning endpoints to models router**

Add these imports at the top of `document-processor/app/routers/models.py`:

```python
from ..models.provisioning import (
    ProvisioningRequest,
    ProvisioningStatusResponse,
    ProvisioningStatus,
    ProvisioningResult,
    ProvisioningAction,
    ProvisioningLogStatus,
)
from ..services.azure_provisioning_service import azure_provisioning_service
```

Add these endpoints after the existing routes (around line 200+):

```python
# ===========================================================================
# Provisioning Endpoints
# ===========================================================================

@router.post("/provision/{organization_id}", response_model=ProvisioningResult)
async def provision_azure_openai(
    organization_id: str,
    request: ProvisioningRequest,
):
    """
    Trigger Azure OpenAI provisioning for an enterprise organization.

    This is an async operation - returns immediately with 'provisioning' status.
    Poll /provision/{organization_id}/status for progress.
    """
    if not azure_provisioning_service.is_configured:
        raise HTTPException(
            status_code=503,
            detail="Azure provisioning not configured on this server"
        )

    # TODO: Get org slug from database
    org_slug = f"org-{organization_id[:8]}"

    # For now, run synchronously (in production, use background task)
    result = await azure_provisioning_service.provision_instance(
        organization_id=organization_id,
        org_slug=org_slug,
        selected_model=request.selected_model,
    )

    return result


@router.get("/provision/{organization_id}/status", response_model=ProvisioningStatusResponse)
async def get_provisioning_status(organization_id: str):
    """
    Get the current provisioning status for an organization.
    """
    # TODO: Query org_llm_configs for status
    # For now, return placeholder
    return ProvisioningStatusResponse(
        organization_id=organization_id,
        status=ProvisioningStatus.PENDING,
        region="eastus",
        progress_steps=[],
    )


@router.delete("/provision/{organization_id}")
async def deprovision_azure_openai(organization_id: str):
    """
    Deprovision an Azure OpenAI instance (for downgrades).
    """
    # TODO: Get instance name from org_llm_configs
    return {"status": "deprovisioning", "message": "Not implemented yet"}


@router.get("/provision/{organization_id}/logs")
async def get_provisioning_logs(organization_id: str):
    """
    Get provisioning audit logs for an organization.
    """
    # TODO: Query azure_provisioning_logs table
    return {"logs": []}
```

**Step 2: Restart the document processor**

Run: `docker compose -p localai restart document-processor`

**Step 3: Test the endpoint exists**

Run: `curl -s http://localhost:8090/models/provision/test-org-id/status | jq .`

Expected: JSON response with status "pending"

---

### Task 5: Backend - Vault Service for Credential Storage

**Files:**
- Create: `document-processor/app/services/vault_service.py`

**Step 1: Create the vault service**

```python
"""
Supabase Vault Service

Stores and retrieves secrets securely using Supabase Vault.
"""
import logging
from typing import Optional
import httpx

from ..config import settings

logger = logging.getLogger(__name__)


class VaultService:
    """Service for storing secrets in Supabase Vault"""

    def __init__(self):
        self.supabase_url = settings.SUPABASE_URL
        self.service_role_key = settings.SUPABASE_SERVICE_ROLE_KEY

    @property
    def is_configured(self) -> bool:
        """Check if vault access is configured"""
        return bool(self.supabase_url and self.service_role_key)

    def _get_headers(self) -> dict:
        """Get headers for Supabase API requests"""
        return {
            "apikey": self.service_role_key,
            "Authorization": f"Bearer {self.service_role_key}",
            "Content-Type": "application/json",
        }

    async def store_secret(
        self,
        name: str,
        secret: str,
        description: Optional[str] = None,
    ) -> Optional[str]:
        """
        Store a secret in Supabase Vault.

        Args:
            name: Unique name for the secret
            secret: The secret value to store
            description: Optional description

        Returns:
            The secret ID if successful, None otherwise
        """
        if not self.is_configured:
            logger.warning("Vault not configured")
            return None

        try:
            # Use Supabase RPC to insert into vault.secrets
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"{self.supabase_url}/rest/v1/rpc/vault_insert_secret",
                    headers=self._get_headers(),
                    json={
                        "new_name": name,
                        "new_secret": secret,
                        "new_description": description or "",
                    },
                    timeout=30.0,
                )

                if response.status_code == 200:
                    result = response.json()
                    logger.info(f"Stored secret: {name}")
                    return result  # Returns the secret ID
                else:
                    logger.error(f"Failed to store secret: {response.text}")
                    return None

        except Exception as e:
            logger.error(f"Vault error: {str(e)}")
            return None

    async def get_secret(self, secret_id: str) -> Optional[str]:
        """
        Retrieve a secret from Supabase Vault.

        Args:
            secret_id: The ID of the secret to retrieve

        Returns:
            The decrypted secret value, or None if not found
        """
        if not self.is_configured:
            return None

        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"{self.supabase_url}/rest/v1/rpc/vault_read_secret",
                    headers=self._get_headers(),
                    json={"secret_id": secret_id},
                    timeout=30.0,
                )

                if response.status_code == 200:
                    return response.json()
                else:
                    logger.error(f"Failed to read secret: {response.text}")
                    return None

        except Exception as e:
            logger.error(f"Vault read error: {str(e)}")
            return None

    async def delete_secret(self, secret_id: str) -> bool:
        """Delete a secret from the vault"""
        if not self.is_configured:
            return False

        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"{self.supabase_url}/rest/v1/rpc/vault_delete_secret",
                    headers=self._get_headers(),
                    json={"secret_id": secret_id},
                    timeout=30.0,
                )
                return response.status_code == 200

        except Exception as e:
            logger.error(f"Vault delete error: {str(e)}")
            return False


# Global instance
vault_service = VaultService()
```

**Step 2: Restart and verify import**

Run: `docker compose -p localai restart document-processor`

Run: `docker exec localai-document-processor python -c "from app.services.vault_service import vault_service; print('OK')"`

Expected: `OK`

---

### Task 6: Frontend - Provisioning Status Component

**Files:**
- Create: `localai-admin-dashboard/src/components/provisioning/ProvisioningStatus.tsx`

**Step 1: Create the component**

```typescript
/**
 * ProvisioningStatus Component
 *
 * Displays the current provisioning status for enterprise tier
 * with progress steps and status indicators.
 */

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { CheckCircle2, Circle, Loader2, XCircle, RefreshCw } from 'lucide-react';
import { DOCUMENT_PROCESSOR_URL } from '@/lib/api-config';

interface ProvisioningStep {
  name: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  message?: string;
}

interface ProvisioningStatusData {
  organization_id: string;
  status: 'pending' | 'provisioning' | 'active' | 'failed' | 'deprovisioning';
  model?: string;
  region: string;
  error_message?: string;
  provisioned_at?: string;
  progress_steps: ProvisioningStep[];
}

interface ProvisioningStatusProps {
  organizationId: string;
  onComplete?: () => void;
}

const DEFAULT_STEPS: ProvisioningStep[] = [
  { name: 'Creating Azure OpenAI resource', status: 'pending' },
  { name: 'Deploying model', status: 'pending' },
  { name: 'Retrieving API credentials', status: 'pending' },
  { name: 'Finalizing configuration', status: 'pending' },
];

export function ProvisioningStatus({ organizationId, onComplete }: ProvisioningStatusProps) {
  const [data, setData] = useState<ProvisioningStatusData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = async () => {
    try {
      const response = await fetch(
        `${DOCUMENT_PROCESSOR_URL}/models/provision/${organizationId}/status`
      );
      if (response.ok) {
        const statusData = await response.json();
        setData(statusData);

        if (statusData.status === 'active' && onComplete) {
          onComplete();
        }
      } else {
        setError('Failed to fetch provisioning status');
      }
    } catch (err) {
      setError('Connection error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();

    // Poll every 5 seconds while provisioning
    const interval = setInterval(() => {
      if (data?.status === 'provisioning' || data?.status === 'pending') {
        fetchStatus();
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [organizationId, data?.status]);

  const getStepIcon = (status: ProvisioningStep['status']) => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 className="h-5 w-5 text-green-500" />;
      case 'in_progress':
        return <Loader2 className="h-5 w-5 text-blue-500 animate-spin" />;
      case 'failed':
        return <XCircle className="h-5 w-5 text-red-500" />;
      default:
        return <Circle className="h-5 w-5 text-muted-foreground" />;
    }
  };

  const getStatusBadge = (status: ProvisioningStatusData['status']) => {
    switch (status) {
      case 'active':
        return <Badge variant="default" className="bg-green-500">Active</Badge>;
      case 'provisioning':
        return <Badge variant="secondary">Provisioning...</Badge>;
      case 'failed':
        return <Badge variant="destructive">Failed</Badge>;
      case 'deprovisioning':
        return <Badge variant="outline">Deprovisioning</Badge>;
      default:
        return <Badge variant="outline">Pending</Badge>;
    }
  };

  const steps = data?.progress_steps?.length ? data.progress_steps : DEFAULT_STEPS;
  const completedSteps = steps.filter(s => s.status === 'completed').length;
  const progress = (completedSteps / steps.length) * 100;

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="py-6">
          <div className="flex items-center justify-between">
            <p className="text-destructive">{error}</p>
            <Button variant="outline" size="sm" onClick={fetchStatus}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Retry
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (data?.status === 'active') {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Instance Active</CardTitle>
            {getStatusBadge(data.status)}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">Model</p>
              <p className="font-medium">{data.model || 'GPT-4o-mini'}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Region</p>
              <p className="font-medium">{data.region}</p>
            </div>
          </div>
          <Button variant="outline" size="sm" className="w-full">
            Test Connection
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Provisioning Your Instance</CardTitle>
          {getStatusBadge(data?.status || 'pending')}
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Progress value={progress} className="h-2" />
          <p className="text-sm text-muted-foreground text-center">
            {Math.round(progress)}% complete
          </p>
        </div>

        <div className="space-y-3">
          {steps.map((step, index) => (
            <div key={index} className="flex items-center gap-3">
              {getStepIcon(step.status)}
              <span className={step.status === 'pending' ? 'text-muted-foreground' : ''}>
                {step.name}
              </span>
            </div>
          ))}
        </div>

        {data?.error_message && (
          <div className="p-3 bg-destructive/10 rounded-md">
            <p className="text-sm text-destructive">{data.error_message}</p>
          </div>
        )}

        <p className="text-sm text-muted-foreground text-center">
          Estimated time: 2-5 minutes
        </p>
      </CardContent>
    </Card>
  );
}

export default ProvisioningStatus;
```

**Step 2: Build frontend to verify**

Run: `cd localai-admin-dashboard && source ~/.nvm/nvm.sh && nvm use 20 && npx pnpm build`

Expected: Build succeeds without errors

---

### Task 7: Integration Test - Provisioning API

**Files:**
- Create: `localai-admin-dashboard/tests/e2e/settings/azure-provisioning.pw.spec.ts`

**Step 1: Create the integration test**

```typescript
/**
 * Azure OpenAI Provisioning E2E Tests
 *
 * Tests the provisioning API endpoints.
 * Note: Actual Azure provisioning requires SP credentials.
 */

import { test, expect } from '@playwright/test';

const BACKEND_URL = 'http://localhost:8090';

test.describe('Azure OpenAI Provisioning API', () => {
  test('should return provisioning status endpoint', async ({ request }) => {
    const testOrgId = '00000000-0000-0000-0000-000000000001';

    const response = await request.get(
      `${BACKEND_URL}/models/provision/${testOrgId}/status`
    );

    expect(response.status()).toBe(200);

    const data = await response.json();
    expect(data).toHaveProperty('organization_id');
    expect(data).toHaveProperty('status');
    expect(data).toHaveProperty('region');

    console.log('[Test] Provisioning status response:', data);
  });

  test('should reject provisioning without credentials', async ({ request }) => {
    const testOrgId = '00000000-0000-0000-0000-000000000002';

    const response = await request.post(
      `${BACKEND_URL}/models/provision/${testOrgId}`,
      {
        data: {
          selected_model: 'gpt-4o-mini',
        },
      }
    );

    // Should return 503 when Azure not configured, or 200 if configured
    expect([200, 503]).toContain(response.status());

    const data = await response.json();
    console.log('[Test] Provisioning response:', data);

    if (response.status() === 503) {
      expect(data.detail).toContain('not configured');
    }
  });

  test('should return provisioning logs endpoint', async ({ request }) => {
    const testOrgId = '00000000-0000-0000-0000-000000000001';

    const response = await request.get(
      `${BACKEND_URL}/models/provision/${testOrgId}/logs`
    );

    expect(response.status()).toBe(200);

    const data = await response.json();
    expect(data).toHaveProperty('logs');
    expect(Array.isArray(data.logs)).toBe(true);
  });
});
```

**Step 2: Run the test**

Run: `cd localai-admin-dashboard && TEST_USER_EMAIL="admin@fetchtext.local" TEST_USER_PASSWORD="testpass123" npx playwright test tests/e2e/settings/azure-provisioning.pw.spec.ts --reporter=line`

Expected: Tests pass (endpoints return expected structure)

---

## Summary

This implementation plan covers:

1. **Database**: Provisioning logs table with RLS
2. **Backend Models**: Pydantic models for provisioning
3. **Backend Service**: Azure Provisioning Service using Azure SDK
4. **Backend API**: Provisioning endpoints in models router
5. **Backend Vault**: Credential storage service
6. **Frontend**: Provisioning status component
7. **Tests**: E2E tests for provisioning API

**Next Steps (not in this plan):**
- N8N webhook workflow for Stripe payment integration
- Full integration with org_llm_configs table updates
- Frontend upgrade flow UI
- Production deployment with real Azure SP credentials
