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

# Warning message for unconfigured database
DB_NOT_CONFIGURED_MSG = "Database not configured"


class ProvisioningDBService:
    """Service for provisioning-related database operations"""

    def __init__(self):
        self.supabase_url = settings.SUPABASE_URL
        self.service_role_key = settings.SUPABASE_SERVICE_ROLE_KEY
        self._client: Optional[httpx.AsyncClient] = None

    @property
    def is_configured(self) -> bool:
        """Check if database access is configured"""
        return bool(self.supabase_url and self.service_role_key)

    def _get_client(self) -> httpx.AsyncClient:
        """Get or create the shared httpx client for connection pooling"""
        if self._client is None or self._client.is_closed:
            self._client = httpx.AsyncClient(
                timeout=DB_TIMEOUT_SECONDS,
                headers=self._get_headers(),
            )
        return self._client

    async def close(self):
        """Close the shared httpx client"""
        if self._client is not None and not self._client.is_closed:
            await self._client.aclose()
            self._client = None

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
            logger.warning(DB_NOT_CONFIGURED_MSG)
            return None

        try:
            client = self._get_client()
            response = await client.get(
                f"{self.supabase_url}/rest/v1/organizations",
                params={
                    "id": f"eq.{organization_id}",
                    "select": "slug",
                },
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

        except Exception:
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
            logger.warning(DB_NOT_CONFIGURED_MSG)
            return None

        try:
            client = self._get_client()
            response = await client.post(
                f"{self.supabase_url}/rest/v1/azure_provisioning_logs",
                json={
                    "organization_id": organization_id,
                    "action": action.value,
                    "status": status.value,
                    "details": details or {},
                    "error_message": error_message,
                },
            )

            if response.status_code == 201:
                data = response.json()
                log_id = data[0].get("id") if data else None
                logger.info(f"Wrote provisioning log: {action.value} - {status.value}")
                return log_id
            else:
                logger.error(f"Failed to write log: HTTP {response.status_code} - {response.text}")
                return None

        except Exception:
            logger.exception("Error writing provisioning log")
            return None

    async def get_provisioning_logs(
        self,
        organization_id: str,
        limit: int = 50,
    ) -> List[ProvisioningLogEntry]:
        """Get provisioning logs for an organization"""
        if not self.is_configured:
            logger.warning(DB_NOT_CONFIGURED_MSG)
            return []

        try:
            client = self._get_client()
            response = await client.get(
                f"{self.supabase_url}/rest/v1/azure_provisioning_logs",
                params={
                    "organization_id": f"eq.{organization_id}",
                    "order": "created_at.desc",
                    "limit": limit,
                },
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

        except Exception:
            logger.exception("Error getting provisioning logs")
            return []

    # =========================================================================
    # Organization LLM Config Updates
    # =========================================================================

    async def get_org_llm_config(self, organization_id: str) -> Optional[Dict[str, Any]]:
        """Get the LLM config for an organization"""
        if not self.is_configured:
            return None

        try:
            client = self._get_client()
            response = await client.get(
                f"{self.supabase_url}/rest/v1/organization_llm_configs",
                params={
                    "organization_id": f"eq.{organization_id}",
                    "select": "*",
                },
            )

            if response.status_code == 200:
                data = response.json()
                return data[0] if data else None
            return None

        except Exception:
            logger.exception("Error getting org LLM config")
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

            client = self._get_client()
            response = await client.patch(
                f"{self.supabase_url}/rest/v1/organization_llm_configs",
                params={"organization_id": f"eq.{organization_id}"},
                json=update_data,
            )

            if response.status_code in (200, 204):
                logger.info(f"Updated provisioning status to {status.value}")
                return True
            else:
                logger.error(f"Failed to update status: HTTP {response.status_code}")
                return False

        except Exception:
            logger.exception("Error updating provisioning status")
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
            # Use full organization_id to avoid collision risk
            secret_name = f"azure-openai-key-{organization_id}"
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

            client = self._get_client()
            # First check if config exists
            check_response = await client.get(
                f"{self.supabase_url}/rest/v1/organization_llm_configs",
                params={"organization_id": f"eq.{organization_id}"},
            )

            if check_response.status_code == 200 and check_response.json():
                # Update existing config
                response = await client.patch(
                    f"{self.supabase_url}/rest/v1/organization_llm_configs",
                    params={"organization_id": f"eq.{organization_id}"},
                    json=update_data,
                )
            else:
                # Insert new config
                update_data["organization_id"] = organization_id
                response = await client.post(
                    f"{self.supabase_url}/rest/v1/organization_llm_configs",
                    json=update_data,
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

        except Exception:
            logger.exception("Error completing provisioning")
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

        except Exception:
            logger.exception("Error starting deprovisioning")
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
                vault_deleted = True
                if vault_id:
                    vault_deleted = await vault_service.delete_secret(vault_id)
                    if not vault_deleted:
                        logger.warning(
                            f"Failed to delete vault secret {vault_id} for org {organization_id}. "
                            "Secret will be orphaned - manual cleanup may be required."
                        )

                # Reset org config to non-managed tier
                # Only clear credentials_vault_id if vault deletion succeeded
                # Note: provisioning_status is set to ACTIVE (not "none" or null) because
                # ACTIVE means "stable state, no provisioning operation in progress".
                # The tier="non_managed" indicates the org has no dedicated Azure resources.
                update_data = {
                    "tier": "non_managed",
                    "provider_type": "shared",
                    "deployment_model": None,
                    "credentials_vault_id": None if vault_deleted else vault_id,
                    "custom_endpoint": None,
                    "azure_instance_name": None,
                    "azure_resource_id": None,
                    "azure_subscription_id": None,
                    "azure_resource_group": None,
                    "provisioning_status": ProvisioningStatus.ACTIVE.value,
                    "provisioning_error": None,
                    "provisioned_at": None,
                }

                client = self._get_client()
                response = await client.patch(
                    f"{self.supabase_url}/rest/v1/organization_llm_configs",
                    params={"organization_id": f"eq.{organization_id}"},
                    json=update_data,
                )

                # Check response status
                if response.status_code not in (200, 204):
                    logger.error(
                        f"Failed to reset org config: HTTP {response.status_code}"
                    )
                    return False

                # Log completion
                await self.write_provisioning_log(
                    organization_id=organization_id,
                    action=ProvisioningAction.DELETE_RESOURCE,
                    status=ProvisioningLogStatus.COMPLETED,
                    details={"vault_deleted": vault_deleted, "vault_id": vault_id},
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

        except Exception:
            logger.exception("Error completing deprovisioning")
            return False


# Global instance
provisioning_db_service = ProvisioningDBService()
