"""
Configuration module for the document processor
"""

from .models import model_config
from .settings import settings
from .providers import provider_config, AIProvider

__all__ = ['model_config', 'settings', 'provider_config', 'AIProvider']