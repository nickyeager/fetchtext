"""
Unified LLM service that routes to appropriate provider
"""
import logging
from typing import Optional, Dict, Any
import aiohttp
from ..config import provider_config, model_config, AIProvider, settings
from .azure_openai_service import azure_openai_service

logger = logging.getLogger(__name__)

class LLMService:
    """Unified interface for LLM operations across providers"""
    
    async def complete(self, prompt: str, provider: str = None, **kwargs) -> str:
        """
        Send a completion request to the specified or active provider
        """
        # Use passed provider or fall back to current provider
        # Accept both "azure" and "azure_openai" for Azure OpenAI
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
    
    async def _ollama_complete_with_timeout(self, prompt: str, **kwargs) -> str:
        """
        Send completion request to Ollama with configurable timeout and fallback
        """
        import asyncio
        
        # Get timeout from kwargs, default to 10 seconds for smart templates
        timeout_seconds = kwargs.get('timeout', 10.0)
        
        try:
            # Run Ollama completion with timeout
            return await asyncio.wait_for(
                self._ollama_complete(prompt, **kwargs),
                timeout=timeout_seconds
            )
        except asyncio.TimeoutError:
            logger.warning(f"Ollama completion timed out after {timeout_seconds} seconds")
            raise TimeoutError(f"LLM request timed out after {timeout_seconds} seconds")
        except Exception as e:
            logger.error(f"Error in Ollama completion: {str(e)}")
            raise

    async def _ollama_complete(self, prompt: str, **kwargs) -> str:
        """
        Send completion request to Ollama
        """
        model = model_config.current_model
        if not model:
            raise ValueError("No Ollama model selected")
        
        url = "http://ollama-cpu:11434/api/generate"
        
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