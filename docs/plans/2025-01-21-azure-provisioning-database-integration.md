# Azure Provisioning Database Integration Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Complete the Azure OpenAI provisioning feature by adding database integration - Vault RPC functions, log persistence, org config updates, and replacing all TODO placeholders.

**Architecture:** Create Supabase Vault RPC functions for secure credential storage → Build provisioning database service for org lookups and config updates → Replace TODO placeholders in API endpoints with real database queries → Integration tests verify end-to-end flow.

**Tech Stack:** PostgreSQL/Supabase (RPC functions, Vault), Python/FastAPI (services), httpx (Supabase API calls), Playwright (E2E tests)

**Deferred:** N8N webhook workflow for Stripe payment integration (separate plan when backend is complete)

---

### Task 1: Database Migration - Vault RPC Functions

**Files:**
- Create: `supabase/migrations/021_add_vault_rpc_functions.sql`

**Step 1: Create the migration file**

```sql
-- Migration: 021_add_vault_rpc_functions
-- Description: Add RPC functions for secure credential storage via Supabase Vault
-- Date: 2025-01-21

-- ============================================================================
-- Vault Extension Check
-- ============================================================================
-- Note: Supabase Vault extension should already be enabled. If not:
-- CREATE EXTENSION IF NOT EXISTS supabase_vault;

-- ============================================================================
-- Vault RPC Functions
-- ============================================================================

-- Insert a new secret into the vault
-- Returns the secret UUID
CREATE OR REPLACE FUNCTION vault_insert_secret(
  new_name TEXT,
  new_secret TEXT,
  new_description TEXT DEFAULT ''
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = vault, public
AS $$
DECLARE
  secret_id UUID;
BEGIN
  INSERT INTO vault.secrets (name, secret, description)
  VALUES (new_name, new_secret, new_description)
  RETURNING id INTO secret_id;

  RETURN secret_id;
END;
$$;

-- Read a secret from the vault by ID
-- Returns the decrypted secret value
CREATE OR REPLACE FUNCTION vault_read_secret(
  secret_id UUID
) RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = vault, public
AS $$
DECLARE
  secret_value TEXT;
BEGIN
  SELECT decrypted_secret INTO secret_value
  FROM vault.decrypted_secrets
  WHERE id = secret_id;

  RETURN secret_value;
END;
$$;

-- Delete a secret from the vault by ID
-- Returns true if deleted, false if not found
CREATE OR REPLACE FUNCTION vault_delete_secret(
  secret_id UUID
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = vault, public
AS $$
DECLARE
  rows_deleted INTEGER;
BEGIN
  DELETE FROM vault.secrets
  WHERE id = secret_id;

  GET DIAGNOSTICS rows_deleted = ROW_COUNT;

  RETURN rows_deleted > 0;
END;
$$;

-- ============================================================================
-- Comments
-- ============================================================================

COMMENT ON FUNCTION vault_insert_secret IS 'Store a secret in Supabase Vault. Returns the secret UUID.';
COMMENT ON FUNCTION vault_read_secret IS 'Retrieve and decrypt a secret from Vault by ID.';
COMMENT ON FUNCTION vault_delete_secret IS 'Delete a secret from Vault. Returns true if deleted.';
```

**Step 2: Apply migration to local Docker Supabase**

Run: `docker exec supabase-db psql -U postgres -d postgres -f /dev/stdin < supabase/migrations/021_add_vault_rpc_functions.sql`

Or copy and execute:
```bash
cat supabase/migrations/021_add_vault_rpc_functions.sql | docker exec -i supabase-db psql -U postgres -d postgres
```

Expected: Functions created successfully

**Step 3: Reload PostgREST schema cache**

Run: `docker kill -s SIGUSR1 supabase-rest`

Expected: Schema cache reloaded

**Step 4: Verify functions exist**

Run: `docker exec supabase-db psql -U postgres -d postgres -c "\df vault_*"`

Expected: Three functions listed: vault_insert_secret, vault_read_secret, vault_delete_secret

