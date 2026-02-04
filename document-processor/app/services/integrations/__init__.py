"""
Integrations Package

Provides a registry-based architecture for OAuth integrations.
Adding a new integration only requires:
1. Add config to INTEGRATION_REGISTRY
2. Set environment variables
3. (Optional) Create service class for provider-specific API calls
"""

from .registry import (
    IntegrationConfig,
    INTEGRATION_REGISTRY,
    get_integration,
    register_integration,
    list_integrations,
)
from .oauth_manager import OAuthManager

__all__ = [
    "IntegrationConfig",
    "INTEGRATION_REGISTRY",
    "get_integration",
    "register_integration",
    "list_integrations",
    "OAuthManager",
]
