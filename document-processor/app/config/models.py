"""
Model configuration management for the document processor
"""
import os
import json
import logging
from pathlib import Path
from typing import Optional, Dict, Any
from .providers import AIProvider, provider_config

logger = logging.getLogger(__name__)

class ModelConfig:
    """Manages the active model configuration"""
    
    def __init__(self):
        self.config_file = Path("/app/config/active_model.json")
        self.default_models = {
            AIProvider.OLLAMA: "qwen2.5:3b-instruct-q4_K_M",  # Smaller model for better JSON compliance
            AIProvider.AZURE_OPENAI: None  # Will use deployment name from settings
        }
        self._models_by_provider: Dict[AIProvider, Optional[str]] = {}
        self._load_config()
    
    def _load_config(self):
        """Load the current model from config file or environment"""
        try:
            # Load from config file if exists
            if self.config_file.exists():
                with open(self.config_file, 'r') as f:
                    config = json.load(f)
                    
                    # Support legacy format
                    if "active_model" in config and "models_by_provider" not in config:
                        # Migrate old config
                        self._models_by_provider[AIProvider.OLLAMA] = config["active_model"]
                    else:
                        # Load provider-specific models
                        for provider_str, model in config.get("models_by_provider", {}).items():
                            try:
                                provider = AIProvider(provider_str)
                                self._models_by_provider[provider] = model
                            except ValueError:
                                logger.warning(f"Unknown provider in config: {provider_str}")
                    
                    logger.info(f"Loaded models from config: {self._models_by_provider}")
                    return
            
            # Initialize with defaults
            self._models_by_provider = self.default_models.copy()
            logger.info(f"Using default models: {self._models_by_provider}")
            
        except Exception as e:
            logger.warning(f"Error loading model config: {e}, using defaults")
            self._models_by_provider = self.default_models.copy()
    
    def _save_config(self):
        """Save the current model to config file"""
        try:
            # Ensure config directory exists
            self.config_file.parent.mkdir(parents=True, exist_ok=True)
            
            config = {
                "models_by_provider": {
                    provider.value: model 
                    for provider, model in self._models_by_provider.items()
                },
                "current_provider": provider_config.current_provider.value,
                "last_updated": str(os.environ.get("HOSTNAME", "unknown"))
            }
            
            with open(self.config_file, 'w') as f:
                json.dump(config, f, indent=2)
                
            logger.info(f"Saved model config for provider {provider_config.current_provider}")
            
        except Exception as e:
            logger.error(f"Error saving model config: {e}")
    
    @property
    def current_model(self) -> str:
        """Get the current active model for the current provider"""
        provider = provider_config.current_provider
        
        # For Azure, use deployment name from settings if no model is set
        if provider == AIProvider.AZURE_OPENAI:
            from ..config import settings
            return self._models_by_provider.get(provider) or settings.AZURE_OPENAI_DEPLOYMENT_NAME or ""
        
        return self._models_by_provider.get(provider) or self.default_models.get(provider, "")
    
    @current_model.setter
    def current_model(self, model: str):
        """Set the current active model for the current provider"""
        provider = provider_config.current_provider
        if self._models_by_provider.get(provider) != model:
            self._models_by_provider[provider] = model
            self._save_config()
            logger.info(f"Active model for {provider} changed to: {model}")
    
    def get_model_for_provider(self, provider: AIProvider) -> Optional[str]:
        """Get the model for a specific provider"""
        if provider == AIProvider.AZURE_OPENAI:
            from ..config import settings
            return self._models_by_provider.get(provider) or settings.AZURE_OPENAI_DEPLOYMENT_NAME
        return self._models_by_provider.get(provider)
    
    def set_model_for_provider(self, provider: AIProvider, model: str):
        """Set the model for a specific provider"""
        self._models_by_provider[provider] = model
        self._save_config()
    
    def reset_to_default(self):
        """Reset to the default model for current provider"""
        provider = provider_config.current_provider
        self.current_model = self.default_models.get(provider, "")

# Global instance
model_config = ModelConfig()