---

### Task 2: Backend - Provisioning Database Service

**Files:**
- Create: `document-processor/app/services/provisioning_db_service.py`

**Step 1: Create the provisioning database service**

```python
"""
Provisioning Database Service

Handles database operations for Azure OpenAI provisioning:
- Organization lookups
- Provisioning log persistence
- org_llm_configs updates
"""
import logging
from typing import Optional, List, Dict, Any
from datetime import datetime
import httpx

from ..config import settings
from ..models.provisioning import (
    ProvisioningAction,
    ProvisioningLogStatus,
    ProvisioningStatus,
    ProvisioningLogEntry,
)
from .vault_service import vault_service

logger = logging.getLogger(__name__)

# Timeout for database API requests
DB_TIMEOUT_SECONDS = 30.0


class ProvisioningDBService:
    """Service for provisioning-related database operations"""

    def __init__(self):
        self.supabase_url = settings.SUPABASE_URL
        self.service_role_key = settings.SUPABASE_SERVICE_ROLE_KEY

    @property
    def is_configured(self) -> bool:
        """Check if database access is configured"""
        return bool(self.supabase_url and self.service_role_key)

    def _get_headers(self) -> dict:
        """Get headers for Supabase API requests"""
        return {
            "apikey": self.service_role_key,
            "Authorization": f"Bearer {self.service_role_key}",
            "Content-Type": "application/json",
            "Prefer": "return=representation",
        }

    # =========================================================================
    # Organization Lookups
    # =========================================================================

    async def get_organization_slug(self, organization_id: str) -> Optional[str]:
        """Get the slug for an organization by ID"""
        if not self.is_configured:
            logger.warning("Database not configured")
            return None

        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    f"{self.supabase_url}/rest/v1/organizations",
                    headers=self._get_headers(),
                    params={
                        "id": f"eq.{organization_id}",
                        "select": "slug",
                    },
                    timeout=DB_TIMEOUT_SECONDS,
                )

                if response.status_code == 200:
                    data = response.json()
                    if data and len(data) > 0:
                        return data[0].get("slug")
                    logger.warning(f"Organization not found: {organization_id}")
                    return None
                else:
                    logger.error(f"Failed to get org slug: HTTP {response.status_code}")
                    return None

        except Exception as e:
            logger.exception(f"Error getting org slug for {organization_id}")
            return None

    # =========================================================================
    # Provisioning Logs
    # =========================================================================

    async def write_provisioning_log(
        self,
        organization_id: str,
        action: ProvisioningAction,
        status: ProvisioningLogStatus,
        details: Optional[Dict[str, Any]] = None,
        error_message: Optional[str] = None,
    ) -> Optional[str]:
        """Write a provisioning log entry to azure_provisioning_logs"""
        if not self.is_configured:
            logger.warning("Database not configured")
            return None

        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"{self.supabase_url}/rest/v1/azure_provisioning_logs",
                    headers=self._get_headers(),
                    json={
                        "organization_id": organization_id,
                        "action": action.value,
                        "status": status.value,
                        "details": details or {},
                        "error_message": error_message,
                    },
                    timeout=DB_TIMEOUT_SECONDS,
                )

                if response.status_code == 201:
                    data = response.json()
                    log_id = data[0].get("id") if data else None
                    logger.info(f"Wrote provisioning log: {action.value} - {status.value}")
                    return log_id
                else:
                    logger.error(f"Failed to write log: HTTP {response.status_code} - {response.text}")
                    return None

        except Exception as e:
            logger.exception(f"Error writing provisioning log")
            return None

    async def get_provisioning_logs(
        self,
        organization_id: str,
        limit: int = 50,
    ) -> List[ProvisioningLogEntry]:
        """Get provisioning logs for an organization"""
        if not self.is_configured:
            logger.warning("Database not configured")
            return []

        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    f"{self.supabase_url}/rest/v1/azure_provisioning_logs",
                    headers=self._get_headers(),
                    params={
                        "organization_id": f"eq.{organization_id}",
                        "order": "created_at.desc",
                        "limit": limit,
                    },
                    timeout=DB_TIMEOUT_SECONDS,
                )

                if response.status_code == 200:
                    data = response.json()
                    return [
                        ProvisioningLogEntry(
                            id=row["id"],
                            organization_id=row["organization_id"],
                            action=ProvisioningAction(row["action"]),
                            status=ProvisioningLogStatus(row["status"]),
                            details=row.get("details", {}),
                            error_message=row.get("error_message"),
                            created_at=datetime.fromisoformat(row["created_at"].replace("Z", "+00:00")),
                        )
                        for row in data
                    ]
                else:
                    logger.error(f"Failed to get logs: HTTP {response.status_code}")
                    return []

        except Exception as e:
            logger.exception(f"Error getting provisioning logs")
            return []

    # =========================================================================
    # Organization LLM Config Updates
    # =========================================================================

    async def get_org_llm_config(self, organization_id: str) -> Optional[Dict[str, Any]]:
        """Get the LLM config for an organization"""
        if not self.is_configured:
            return None

        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    f"{self.supabase_url}/rest/v1/organization_llm_configs",
                    headers=self._get_headers(),
                    params={
                        "organization_id": f"eq.{organization_id}",
                        "select": "*",
                    },
                    timeout=DB_TIMEOUT_SECONDS,
                )

                if response.status_code == 200:
                    data = response.json()
                    return data[0] if data else None
                return None

        except Exception as e:
            logger.exception(f"Error getting org LLM config")
            return None

    async def update_provisioning_status(
        self,
        organization_id: str,
        status: ProvisioningStatus,
        error_message: Optional[str] = None,
    ) -> bool:
        """Update the provisioning status for an organization"""
        if not self.is_configured:
            return False

        try:
            update_data = {
                "provisioning_status": status.value,
                "provisioning_error": error_message,
            }

            async with httpx.AsyncClient() as client:
                response = await client.patch(
                    f"{self.supabase_url}/rest/v1/organization_llm_configs",
                    headers=self._get_headers(),
                    params={"organization_id": f"eq.{organization_id}"},
                    json=update_data,
                    timeout=DB_TIMEOUT_SECONDS,
                )

                if response.status_code in (200, 204):
                    logger.info(f"Updated provisioning status to {status.value}")
                    return True
                else:
                    logger.error(f"Failed to update status: HTTP {response.status_code}")
                    return False

        except Exception as e:
            logger.exception(f"Error updating provisioning status")
            return False

    async def complete_provisioning(
        self,
        organization_id: str,
        endpoint: str,
        api_key: str,
        deployment_name: str,
        azure_instance_name: str,
        azure_resource_id: Optional[str] = None,
    ) -> bool:
        """
        Complete provisioning by storing credentials and updating org config.

        Steps:
        1. Store API key in Vault
        2. Update org_llm_configs with all provisioning details
        """
        if not self.is_configured:
            return False

        try:
            # Step 1: Store API key in Vault
            secret_name = f"azure-openai-key-{organization_id[:8]}"
            vault_id = await vault_service.store_secret(
                name=secret_name,
                secret=api_key,
                description=f"Azure OpenAI API key for org {organization_id}",
            )

            if not vault_id:
                logger.error("Failed to store API key in Vault")
                return False

            # Step 2: Update org_llm_configs
            update_data = {
                "tier": "enterprise",
                "provider_type": "byok_azure",
                "deployment_model": "managed_ours",
                "credentials_vault_id": str(vault_id),
                "custom_endpoint": endpoint,
                "azure_instance_name": azure_instance_name,
                "azure_resource_id": azure_resource_id,
                "azure_subscription_id": settings.AZURE_SUBSCRIPTION_ID,
                "azure_resource_group": settings.AZURE_CUSTOMER_RESOURCE_GROUP,
                "provisioning_status": ProvisioningStatus.ACTIVE.value,
                "provisioning_error": None,
                "provisioned_at": datetime.utcnow().isoformat(),
            }

            async with httpx.AsyncClient() as client:
                # First check if config exists
                check_response = await client.get(
                    f"{self.supabase_url}/rest/v1/organization_llm_configs",
                    headers=self._get_headers(),
                    params={"organization_id": f"eq.{organization_id}"},
                    timeout=DB_TIMEOUT_SECONDS,
                )

                if check_response.status_code == 200 and check_response.json():
                    # Update existing config
                    response = await client.patch(
                        f"{self.supabase_url}/rest/v1/organization_llm_configs",
                        headers=self._get_headers(),
                        params={"organization_id": f"eq.{organization_id}"},
                        json=update_data,
                        timeout=DB_TIMEOUT_SECONDS,
                    )
                else:
                    # Insert new config
                    update_data["organization_id"] = organization_id
                    response = await client.post(
                        f"{self.supabase_url}/rest/v1/organization_llm_configs",
                        headers=self._get_headers(),
                        json=update_data,
                        timeout=DB_TIMEOUT_SECONDS,
                    )

                if response.status_code in (200, 201, 204):
                    logger.info(f"Completed provisioning for {organization_id}")

                    # Log the completion
                    await self.write_provisioning_log(
                        organization_id=organization_id,
                        action=ProvisioningAction.STORE_CREDENTIALS,
                        status=ProvisioningLogStatus.COMPLETED,
                        details={"vault_id": str(vault_id), "endpoint": endpoint},
                    )

                    return True
                else:
                    logger.error(f"Failed to update org config: HTTP {response.status_code}")
                    return False

        except Exception as e:
            logger.exception(f"Error completing provisioning")
            return False

    async def start_deprovisioning(
        self,
        organization_id: str,
    ) -> Optional[str]:
        """
        Start deprovisioning - get instance name and update status.
        Returns the azure_instance_name if found.
        """
        if not self.is_configured:
            return None

        try:
            # Get current config
            config = await self.get_org_llm_config(organization_id)
            if not config:
                logger.warning(f"No config found for {organization_id}")
                return None

            instance_name = config.get("azure_instance_name")
            if not instance_name:
                logger.warning(f"No instance name found for {organization_id}")
                return None

            # Update status to deprovisioning
            await self.update_provisioning_status(
                organization_id=organization_id,
                status=ProvisioningStatus.DEPROVISIONING,
            )

            # Log the start
            await self.write_provisioning_log(
                organization_id=organization_id,
                action=ProvisioningAction.DELETE_RESOURCE,
                status=ProvisioningLogStatus.STARTED,
                details={"instance_name": instance_name},
            )

            return instance_name

        except Exception as e:
            logger.exception(f"Error starting deprovisioning")
            return None

    async def complete_deprovisioning(
        self,
        organization_id: str,
        success: bool,
        error_message: Optional[str] = None,
    ) -> bool:
        """Complete deprovisioning - clean up config and vault"""
        if not self.is_configured:
            return False

        try:
            # Get current config for vault cleanup
            config = await self.get_org_llm_config(organization_id)

            if success:
                # Delete vault secret if exists
                vault_id = config.get("credentials_vault_id") if config else None
                if vault_id:
                    await vault_service.delete_secret(vault_id)

                # Reset org config to non-managed tier
                update_data = {
                    "tier": "non_managed",
                    "provider_type": "shared",
                    "deployment_model": None,
                    "credentials_vault_id": None,
                    "custom_endpoint": None,
                    "azure_instance_name": None,
                    "azure_resource_id": None,
                    "azure_subscription_id": None,
                    "azure_resource_group": None,
                    "provisioning_status": ProvisioningStatus.ACTIVE.value,
                    "provisioning_error": None,
                    "provisioned_at": None,
                }

                async with httpx.AsyncClient() as client:
                    response = await client.patch(
                        f"{self.supabase_url}/rest/v1/organization_llm_configs",
                        headers=self._get_headers(),
                        params={"organization_id": f"eq.{organization_id}"},
                        json=update_data,
                        timeout=DB_TIMEOUT_SECONDS,
                    )

                # Log completion
                await self.write_provisioning_log(
                    organization_id=organization_id,
                    action=ProvisioningAction.DELETE_RESOURCE,
                    status=ProvisioningLogStatus.COMPLETED,
                    details={},
                )

                return True
            else:
                # Log failure
                await self.write_provisioning_log(
                    organization_id=organization_id,
                    action=ProvisioningAction.DELETE_RESOURCE,
                    status=ProvisioningLogStatus.FAILED,
                    error_message=error_message,
                )

                await self.update_provisioning_status(
                    organization_id=organization_id,
                    status=ProvisioningStatus.FAILED,
                    error_message=error_message,
                )

                return False

        except Exception as e:
            logger.exception(f"Error completing deprovisioning")
            return False


# Global instance
provisioning_db_service = ProvisioningDBService()
```

