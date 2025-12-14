"""
Application settings and environment configuration
"""
import os
from typing import Optional

class Settings:
    """Application settings loaded from environment variables"""
    
    # Ollama Configuration
    OLLAMA_URL: str = os.getenv("OLLAMA_URL", "http://ollama-cpu:11434")
    
    # Azure OpenAI Configuration
    AZURE_OPENAI_API_KEY: Optional[str] = os.getenv("AZURE_OPENAI_API_KEY")
    AZURE_OPENAI_ENDPOINT: Optional[str] = os.getenv("AZURE_OPENAI_ENDPOINT")
    AZURE_OPENAI_API_VERSION: str = os.getenv("AZURE_OPENAI_API_VERSION", "2024-02-15-preview")
    AZURE_OPENAI_DEPLOYMENT_NAME: Optional[str] = os.getenv("AZURE_OPENAI_DEPLOYMENT_NAME")
    AZURE_OPENAI_LOCATION: str = os.getenv("AZURE_OPENAI_LOCATION", "eastus")
    
    @classmethod
    def is_azure_configured(cls) -> bool:
        """Check if Azure OpenAI is properly configured"""
        return bool(
            cls.AZURE_OPENAI_API_KEY and 
            cls.AZURE_OPENAI_ENDPOINT and 
            cls.AZURE_OPENAI_DEPLOYMENT_NAME
        )

# Create global settings instance
settings = Settings()