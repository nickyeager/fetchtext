"""
AI model management endpoints for multiple providers

Supports both system-wide defaults and per-organization configurations.
"""
import aiohttp
import logging
import uuid
from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional
from enum import Enum

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/models", tags=["models"])

# Import configuration and services
from ..config import settings, model_config, provider_config, AIProvider, LLMTier, LLMProviderType
from ..config.database import db_config
from ..services.azure_openai_service import azure_openai_service
from ..models.provisioning import (
    ProvisioningRequest,
    ProvisioningStatusResponse,
    ProvisioningStatus,
    ProvisioningResult,
    ProvisioningAction,
    ProvisioningLogStatus,
    DeprovisioningResponse,
    ProvisioningLogsResponse,
)
# Conditionally import Azure provisioning service (requires azure-mgmt package)
try:
    from ..services.azure_provisioning_service import azure_provisioning_service
    AZURE_PROVISIONING_AVAILABLE = True
except ImportError:
    azure_provisioning_service = None
    AZURE_PROVISIONING_AVAILABLE = False
    logger.warning("Azure provisioning service not available - azure-mgmt packages not installed")

from ..services.provisioning_db_service import provisioning_db_service

# Use first 8 characters of org ID for slug generation
ORG_SLUG_ID_PREFIX_LENGTH = 8

# Error messages
INVALID_ORG_ID_ERROR = "Invalid organization_id"
INVALID_ORG_ID_FORMAT_ERROR = "organization_id must be a valid UUID"

# Configuration
OLLAMA_URL = "http://ollama-cpu:11434"


def validate_organization_id(organization_id: str) -> str:
    """
    Validate that organization_id is a valid UUID.

    Raises HTTPException with 400 status if invalid.
    Returns the organization_id if valid.
    """
    if not organization_id or not organization_id.strip():
        raise HTTPException(status_code=400, detail=INVALID_ORG_ID_ERROR)
    try:
        uuid.UUID(organization_id)
    except ValueError:
        raise HTTPException(status_code=400, detail=INVALID_ORG_ID_FORMAT_ERROR)
    return organization_id

class ModelInfo(BaseModel):
    name: str
    size: int | str  # Ollama API returns int, but we'll handle both
    modified: str = ""
    digest: str = ""
    provider: str = ""

class ModelSelectionRequest(BaseModel):
    model_name: str

class ModelsResponse(BaseModel):
    models: List[ModelInfo]
    current_model: str
    current_provider: str

class ProviderInfo(BaseModel):
    name: str
    display_name: str
    available: bool
    configured: bool

class ProvidersResponse(BaseModel):
    providers: List[ProviderInfo]
    current_provider: str

class ProviderSelectionRequest(BaseModel):
    provider: str

@router.get("/providers", response_model=ProvidersResponse)
async def get_available_providers():
    """
    Get list of available AI providers
    """
    providers = [
        ProviderInfo(
            name=AIProvider.OLLAMA.value,
            display_name="Ollama (Local)",
            available=True,
            configured=True  # Always available locally
        ),
        ProviderInfo(
            name=AIProvider.AZURE_OPENAI.value,
            display_name="Azure OpenAI",
            available=True,
            configured=settings.is_azure_configured()
        )
    ]
    
    return ProvidersResponse(
        providers=providers,
        current_provider=provider_config.current_provider.value
    )