**Step 2: Rebuild the container**

Run: `docker compose -p localai up -d --build document-processor`

**Step 3: Verify import works**

Run: `docker exec localai-document-processor python -c "from app.services.provisioning_db_service import provisioning_db_service; print('OK')"`

Expected: `OK`

---

### Task 3: Backend - Update Provisioning Service to Use DB Service

**Files:**
- Modify: `document-processor/app/services/azure_provisioning_service.py`

**Step 1: Add db service integration to provision_instance**

Add import at top of file (after existing imports):

```python
from .provisioning_db_service import provisioning_db_service
```

**Step 2: Update provision_instance to persist logs and complete provisioning**

Replace the try block in `provision_instance` method (lines 109-227) with:

```python
        try:
            client = self._get_client()

            # Create log callback that persists to database
            async def db_log_callback(action, status, details, error_message=None):
                if log_callback:
                    await log_callback(action, status, details)
                await provisioning_db_service.write_provisioning_log(
                    organization_id=organization_id,
                    action=action,
                    status=status,
                    details=details,
                    error_message=error_message,
                )

            # Update status to provisioning
            await provisioning_db_service.update_provisioning_status(
                organization_id=organization_id,
                status=ProvisioningStatus.PROVISIONING,
            )

            # Log: Starting resource creation
            await db_log_callback(
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
            result = poller.result(timeout=PROVISIONING_TIMEOUT_SECONDS)

            await db_log_callback(
                ProvisioningAction.CREATE_RESOURCE,
                ProvisioningLogStatus.COMPLETED,
                {"resource_id": result.id},
            )

            # Step 2: Deploy the model
            await db_log_callback(
                ProvisioningAction.DEPLOY_MODEL,
                ProvisioningLogStatus.STARTED,
                {"model": selected_model},
            )

            logger.info(f"Deploying model {selected_model} to {instance_name}")
            deployment_name = f"{selected_model.replace('.', '-')}-deployment"
            version = MODEL_VERSIONS.get(selected_model, "2024-08-06")
            deployment = Deployment(
                properties=DeploymentProperties(
                    model=DeploymentModel(
                        format="OpenAI",
                        name=selected_model,
                        version=version,
                    ),
                )
            )

            deploy_poller = client.deployments.begin_create_or_update(
                resource_group_name=resource_group,
                account_name=instance_name,
                deployment_name=deployment_name,
                deployment=deployment,
            )
            deploy_result = deploy_poller.result(timeout=PROVISIONING_TIMEOUT_SECONDS)

            await db_log_callback(
                ProvisioningAction.DEPLOY_MODEL,
                ProvisioningLogStatus.COMPLETED,
                {"deployment_name": deployment_name},
            )

            # Step 3: Get API keys
            await db_log_callback(
                ProvisioningAction.GET_KEYS,
                ProvisioningLogStatus.STARTED,
                {},
            )

            logger.info(f"Retrieving API keys for {instance_name}")
            keys = client.accounts.list_keys(
                resource_group_name=resource_group,
                account_name=instance_name,
            )

            await db_log_callback(
                ProvisioningAction.GET_KEYS,
                ProvisioningLogStatus.COMPLETED,
                {"has_key1": bool(keys.key1), "has_key2": bool(keys.key2)},
            )

            endpoint = f"https://{instance_name}.openai.azure.com/"

            # Step 4: Store credentials and update org config
            success = await provisioning_db_service.complete_provisioning(
                organization_id=organization_id,
                endpoint=endpoint,
                api_key=keys.key1,
                deployment_name=deployment_name,
                azure_instance_name=instance_name,
                azure_resource_id=result.id,
            )

            if not success:
                logger.error("Failed to complete provisioning in database")
                return ProvisioningResult(
                    success=False,
                    status=ProvisioningStatus.FAILED,
                    message="Failed to store credentials",
                    error="Database update failed",
                )

            return ProvisioningResult(
                success=True,
                status=ProvisioningStatus.ACTIVE,
                message=f"Successfully provisioned {instance_name}",
                endpoint=endpoint,
                deployment_name=deployment_name,
                # Note: API key is now stored in Vault, not returned
            )

        except Exception as e:
            logger.exception(f"Provisioning failed for {instance_name}: {str(e)}")
            await provisioning_db_service.write_provisioning_log(
                organization_id=organization_id,
                action=ProvisioningAction.CREATE_RESOURCE,
                status=ProvisioningLogStatus.FAILED,
                error_message=str(e),
            )
            await provisioning_db_service.update_provisioning_status(
                organization_id=organization_id,
                status=ProvisioningStatus.FAILED,
                error_message=str(e),
            )
            return ProvisioningResult(
                success=False,
                status=ProvisioningStatus.FAILED,
                message="Provisioning failed",
                error=str(e),
            )
```

