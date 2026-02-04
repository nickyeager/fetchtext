"""
Azure OpenAI Provisioning Service

Provisions dedicated Azure OpenAI instances for enterprise customers.
"""
import asyncio
import logging
from typing import Optional, Dict, Any

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
from .provisioning_db_service import provisioning_db_service

logger = logging.getLogger(__name__)

# Model to version mapping for Azure OpenAI deployments (eastus region)
# Query available models with: client.models.list(location='eastus')
MODEL_VERSIONS = {
    "gpt-4o": "2024-11-20",      # Latest available version
    "gpt-4o-mini": "2024-07-18", # Only version available for gpt-4o-mini
    "gpt-4": "0613",
    "gpt-35-turbo": "0125",      # Updated to latest available
}

# Timeout for Azure provisioning operations (10 minutes)
PROVISIONING_TIMEOUT_SECONDS = 600


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
            # Use asyncio.to_thread to avoid blocking the event loop
            result = await asyncio.to_thread(
                poller.result, timeout=PROVISIONING_TIMEOUT_SECONDS
            )

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
            version = MODEL_VERSIONS.get(selected_model, "2024-07-18")
            deployment = Deployment(
                sku=Sku(name="Standard", capacity=1),  # Standard SKU with 1K TPM capacity
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
            # Use asyncio.to_thread to avoid blocking the event loop
            await asyncio.to_thread(
                deploy_poller.result, timeout=PROVISIONING_TIMEOUT_SECONDS
            )

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
            # Use asyncio.to_thread to avoid blocking the event loop
            await asyncio.to_thread(
                poller.result, timeout=PROVISIONING_TIMEOUT_SECONDS
            )

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
            logger.exception(f"Failed to get instance status for {instance_name}: {str(e)}")
            return None


# Global instance
azure_provisioning_service = AzureProvisioningService()