@router.post("/provider/select")
async def set_active_provider(request: ProviderSelectionRequest):
    """
    Switch to a different AI provider
    """
    try:
        # Validate provider
        try:
            new_provider = AIProvider(request.provider)
        except ValueError:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid provider: {request.provider}"
            )
        
        # Check if provider is configured
        if new_provider == AIProvider.AZURE_OPENAI and not settings.is_azure_configured():
            raise HTTPException(
                status_code=400,
                detail="Azure OpenAI is not properly configured"
            )
        
        # Update provider
        provider_config.current_provider = new_provider
        
        return {
            "status": "success",
            "message": f"Active provider set to {new_provider.value}",
            "provider": new_provider.value
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error setting active provider: {e}")
        raise HTTPException(
            status_code=500,
            detail="Internal server error while setting active provider"
        )

@router.get("/", response_model=ModelsResponse)
async def get_available_models():
    """
    Fetch available models based on current provider
    """
    current_provider = provider_config.current_provider
    
    try:
        if current_provider == AIProvider.OLLAMA:
            # Fetch Ollama models
            async with aiohttp.ClientSession() as session:
                async with session.get(f"{OLLAMA_URL}/api/tags") as response:
                    if response.status != 200:
                        raise HTTPException(
                            status_code=503, 
                            detail="Ollama service unavailable"
                        )
                    
                    data = await response.json()
                    models = []
                    
                    for model_data in data.get("models", []):
                        models.append(ModelInfo(
                            name=model_data["name"],
                            size=model_data.get("size", 0),
                            modified=model_data.get("modified_at", ""),
                            digest=model_data.get("digest", ""),
                            provider="ollama"
                        ))
        
        elif current_provider == AIProvider.AZURE_OPENAI:
            # Get Azure deployments
            deployments = await azure_openai_service.list_deployments()
            models = []
            
            for deployment in deployments:
                models.append(ModelInfo(
                    name=deployment["name"],
                    size="N/A",
                    modified="",
                    digest="",
                    provider="azure_openai"
                ))
        
        else:
            models = []
        
        # Get current model from config
        current_model = model_config.current_model
        
        return ModelsResponse(
            models=models,
            current_model=current_model,
            current_provider=current_provider.value
        )
                
    except aiohttp.ClientError as e:
        logger.error(f"Failed to connect to Ollama: {e}")
        raise HTTPException(
            status_code=503, 
            detail="Failed to connect to Ollama service"
        )
    except Exception as e:
        logger.error(f"Error fetching models: {e}")
        raise HTTPException(
            status_code=500, 
            detail="Internal server error while fetching models"
        )

@router.post("/select")
async def set_active_model(request: ModelSelectionRequest):
    """
    Set the active Ollama model for document processing
    """
    try:
        # Validate that the model exists
        models_response = await get_available_models()
        available_model_names = [model.name for model in models_response.models]
        
        if request.model_name not in available_model_names:
            raise HTTPException(
                status_code=400,
                detail=f"Model '{request.model_name}' not found in available models"
            )
        
        # Update the model configuration
        from ..config import model_config
        model_config.current_model = request.model_name
        
        logger.info(f"Active model changed to: {request.model_name}")
        
        return {
            "status": "success",
            "message": f"Active model set to {request.model_name}",
            "model": request.model_name
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error setting active model: {e}")
        raise HTTPException(
            status_code=500,
            detail="Internal server error while setting active model"
        )

@router.get("/current")
async def get_current_model():
    """
    Get the currently active Ollama model
    """
    try:
        from ..config import model_config
        
        return {
            "current_model": model_config.current_model
        }
        
    except Exception as e:
        logger.error(f"Error getting current model: {e}")
        raise HTTPException(
            status_code=500,
            detail="Internal server error while getting current model"
        )

class TestResponse(BaseModel):
    success: bool
    provider: str
    message: str
    details: Optional[Dict[str, Any]] = None

@router.post("/test-connection", response_model=TestResponse)
async def test_provider_connection():
    """
    Test connection to the currently active AI provider
    """
    current_provider = provider_config.current_provider
    
    try:
        if current_provider == AIProvider.OLLAMA:
            # Test Ollama connection
            async with aiohttp.ClientSession() as session:
                async with session.get(f"{OLLAMA_URL}/api/tags", timeout=aiohttp.ClientTimeout(total=10)) as response:
                    if response.status == 200:
                        data = await response.json()
                        model_count = len(data.get("models", []))
                        return TestResponse(
                            success=True,
                            provider="ollama",
                            message="Successfully connected to Ollama",
                            details={
                                "url": OLLAMA_URL,
                                "models_available": model_count,
                                "status_code": response.status
                            }
                        )
                    else:
                        return TestResponse(
                            success=False,
                            provider="ollama",
                            message=f"Ollama responded with status {response.status}",
                            details={
                                "url": OLLAMA_URL,
                                "status_code": response.status
                            }
                        )
        
        elif current_provider == AIProvider.AZURE_OPENAI:
            # Test Azure OpenAI connection
            if not settings.is_azure_configured():
                return TestResponse(
                    success=False,
                    provider="azure_openai",
                    message="Azure OpenAI is not configured",
                    details={
                        "missing_config": "API key or endpoint not set"
                    }
                )
            
            try:
                # Try to list deployments as a test
                deployments = await azure_openai_service.list_deployments()
                return TestResponse(
                    success=True,
                    provider="azure_openai",
                    message="Successfully connected to Azure OpenAI",
                    details={
                        "endpoint": settings.AZURE_OPENAI_ENDPOINT,
                        "deployments_available": len(deployments),
                        "api_version": settings.AZURE_OPENAI_API_VERSION
                    }
                )
            except Exception as azure_error:
                return TestResponse(
                    success=False,
                    provider="azure_openai",
                    message=f"Failed to connect to Azure OpenAI: {str(azure_error)}",
                    details={
                        "endpoint": settings.AZURE_OPENAI_ENDPOINT,
                        "error_type": type(azure_error).__name__
                    }
                )
        
        else:
            return TestResponse(
                success=False,
                provider=current_provider.value,
                message=f"Unknown provider: {current_provider.value}"
            )
            
    except aiohttp.ClientError as e:
        logger.error(f"Connection error testing {current_provider.value}: {e}")
        return TestResponse(
            success=False,
            provider=current_provider.value,
            message=f"Connection failed: {str(e)}",
            details={
                "error_type": "connection_error"
            }
        )
    except Exception as e:
        logger.error(f"Error testing {current_provider.value} connection: {e}")
        return TestResponse(
            success=False,
            provider=current_provider.value,
            message=f"Test failed: {str(e)}",
            details={
                "error_type": type(e).__name__
            }
        )


# =============================================================================
# Organization LLM Configuration Endpoints
# =============================================================================

class OrgLLMConfigResponse(BaseModel):
    """Response model for organization LLM config"""
    organization_id: str
    tier: str
    provider_type: str
    deployment_model: Optional[str] = None
    custom_endpoint: Optional[str] = None
    daily_document_limit: Optional[int] = None
    monthly_document_limit: Optional[int] = None
    documents_processed_today: int = 0
    documents_processed_month: int = 0
    provisioning_status: str = "active"
    source: str = "system_default"  # "system_default" or "organization"


class OrgLLMConfigRequest(BaseModel):
    """Request model for creating/updating org LLM config"""
    tier: str = Field(..., description="Tier: free, non_managed, professional, enterprise")
    provider_type: str = Field(..., description="Provider: none, shared, byok_azure, byok_openai, self_hosted")
    deployment_model: Optional[str] = Field(None, description="Enterprise deployment model")
    custom_endpoint: Optional[str] = Field(None, description="Self-hosted endpoint URL")
    daily_document_limit: Optional[int] = Field(10, description="Daily document limit (non_managed)")
    monthly_document_limit: Optional[int] = Field(200, description="Monthly document limit (non_managed)")
    # Credentials are handled separately via Vault


class EffectiveConfigResponse(BaseModel):
    """Response showing the effective config for an organization"""
    source: str  # "system_default" or "organization"
    provider: str
    tier: str
    organization_id: Optional[str] = None
    has_usage_limits: bool = False
    is_within_limits: bool = True
    daily_limit: Optional[int] = None
    monthly_limit: Optional[int] = None
    documents_today: int = 0
    documents_month: int = 0


@router.get("/org-config/{organization_id}", response_model=OrgLLMConfigResponse)
async def get_org_llm_config(organization_id: str):
    """
    Get the LLM configuration for a specific organization.

    Returns the organization's custom config if it exists,
    otherwise returns the system default configuration.
    """
    try:
        # Read actual config from database to return stored values
        if db_config.client:
            result = db_config.client.table('organization_llm_configs') \
                .select('*') \
                .eq('organization_id', organization_id) \
                .execute()

            if result.data and len(result.data) > 0:
                row = result.data[0]
                return OrgLLMConfigResponse(
                    organization_id=organization_id,
                    tier=row.get('tier', 'non_managed'),
                    provider_type=row.get('provider_type', 'shared'),
                    deployment_model=row.get('deployment_model'),
                    custom_endpoint=row.get('custom_endpoint'),
                    daily_document_limit=row.get('daily_document_limit'),
                    monthly_document_limit=row.get('monthly_document_limit'),
                    documents_processed_today=row.get('documents_processed_today', 0),
                    documents_processed_month=row.get('documents_processed_month', 0),
                    provisioning_status=row.get('provisioning_status', 'active'),
                    source="organization"
                )

        # No custom config - return system default
        effective = provider_config.get_effective_config(organization_id)
        return OrgLLMConfigResponse(
            organization_id=organization_id,
            tier=effective.tier.value,
            provider_type="shared",  # System default
            deployment_model=None,
            custom_endpoint=effective.custom_endpoint,
            daily_document_limit=effective.daily_limit,
            monthly_document_limit=effective.monthly_limit,
            documents_processed_today=effective.documents_today,
            documents_processed_month=effective.documents_month,
            provisioning_status="active",
            source="system_default"
        )

    except Exception as e:
        logger.error(f"Error getting org LLM config for {organization_id}: {e}")
        raise HTTPException(
            status_code=500,
            detail="Internal server error while getting organization LLM config"
        )


@router.put("/org-config/{organization_id}", response_model=OrgLLMConfigResponse)
async def update_org_llm_config(organization_id: str, request: OrgLLMConfigRequest):
    """
    Create or update the LLM configuration for an organization.

    This allows organizations to customize their LLM provider settings,
    including tier, provider type, and usage limits.
    """
    if not db_config.client:
        raise HTTPException(
            status_code=503,
            detail="Database not available"
        )

    try:
        # Validate tier
        try:
            tier = LLMTier(request.tier)
        except ValueError:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid tier: {request.tier}. Valid values: {[t.value for t in LLMTier]}"
            )

        # Validate provider_type
        try:
            provider_type = LLMProviderType(request.provider_type)
        except ValueError:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid provider_type: {request.provider_type}. Valid values: {[p.value for p in LLMProviderType]}"
            )

        # Check if config exists
        existing = db_config.client.table('organization_llm_configs') \
            .select('id') \
            .eq('organization_id', organization_id) \
            .execute()

        config_data = {
            'organization_id': organization_id,
            'tier': tier.value,
            'provider_type': provider_type.value,
            'deployment_model': request.deployment_model,
            'custom_endpoint': request.custom_endpoint,
            'daily_document_limit': request.daily_document_limit,
            'monthly_document_limit': request.monthly_document_limit,
        }

        if existing.data and len(existing.data) > 0:
            # Update existing
            db_config.client.table('organization_llm_configs') \
                .update(config_data) \
                .eq('organization_id', organization_id) \
                .execute()
        else:
            # Insert new
            db_config.client.table('organization_llm_configs') \
                .insert(config_data) \
                .execute()

        # Clear cache
        provider_config.clear_org_config_cache(organization_id)

        # Return the updated config
        return await get_org_llm_config(organization_id)

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating org LLM config for {organization_id}: {e}")
        raise HTTPException(
            status_code=500,
            detail="Internal server error while updating organization LLM config"
        )