**Step 3: Update deprovision_instance to use DB service**

Replace the `deprovision_instance` method body with:

```python
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

            poller = client.accounts.begin_delete(
                resource_group_name=resource_group,
                account_name=instance_name,
            )
            poller.result(timeout=PROVISIONING_TIMEOUT_SECONDS)

            # Complete deprovisioning in database
            await provisioning_db_service.complete_deprovisioning(
                organization_id=organization_id,
                success=True,
            )

            return True

        except Exception as e:
            logger.exception(f"Deprovisioning failed for {instance_name}: {str(e)}")
            await provisioning_db_service.complete_deprovisioning(
                organization_id=organization_id,
                success=False,
                error_message=str(e),
            )
            return False
```

**Step 4: Restart container**

Run: `docker compose -p localai restart document-processor`

---

### Task 4: Backend - Replace TODO Placeholders in API Endpoints

**Files:**
- Modify: `document-processor/app/routers/models.py`

**Step 1: Add import for provisioning_db_service**

Add after existing provisioning imports (around line 25):

```python
from ..services.provisioning_db_service import provisioning_db_service
```

**Step 2: Update provision_azure_openai endpoint (replace lines 652-660)**

Replace the TODO section with:

```python
        # Get org slug from database
        org_slug = await provisioning_db_service.get_organization_slug(organization_id)
        if not org_slug:
            # Fallback to ID prefix if org not found
            org_slug = f"org-{organization_id[:ORG_SLUG_ID_PREFIX_LENGTH]}"
            logger.warning(f"Organization not found, using fallback slug: {org_slug}")

        # Run provisioning (in production, use background task)
        result = await azure_provisioning_service.provision_instance(
            organization_id=organization_id,
            org_slug=org_slug,
            selected_model=request.selected_model,
        )
```

