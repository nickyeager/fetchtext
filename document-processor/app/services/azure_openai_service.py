"""
Azure OpenAI service for AI model integration

Supports both system-wide default credentials and custom BYOK credentials.
"""
import logging
from typing import List, Dict, Any, Optional
import httpx
from ..config import settings

logger = logging.getLogger(__name__)


class AzureOpenAIService:
    """Service for interacting with Azure OpenAI API

    Can be initialized with default credentials from settings or with
    custom credentials for BYOK (Bring Your Own Key) scenarios.
    """

    def __init__(
        self,
        api_key: Optional[str] = None,
        endpoint: Optional[str] = None,
        deployment_name: Optional[str] = None,
        api_version: Optional[str] = None
    ):
        """
        Initialize Azure OpenAI service.

        Args:
            api_key: Optional custom API key (BYOK). Uses settings default if None.
            endpoint: Optional custom endpoint (BYOK). Uses settings default if None.
            deployment_name: Optional custom deployment (BYOK). Uses settings default if None.
            api_version: Optional API version. Uses settings default if None.
        """
        # Use custom credentials if provided, otherwise fall back to settings
        self.api_key = api_key or settings.AZURE_OPENAI_API_KEY
        self.endpoint = endpoint or settings.AZURE_OPENAI_ENDPOINT
        self.api_version = api_version or settings.AZURE_OPENAI_API_VERSION
        self.deployment_name = deployment_name or settings.AZURE_OPENAI_DEPLOYMENT_NAME

        # Track if using custom credentials (for logging)
        self._is_byok = api_key is not None

        # Persistent HTTP client — reuses TCP/TLS connections across calls,
        # saving ~100-300ms per request on TLS handshake overhead.
        self._client: Optional[httpx.AsyncClient] = None

    @property
    def is_configured(self) -> bool:
        """Check if Azure OpenAI is properly configured"""
        if self._is_byok:
            # For BYOK, check if custom credentials are present
            return bool(self.api_key and self.endpoint and self.deployment_name)
        # For system default, use settings check
        return settings.is_azure_configured()
    
    def _get_headers(self) -> Dict[str, str]:
        """Get headers for Azure OpenAI API requests"""
        return {
            "api-key": self.api_key,
            "Content-Type": "application/json"
        }
    
    def _get_client(self) -> httpx.AsyncClient:
        """Return a persistent httpx client, creating one if needed."""
        if self._client is None or self._client.is_closed:
            self._client = httpx.AsyncClient(timeout=60.0)
        return self._client

    async def list_deployments(self) -> List[Dict[str, Any]]:
        """
        List available Azure OpenAI deployments
        Note: This returns a simplified list since Azure doesn't have a direct deployments API
        """
        if not self.is_configured:
            return []
        
        # For Azure, we return the configured deployment
        # In a real scenario, you might want to configure multiple deployments
        return [
            {
                "name": self.deployment_name,
                "model": self.deployment_name,
                "status": "succeeded",
                "provider": "azure"
            }
        ]
    
    async def complete(self, prompt: str, **kwargs) -> str:
        """
        Send a completion request to Azure OpenAI.

        Supported kwargs:
            temperature, max_tokens, top_p, frequency_penalty, presence_penalty,
            response_format (e.g. {"type": "json_object"} to force valid JSON output)
        """
        if not self.is_configured:
            raise ValueError("Azure OpenAI is not properly configured")

        url = f"{self.endpoint.rstrip('/')}/openai/deployments/{self.deployment_name}/chat/completions?api-version={self.api_version}"

        # Build the request payload
        max_tokens_value = kwargs.get("max_tokens", 2000)

        payload = {
            "messages": [
                {"role": "system", "content": "You are a helpful AI assistant."},
                {"role": "user", "content": prompt}
            ],
            "temperature": kwargs.get("temperature", 0.7),
            "max_tokens": int(max_tokens_value),
            "top_p": kwargs.get("top_p", 0.95),
            "frequency_penalty": kwargs.get("frequency_penalty", 0),
            "presence_penalty": kwargs.get("presence_penalty", 0),
        }

        # Enable structured JSON output when requested.
        # This constrains the model to emit valid JSON, which is faster
        # (no wasted tokens on markdown/explanations) and eliminates
        # the need for fuzzy JSON parsing.
        response_format = kwargs.get("response_format")
        if response_format:
            payload["response_format"] = response_format
        
        try:
            client = self._get_client()
            response = await client.post(
                url,
                headers=self._get_headers(),
                json=payload,
            )
            response.raise_for_status()

            data = response.json()
            return data["choices"][0]["message"]["content"]
                
        except httpx.HTTPStatusError as e:
            error_text = e.response.text
            logger.error(f"Azure OpenAI API error: {e.response.status_code} - {error_text}")
            # Try to extract error message from response
            try:
                error_data = e.response.json()
                error_message = error_data.get('error', {}).get('message', error_text)
                logger.error(f"Azure OpenAI error details: {error_message}")
            except:
                pass
            raise Exception(f"Azure OpenAI API error: {e.response.status_code} - {error_text[:200]}")
        except Exception as e:
            logger.error(f"Error calling Azure OpenAI: {str(e)}")
            raise

# Global instance
azure_openai_service = AzureOpenAIService()