@router.delete("/org-config/{organization_id}")
async def delete_org_llm_config(organization_id: str):
    """
    Delete an organization's custom LLM configuration.

    After deletion, the organization will use the system default configuration.
    """
    if not db_config.client:
        raise HTTPException(
            status_code=503,
            detail="Database not available"
        )

    try:
        db_config.client.table('organization_llm_configs') \
            .delete() \
            .eq('organization_id', organization_id) \
            .execute()

        # Clear cache
        provider_config.clear_org_config_cache(organization_id)

        return {
            "status": "success",
            "message": "Organization LLM config deleted. Now using system default.",
            "organization_id": organization_id
        }

    except Exception as e:
        logger.error(f"Error deleting org LLM config for {organization_id}: {e}")
        raise HTTPException(
            status_code=500,
            detail="Internal server error while deleting organization LLM config"
        )


@router.get("/org-config/{organization_id}/effective", response_model=EffectiveConfigResponse)
async def get_effective_org_config(organization_id: str):
    """
    Get the effective LLM configuration for an organization.

    This shows what configuration will actually be used for LLM requests,
    accounting for fallback to system defaults.
    """
    try:
        effective = provider_config.get_effective_config(organization_id)

        return EffectiveConfigResponse(
            source=effective.source,
            provider=effective.provider.value,
            tier=effective.tier.value,
            organization_id=organization_id,
            has_usage_limits=effective.has_usage_limits(),
            is_within_limits=effective.is_within_limits(),
            daily_limit=effective.daily_limit,
            monthly_limit=effective.monthly_limit,
            documents_today=effective.documents_today,
            documents_month=effective.documents_month,
        )

    except Exception as e:
        logger.error(f"Error getting effective config for {organization_id}: {e}")
        raise HTTPException(
            status_code=500,
            detail="Internal server error while getting effective config"
        )