**Step 3: Update get_provisioning_status endpoint (replace lines 683-690)**

Replace the TODO section with:

```python
        # Query org_llm_configs for status
        config = await provisioning_db_service.get_org_llm_config(organization_id)

        if config:
            # Get progress steps from logs
            logs = await provisioning_db_service.get_provisioning_logs(organization_id, limit=10)
            progress_steps = [
                {
                    "name": log.action.value.replace("_", " ").title(),
                    "status": log.status.value,
                    "message": log.error_message,
                }
                for log in logs
            ]

            return ProvisioningStatusResponse(
                organization_id=organization_id,
                status=ProvisioningStatus(config.get("provisioning_status", "pending")),
                model=config.get("deployment_model"),
                region=settings.AZURE_CUSTOMER_LOCATION,
                error_message=config.get("provisioning_error"),
                provisioned_at=config.get("provisioned_at"),
                progress_steps=progress_steps,
            )
        else:
            # No config exists - return pending status
            return ProvisioningStatusResponse(
                organization_id=organization_id,
                status=ProvisioningStatus.PENDING,
                region=settings.AZURE_CUSTOMER_LOCATION,
                progress_steps=[],
            )
```

**Step 4: Update deprovision_azure_openai endpoint (replace lines 711-716)**

Replace the TODO section with:

```python
        # Get instance name and start deprovisioning
        instance_name = await provisioning_db_service.start_deprovisioning(organization_id)

        if not instance_name:
            return DeprovisioningResponse(
                status="failed",
                message="No active provisioning found for this organization",
                organization_id=organization_id,
            )

        # Run deprovisioning (in production, use background task)
        if azure_provisioning_service.is_configured:
            success = await azure_provisioning_service.deprovision_instance(
                organization_id=organization_id,
                instance_name=instance_name,
            )

            if success:
                return DeprovisioningResponse(
                    status="completed",
                    message=f"Successfully deprovisioned {instance_name}",
                    organization_id=organization_id,
                )
            else:
                return DeprovisioningResponse(
                    status="failed",
                    message="Deprovisioning failed - check logs",
                    organization_id=organization_id,
                )
        else:
            # Azure not configured - just clean up database
            await provisioning_db_service.complete_deprovisioning(
                organization_id=organization_id,
                success=True,
            )
            return DeprovisioningResponse(
                status="completed",
                message="Cleaned up provisioning records (Azure not configured)",
                organization_id=organization_id,
            )
```

**Step 5: Update get_provisioning_logs endpoint (replace lines 737-741)**

Replace the TODO section with:

```python
        # Query azure_provisioning_logs table
        logs = await provisioning_db_service.get_provisioning_logs(organization_id)

        return ProvisioningLogsResponse(
            organization_id=organization_id,
            logs=logs,
        )
```

