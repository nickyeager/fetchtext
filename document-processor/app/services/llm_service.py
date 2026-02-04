"""
Unified LLM service that routes to appropriate provider

Supports both system-wide defaults and per-organization configurations.
Organizations without custom configs use the system default (shared Azure).
"""
import logging
from typing import Optional, Dict, Any
import aiohttp
from ..config import provider_config, model_config, AIProvider, settings, LLMTier, LLMProviderType
from .azure_openai_service import azure_openai_service, AzureOpenAIService

logger = logging.getLogger(__name__)


class UsageLimitExceededError(Exception):
    """Raised when organization has exceeded their document processing limits"""
    def __init__(self, message: str, daily_limit: int = None, monthly_limit: int = None):
        super().__init__(message)
        self.daily_limit = daily_limit
        self.monthly_limit = monthly_limit


class LLMNotConfiguredError(Exception):
    """Raised when organization has no LLM configured (free tier)"""
    pass


class LLMService:
    """Unified interface for LLM operations across providers

    Supports both system-wide defaults and per-organization configurations.
    The complete() method accepts an optional organization_id parameter to
    route requests through the appropriate provider based on org settings.
    """

    async def complete(
        self,
        prompt: str,
        provider: str = None,
        organization_id: Optional[str] = None,
        **kwargs
    ) -> str:
        """
        Send a completion request to the specified or active provider.

        Args:
            prompt: The prompt to send to the LLM
            provider: Optional provider override ("azure", "azure_openai", "ollama")
            organization_id: Optional organization ID for org-specific config
            **kwargs: Additional arguments (temperature, max_tokens, etc.)

        Returns:
            The LLM response text

        Raises:
            LLMNotConfiguredError: If org has free tier (no LLM access)
            UsageLimitExceededError: If org has exceeded usage limits
            ValueError: If provider is unsupported
        """
        # If explicit provider specified, use legacy behavior
        if provider:
            return await self._complete_with_explicit_provider(prompt, provider, **kwargs)

        # Get effective config for this request (org-aware or system default)
        effective_config = provider_config.get_effective_config(organization_id)

        logger.info(
            f"LLM request: source={effective_config.source}, "
            f"provider={effective_config.provider}, tier={effective_config.tier}, "
            f"org_id={organization_id}"
        )

        # Check for free tier (no LLM access)
        if effective_config.tier == LLMTier.FREE:
            raise LLMNotConfiguredError(
                "This organization uses template-only mode. "
                "AI extraction is not available. Upgrade to enable AI features."
            )

        # Check usage limits for non_managed tier
        if effective_config.has_usage_limits():
            if not effective_config.is_within_limits():
                raise UsageLimitExceededError(
                    f"Document processing limit exceeded. "
                    f"Daily: {effective_config.documents_today}/{effective_config.daily_limit}, "
                    f"Monthly: {effective_config.documents_month}/{effective_config.monthly_limit}",
                    daily_limit=effective_config.daily_limit,
                    monthly_limit=effective_config.monthly_limit
                )

        # Route based on effective provider
        try:
            result = await self._complete_with_config(prompt, effective_config, **kwargs)

            # Increment usage counter for non_managed tier
            if effective_config.has_usage_limits() and organization_id:
                provider_config.increment_usage(organization_id)

            return result

        except Exception as e:
            logger.error(
                f"Error in LLM completion: provider={effective_config.provider}, "
                f"org_id={organization_id}, error={str(e)}"
            )
            raise

    async def _complete_with_explicit_provider(
        self,
        prompt: str,
        provider: str,
        **kwargs
    ) -> str:
        """Legacy behavior: complete with explicitly specified provider"""
        if provider in ("azure", "azure_openai"):
            target_provider = AIProvider.AZURE_OPENAI
        elif provider == "ollama":
            target_provider = AIProvider.OLLAMA
        else:
            target_provider = provider_config.current_provider

        try:
            if target_provider == AIProvider.OLLAMA:
                return await self._ollama_complete_with_timeout(prompt, **kwargs)
            elif target_provider == AIProvider.AZURE_OPENAI:
                return await azure_openai_service.complete(prompt, **kwargs)
            else:
                raise ValueError(f"Unsupported provider: {target_provider}")

        except Exception as e:
            logger.error(f"Error in LLM completion with {target_provider}: {str(e)}")
            raise

    async def _complete_with_config(
        self,
        prompt: str,
        config,  # EffectiveProviderConfig
        **kwargs
    ) -> str:
        """Complete request using effective provider config"""

        if config.provider == AIProvider.OLLAMA:
            # Self-hosted or default Ollama
            custom_url = config.custom_endpoint if config.custom_endpoint else None
            return await self._ollama_complete_with_timeout(prompt, custom_url=custom_url, **kwargs)

        elif config.provider == AIProvider.AZURE_OPENAI:
            # Use config's credentials if BYOK, otherwise default Azure service
            if config.api_key and config.api_endpoint:
                # BYOK: Create a temporary service with customer's credentials
                custom_service = AzureOpenAIService(
                    api_key=config.api_key,
                    endpoint=config.api_endpoint,
                    deployment_name=config.deployment_name
                )
                return await custom_service.complete(prompt, **kwargs)
            else:
                # Use system default Azure service
                return await azure_openai_service.complete(prompt, **kwargs)

        else:
            raise ValueError(f"Unsupported provider: {config.provider}")
    
    async def _ollama_complete_with_timeout(
        self,
        prompt: str,
        custom_url: Optional[str] = None,
        **kwargs
    ) -> str:
        """
        Send completion request to Ollama with configurable timeout and fallback

        Args:
            prompt: The prompt to send
            custom_url: Optional custom Ollama endpoint (for self-hosted)
            **kwargs: Additional arguments
        """
        import asyncio

        # Get timeout from kwargs, default to 10 seconds for smart templates
        timeout_seconds = kwargs.get('timeout', 10.0)

        try:
            # Run Ollama completion with timeout
            return await asyncio.wait_for(
                self._ollama_complete(prompt, custom_url=custom_url, **kwargs),
                timeout=timeout_seconds
            )
        except asyncio.TimeoutError:
            logger.warning(f"Ollama completion timed out after {timeout_seconds} seconds")
            raise TimeoutError(f"LLM request timed out after {timeout_seconds} seconds")
        except Exception as e:
            logger.error(f"Error in Ollama completion: {str(e)}")
            raise

    async def _ollama_complete(
        self,
        prompt: str,
        custom_url: Optional[str] = None,
        **kwargs
    ) -> str:
        """
        Send completion request to Ollama

        Args:
            prompt: The prompt to send
            custom_url: Optional custom endpoint URL (for self-hosted)
            **kwargs: Additional arguments
        """
        model = kwargs.get('model') or model_config.current_model
        if not model:
            raise ValueError("No Ollama model selected")

        # Use custom URL if provided (self-hosted), otherwise default
        base_url = custom_url.rstrip('/') if custom_url else "http://ollama-cpu:11434"
        url = f"{base_url}/api/generate"
        
        payload = {
            "model": model,
            "prompt": prompt,
            "stream": False,
            "options": {
                "temperature": kwargs.get("temperature", 0.7),
                "top_p": kwargs.get("top_p", 0.95),
            }
        }
        
        # Add max_tokens if specified
        if "max_tokens" in kwargs:
            payload["options"]["num_predict"] = kwargs["max_tokens"]
        
        # Add JSON format if specified
        if kwargs.get("format") == "json":
            payload["format"] = "json"
            # Add instruction to prompt if not already present
            if "json" not in prompt.lower():
                payload["prompt"] = prompt + "\n\nIMPORTANT: Return ONLY valid JSON without any additional text or formatting."
        
        try:
            timeout = aiohttp.ClientTimeout(total=120.0)  # Increase timeout for slower models
            async with aiohttp.ClientSession(timeout=timeout) as session:
                logger.info(f"Calling Ollama with model {model}, url: {url}")
                async with session.post(url, json=payload) as response:
                    if response.status != 200:
                        text = await response.text()
                        raise Exception(f"Ollama API error: {response.status} - {text}")
                    
                    data = await response.json()
                    response_text = data.get("response", "")
                    
                    if not response_text:
                        logger.warning("Ollama returned empty response")
                        return ""
                    
                    # Log response for debugging (truncate for large responses)
                    logger.debug(f"Ollama response (first 500 chars): {response_text[:500]}...")
                    
                    return response_text
                    
        except aiohttp.ClientError as e:
            logger.error(f"HTTP error calling Ollama: {type(e).__name__}: {str(e)}")
            raise
        except Exception as e:
            logger.error(f"Error calling Ollama: {type(e).__name__}: {str(e)}")
            raise
    
    def get_current_provider_info(self) -> Dict[str, Any]:
        """Get information about the current provider and model"""
        provider = provider_config.current_provider
        model = model_config.current_model
        
        return {
            "provider": provider.value,
            "model": model,
            "configured": self._is_provider_configured(provider)
        }
    
    def _is_provider_configured(self, provider: AIProvider) -> bool:
        """Check if a provider is properly configured"""
        if provider == AIProvider.OLLAMA:
            return True  # Always available
        elif provider == AIProvider.AZURE_OPENAI:
            return settings.is_azure_configured()
        return False

# Global instance
llm_service = LLMService()