def _provider_to_provider_type(effective) -> str:
    """Convert EffectiveProviderConfig to provider_type string"""
    if effective.source == "system_default":
        return "shared"

    # Determine based on config properties
    if effective.custom_endpoint:
        return "self_hosted"
    elif effective.api_key and effective.source == "organization":
        return "byok_azure"  # Could also be byok_openai based on endpoint
    else:
        return "shared"


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
    try:
        # Validate organization_id format
        validate_organization_id(organization_id)

        if not AZURE_PROVISIONING_AVAILABLE or not azure_provisioning_service.is_configured:
            raise HTTPException(
                status_code=503,
                detail="Azure provisioning not configured on this server"
            )

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

        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error provisioning Azure OpenAI for {organization_id}: {e}")
        raise HTTPException(
            status_code=500,
            detail="Internal server error while provisioning Azure OpenAI"
        )


@router.get("/provision/{organization_id}/status", response_model=ProvisioningStatusResponse)
async def get_provisioning_status(organization_id: str):
    """
    Get the current provisioning status for an organization.
    """
    try:
        # Validate organization_id format
        validate_organization_id(organization_id)

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
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting provisioning status for {organization_id}: {e}")
        raise HTTPException(
            status_code=500,
            detail="Internal server error while getting provisioning status"
        )


