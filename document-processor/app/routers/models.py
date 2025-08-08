"""
AI model management endpoints for multiple providers
"""
import aiohttp
import logging
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
from enum import Enum

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/models", tags=["models"])

# Import configuration and services
from ..config import settings, model_config, provider_config, AIProvider
from ..services.azure_openai_service import azure_openai_service

# Configuration
OLLAMA_URL = "http://ollama-cpu:11434"

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