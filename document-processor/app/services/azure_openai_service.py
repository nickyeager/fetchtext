"""
Azure OpenAI service for AI model integration
"""
import logging
from typing import List, Dict, Any, Optional
import httpx
from ..config import settings

logger = logging.getLogger(__name__)

class AzureOpenAIService:
    """Service for interacting with Azure OpenAI API"""
    
    def __init__(self):
        self.api_key = settings.AZURE_OPENAI_API_KEY
        self.endpoint = settings.AZURE_OPENAI_ENDPOINT
        self.api_version = settings.AZURE_OPENAI_API_VERSION
        self.deployment_name = settings.AZURE_OPENAI_DEPLOYMENT_NAME
        
    @property
    def is_configured(self) -> bool:
        """Check if Azure OpenAI is properly configured"""
        return settings.is_azure_configured()
    
    def _get_headers(self) -> Dict[str, str]:
        """Get headers for Azure OpenAI API requests"""
        return {
            "api-key": self.api_key,
            "Content-Type": "application/json"
        }
    
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
        Send a completion request to Azure OpenAI
        """
        if not self.is_configured:
            raise ValueError("Azure OpenAI is not properly configured")
        
        url = f"{self.endpoint.rstrip('/')}/openai/deployments/{self.deployment_name}/chat/completions?api-version={self.api_version}"
        
        # Build the request payload
        payload = {
            "messages": [
                {"role": "system", "content": "You are a helpful AI assistant."},
                {"role": "user", "content": prompt}
            ],
            "temperature": kwargs.get("temperature", 0.7),
            "max_tokens": kwargs.get("max_tokens", 2000),
            "top_p": kwargs.get("top_p", 0.95),
            "frequency_penalty": kwargs.get("frequency_penalty", 0),
            "presence_penalty": kwargs.get("presence_penalty", 0),
        }
        
        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    url,
                    headers=self._get_headers(),
                    json=payload,
                    timeout=60.0
                )
                response.raise_for_status()
                
                data = response.json()
                return data["choices"][0]["message"]["content"]
                
        except httpx.HTTPStatusError as e:
            logger.error(f"Azure OpenAI API error: {e.response.status_code} - {e.response.text}")
            raise Exception(f"Azure OpenAI API error: {e.response.status_code}")
        except Exception as e:
            logger.error(f"Error calling Azure OpenAI: {str(e)}")
            raise

# Global instance
azure_openai_service = AzureOpenAIService()