@router.delete("/provision/{organization_id}", response_model=DeprovisioningResponse)
async def deprovision_azure_openai(organization_id: str):
    """
    Deprovision an Azure OpenAI instance (for downgrades).
    """
    try:
        # Validate organization_id format
        validate_organization_id(organization_id)

        # Get instance name and start deprovisioning
        instance_name = await provisioning_db_service.start_deprovisioning(organization_id)

        if not instance_name:
            return DeprovisioningResponse(
                status="failed",
                message="No active provisioning found for this organization",
                organization_id=organization_id,
            )

        # Run deprovisioning (in production, use background task)
        if AZURE_PROVISIONING_AVAILABLE and azure_provisioning_service.is_configured:
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
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deprovisioning Azure OpenAI for {organization_id}: {e}")
        raise HTTPException(
            status_code=500,
            detail="Internal server error while deprovisioning Azure OpenAI"
        )


@router.get("/provision/{organization_id}/logs", response_model=ProvisioningLogsResponse)
async def get_provisioning_logs(organization_id: str):
    """
    Get provisioning audit logs for an organization.
    """
    try:
        # Validate organization_id format
        validate_organization_id(organization_id)

        # Query azure_provisioning_logs table
        logs = await provisioning_db_service.get_provisioning_logs(organization_id)

        return ProvisioningLogsResponse(
            organization_id=organization_id,
            logs=logs,
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting provisioning logs for {organization_id}: {e}")
        raise HTTPException(
            status_code=500,
            detail="Internal server error while getting provisioning logs"
        )