**Step 6: Restart container**

Run: `docker compose -p localai restart document-processor`

---

### Task 5: Integration Test - Database Integration

**Files:**
- Modify: `localai-admin-dashboard/tests/e2e/settings/azure-provisioning.pw.spec.ts`

**Step 1: Add database integration tests**

Add these tests after the existing tests (before the Summary section):

```typescript
  // ===========================================================================
  // Database Integration Tests
  // ===========================================================================

  test.describe('Database Integration', () => {
    test('should return actual status from database', async ({ request }) => {
      const testOrgId = '00000000-0000-0000-0000-000000000001';

      const response = await request.get(
        `${BACKEND_URL}/models/provision/${testOrgId}/status`
      );

      expect(response.status()).toBe(200);
      const data = await response.json();

      // Verify response contains database fields
      console.log('[Test] Status from database:', JSON.stringify(data, null, 2));

      expect(data).toHaveProperty('organization_id', testOrgId);
      expect(data).toHaveProperty('status');
      expect(data).toHaveProperty('region');
      expect(data).toHaveProperty('progress_steps');
      expect(Array.isArray(data.progress_steps)).toBe(true);

      // Status should be a valid provisioning status
      const validStatuses = ['pending', 'provisioning', 'active', 'failed', 'deprovisioning'];
      expect(validStatuses).toContain(data.status);
    });

    test('should persist and retrieve provisioning logs', async ({ request }) => {
      const testOrgId = '00000000-0000-0000-0000-000000000001';

      const response = await request.get(
        `${BACKEND_URL}/models/provision/${testOrgId}/logs`
      );

      expect(response.status()).toBe(200);
      const data = await response.json();

      console.log('[Test] Provisioning logs:', JSON.stringify(data, null, 2));

      expect(data).toHaveProperty('organization_id', testOrgId);
      expect(data).toHaveProperty('logs');
      expect(Array.isArray(data.logs)).toBe(true);

      // If there are logs, verify structure
      if (data.logs.length > 0) {
        const log = data.logs[0];
        expect(log).toHaveProperty('id');
        expect(log).toHaveProperty('action');
        expect(log).toHaveProperty('status');
        expect(log).toHaveProperty('created_at');

        const validActions = ['create_resource', 'deploy_model', 'get_keys', 'store_credentials', 'delete_resource', 'retry'];
        expect(validActions).toContain(log.action);

        const validStatuses = ['started', 'completed', 'failed'];
        expect(validStatuses).toContain(log.status);
      }
    });

    test('should handle deprovision request with proper response', async ({ request }) => {
      const testOrgId = '00000000-0000-0000-0000-000000000003';

      const response = await request.delete(
        `${BACKEND_URL}/models/provision/${testOrgId}`
      );

      expect(response.status()).toBe(200);
      const data = await response.json();

      console.log('[Test] Deprovision response:', JSON.stringify(data, null, 2));

      expect(data).toHaveProperty('status');
      expect(data).toHaveProperty('message');
      expect(data).toHaveProperty('organization_id', testOrgId);

      // Should be either completed (no config), failed (no config), or actually deprovisioning
      const validStatuses = ['completed', 'failed', 'deprovisioning'];
      expect(validStatuses).toContain(data.status);
    });
  });
```

