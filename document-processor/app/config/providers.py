"""
AI Provider configuration and management
"""
import json
import logging
from enum import Enum
from pathlib import Path
from typing import Optional, Dict, Any

logger = logging.getLogger(__name__)

class AIProvider(str, Enum):
    """Available AI providers"""
    OLLAMA = "ollama"
    AZURE_OPENAI = "azure_openai"

class ProviderConfig:
    """Manages the active AI provider configuration"""
    
    def __init__(self):
        self.config_file = Path("/app/config/provider_config.json")
        self.default_provider = AIProvider.AZURE_OPENAI
        self._current_provider = None
        self._provider_settings = {}
        self._load_config()
    
    def _load_config(self):
        """Load the current provider configuration"""
        try:
            if self.config_file.exists():
                with open(self.config_file, 'r') as f:
                    config = json.load(f)
                    self._current_provider = AIProvider(config.get("provider", self.default_provider))
                    self._provider_settings = config.get("settings", {})
                    logger.info(f"Loaded provider from config: {self._current_provider}")
                    return
            
            # Fall back to default
            self._current_provider = self.default_provider
            logger.info(f"Using default provider: {self.default_provider}")
            
        except Exception as e:
            logger.warning(f"Error loading provider config: {e}, using default")
            self._current_provider = self.default_provider
    
    def _save_config(self):
        """Save the current provider configuration"""
        try:
            self.config_file.parent.mkdir(parents=True, exist_ok=True)
            
            config = {
                "provider": self._current_provider.value,
                "settings": self._provider_settings
            }
            
            with open(self.config_file, 'w') as f:
                json.dump(config, f, indent=2)
                
            logger.info(f"Saved provider config: {self._current_provider}")
            
        except Exception as e:
            logger.error(f"Error saving provider config: {e}")
    
    @property
    def current_provider(self) -> AIProvider:
        """Get the current active provider"""
        return self._current_provider or self.default_provider
    
    @current_provider.setter
    def current_provider(self, provider: AIProvider):
        """Set the current active provider"""
        if provider != self._current_provider:
            self._current_provider = provider
            self._save_config()
            logger.info(f"Active provider changed to: {provider}")
    
    def get_provider_setting(self, key: str, default: Any = None) -> Any:
        """Get a provider-specific setting"""
        return self._provider_settings.get(key, default)
    
    def set_provider_setting(self, key: str, value: Any):
        """Set a provider-specific setting"""
        self._provider_settings[key] = value
        self._save_config()
    
    def reset_to_default(self):
        """Reset to the default provider"""
        self.current_provider = self.default_provider
        self._provider_settings = {}

# Global instance
provider_config = ProviderConfig()