**Step 2: Run the tests**

Run: `cd localai-admin-dashboard && export PATH="/opt/homebrew/bin:$PATH" && TEST_USER_EMAIL="admin@fetchtext.local" TEST_USER_PASSWORD="testpass123" npx playwright test tests/e2e/settings/azure-provisioning.pw.spec.ts --reporter=line`

Expected: All tests pass

---

### Task 6: Verify End-to-End Flow

**Files:**
- No new files

**Step 1: Test Vault RPC functions directly**

Run:
```bash
docker exec supabase-db psql -U postgres -d postgres -c "SELECT vault_insert_secret('test-key', 'test-secret-value', 'test description');"
```

Expected: Returns a UUID

**Step 2: Verify the secret can be read**

Run (replace UUID with the one returned):
```bash
docker exec supabase-db psql -U postgres -d postgres -c "SELECT vault_read_secret('YOUR-UUID-HERE');"
```

Expected: Returns 'test-secret-value'

**Step 3: Delete the test secret**

Run (replace UUID):
```bash
docker exec supabase-db psql -U postgres -d postgres -c "SELECT vault_delete_secret('YOUR-UUID-HERE');"
```

Expected: Returns true

**Step 4: Test API endpoints with curl**

Test status endpoint:
```bash
curl -s http://localhost:8090/models/provision/test-org-123/status | python3 -m json.tool
```

Test logs endpoint:
```bash
curl -s http://localhost:8090/models/provision/test-org-123/logs | python3 -m json.tool
```

Expected: Both return valid JSON with proper structure

---

## Summary

This implementation plan completes the Azure OpenAI provisioning database integration:

1. **Task 1**: Vault RPC functions for secure credential storage
2. **Task 2**: Provisioning database service for all DB operations
3. **Task 3**: Update provisioning service to persist logs and credentials
4. **Task 4**: Replace all TODO placeholders in API endpoints
5. **Task 5**: Integration tests for database functionality
6. **Task 6**: End-to-end verification

**Deferred to future plan:**
- N8N webhook workflow for Stripe payment integration
- Frontend upgrade flow UI integration

**After completion:**
- All 4 provisioning API endpoints will return real data from the database
- Provisioning logs will be persisted to `azure_provisioning_logs` table
- API keys will be securely stored in Supabase Vault
- `organization_llm_configs` will be updated with provisioning details
