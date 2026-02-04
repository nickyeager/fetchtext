"""
AI Provider configuration and management

Supports both system-wide defaults and per-organization configurations.
Organizations without custom configs use the system default (shared Azure).
"""
import json
import logging
import time
from dataclasses import dataclass
from enum import Enum
from pathlib import Path
from typing import Optional, Dict, Any

logger = logging.getLogger(__name__)


# =============================================================================
# Enums and Data Classes
# =============================================================================

class LLMTier(str, Enum):
    """Pricing/feature tiers for LLM access"""
    FREE = "free"              # Template-only, no AI
    NON_MANAGED = "non_managed"  # Shared Azure with usage limits
    PROFESSIONAL = "professional"  # BYOK (bring your own key)
    ENTERPRISE = "enterprise"  # Dedicated instance


class LLMProviderType(str, Enum):
    """How the LLM is accessed"""
    NONE = "none"              # No LLM (free tier)
    SHARED = "shared"          # FetchText's shared Azure OpenAI
    BYOK_AZURE = "byok_azure"  # Customer's Azure OpenAI key
    BYOK_OPENAI = "byok_openai"  # Customer's OpenAI key
    SELF_HOSTED = "self_hosted"  # Customer's endpoint (Ollama, vLLM)


class DeploymentModel(str, Enum):
    """Enterprise deployment models"""
    MANAGED_OURS = "managed_ours"  # FetchText provisions in our Azure
    LIGHTHOUSE = "lighthouse"      # FetchText provisions via Azure Lighthouse
    MARKETPLACE = "marketplace"    # Customer deploys via Azure Marketplace


@dataclass
class OrgLLMConfig:
    """Organization-specific LLM configuration"""
    organization_id: str
    tier: LLMTier
    provider_type: LLMProviderType
    deployment_model: Optional[DeploymentModel] = None

    # Credentials (decrypted)
    api_key: Optional[str] = None
    api_endpoint: Optional[str] = None
    deployment_name: Optional[str] = None

    # Self-hosted
    custom_endpoint: Optional[str] = None

    # Usage limits (non_managed tier)
    daily_document_limit: int = 10
    monthly_document_limit: int = 200
    documents_processed_today: int = 0
    documents_processed_month: int = 0

    # Azure enterprise details
    azure_resource_id: Optional[str] = None
    provisioning_status: str = "active"

    @classmethod
    def from_db_row(cls, row: Dict[str, Any]) -> "OrgLLMConfig":
        """Create from database row"""
        return cls(
            organization_id=row.get("organization_id", ""),
            tier=LLMTier(row.get("tier", "non_managed")),
            provider_type=LLMProviderType(row.get("provider_type", "shared")),
            deployment_model=DeploymentModel(row["deployment_model"]) if row.get("deployment_model") else None,
            custom_endpoint=row.get("custom_endpoint"),
            daily_document_limit=row.get("daily_document_limit", 10),
            monthly_document_limit=row.get("monthly_document_limit", 200),
            documents_processed_today=row.get("documents_processed_today", 0),
            documents_processed_month=row.get("documents_processed_month", 0),
            azure_resource_id=row.get("azure_resource_id"),
            provisioning_status=row.get("provisioning_status", "active"),
        )


@dataclass
class EffectiveProviderConfig:
    """The effective provider configuration for a request"""
    source: str  # "system_default" or "organization"
    provider: "AIProvider"  # The actual provider to use
    tier: LLMTier = LLMTier.NON_MANAGED
    organization_id: Optional[str] = None

    # For BYOK/enterprise
    api_key: Optional[str] = None
    api_endpoint: Optional[str] = None
    deployment_name: Optional[str] = None
    custom_endpoint: Optional[str] = None

    # Usage limits
    daily_limit: Optional[int] = None
    monthly_limit: Optional[int] = None
    documents_today: int = 0
    documents_month: int = 0

    def has_usage_limits(self) -> bool:
        """Check if this config has usage limits"""
        return self.tier == LLMTier.NON_MANAGED and self.daily_limit is not None

    def is_within_limits(self) -> bool:
        """Check if usage is within limits"""
        if not self.has_usage_limits():
            return True

        if self.daily_limit and self.documents_today >= self.daily_limit:
            return False
        if self.monthly_limit and self.documents_month >= self.monthly_limit:
            return False

        return True


@dataclass
class CachedOrgConfig:
    """Cached organization config with TTL"""
    config: Optional[OrgLLMConfig]
    cached_at: float
    ttl_seconds: float = 300  # 5 minute cache

    def is_valid(self) -> bool:
        """Check if cache is still valid"""
        return (time.time() - self.cached_at) < self.ttl_seconds

class AIProvider(str, Enum):
    """Available AI providers"""
    OLLAMA = "ollama"
    AZURE_OPENAI = "azure_openai"

class ProviderConfig:
    """Manages the active AI provider configuration

    Supports both system-wide defaults and per-organization configurations.
    Organizations without custom configs use the system default (shared Azure).
    """

    def __init__(self):
        self.config_file = Path("/app/config/provider_config.json")
        self.default_provider = AIProvider.AZURE_OPENAI
        self._current_provider = None
        self._provider_settings = {}
        self._org_config_cache: Dict[str, CachedOrgConfig] = {}
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

    # =========================================================================
    # Organization-Aware Configuration Methods
    # =========================================================================

    def _is_org_config_cached(self, organization_id: str) -> bool:
        """Check if org config is in cache and still valid"""
        if organization_id not in self._org_config_cache:
            return False
        return self._org_config_cache[organization_id].is_valid()

    def _get_cached_org_config(self, organization_id: str) -> Optional[OrgLLMConfig]:
        """Get cached org config if valid"""
        if self._is_org_config_cached(organization_id):
            return self._org_config_cache[organization_id].config
        return None

    def _cache_org_config(self, organization_id: str, config: Optional[OrgLLMConfig]):
        """Cache org config with TTL"""
        self._org_config_cache[organization_id] = CachedOrgConfig(
            config=config,
            cached_at=time.time()
        )

    def clear_org_config_cache(self, organization_id: Optional[str] = None):
        """Clear org config cache (all or specific org)"""
        if organization_id:
            self._org_config_cache.pop(organization_id, None)
        else:
            self._org_config_cache.clear()

    def get_org_config_from_db(self, organization_id: str) -> Optional[OrgLLMConfig]:
        """Fetch org config from database (synchronous for now)"""
        # Import here to avoid circular imports
        from .database import db_config

        if not db_config.client:
            logger.warning("Supabase client not available, using system default")
            return None

        try:
            result = db_config.client.table('organization_llm_configs') \
                .select('*') \
                .eq('organization_id', organization_id) \
                .execute()

            if result.data and len(result.data) > 0:
                row = result.data[0]
                config = OrgLLMConfig.from_db_row(row)
                logger.info(f"Loaded org LLM config for {organization_id}: tier={config.tier}, provider={config.provider_type}")
                return config
            else:
                logger.debug(f"No custom LLM config for org {organization_id}, will use system default")
                return None

        except Exception as e:
            logger.error(f"Error fetching org LLM config for {organization_id}: {e}")
            return None

    def get_effective_config(self, organization_id: Optional[str] = None) -> EffectiveProviderConfig:
        """
        Get the effective provider configuration for a request.

        Falls back to system default if:
        - No organization_id provided
        - Organization has no custom config in database

        Args:
            organization_id: Optional organization ID for org-specific config

        Returns:
            EffectiveProviderConfig with the resolved configuration
        """
        # Import settings here to avoid circular imports
        from .settings import settings

        # No org specified → system default
        if not organization_id:
            return EffectiveProviderConfig(
                source="system_default",
                provider=self.current_provider,
                tier=LLMTier.NON_MANAGED,
                # System default uses Azure config from environment
                api_key=settings.AZURE_OPENAI_API_KEY,
                api_endpoint=settings.AZURE_OPENAI_ENDPOINT,
                deployment_name=settings.AZURE_OPENAI_DEPLOYMENT_NAME,
            )

        # Check cache first
        cached_config = self._get_cached_org_config(organization_id)
        if cached_config is None and self._is_org_config_cached(organization_id):
            # Cached as "no config" - use system default
            return EffectiveProviderConfig(
                source="system_default",
                provider=self.current_provider,
                tier=LLMTier.NON_MANAGED,
                organization_id=organization_id,
                api_key=settings.AZURE_OPENAI_API_KEY,
                api_endpoint=settings.AZURE_OPENAI_ENDPOINT,
                deployment_name=settings.AZURE_OPENAI_DEPLOYMENT_NAME,
            )

        if cached_config is not None:
            # Use cached org config
            return self._build_effective_config_from_org(cached_config, settings)

        # Fetch from database
        org_config = self.get_org_config_from_db(organization_id)
        self._cache_org_config(organization_id, org_config)

        if org_config is None:
            # No custom config → system default
            return EffectiveProviderConfig(
                source="system_default",
                provider=self.current_provider,
                tier=LLMTier.NON_MANAGED,
                organization_id=organization_id,
                api_key=settings.AZURE_OPENAI_API_KEY,
                api_endpoint=settings.AZURE_OPENAI_ENDPOINT,
                deployment_name=settings.AZURE_OPENAI_DEPLOYMENT_NAME,
            )

        # Use org-specific config
        return self._build_effective_config_from_org(org_config, settings)

    def _build_effective_config_from_org(
        self,
        org_config: OrgLLMConfig,
        settings
    ) -> EffectiveProviderConfig:
        """Build EffectiveProviderConfig from OrgLLMConfig"""

        # Determine the actual AIProvider to use based on provider_type
        if org_config.provider_type == LLMProviderType.NONE:
            # Free tier - no LLM
            return EffectiveProviderConfig(
                source="organization",
                provider=AIProvider.AZURE_OPENAI,  # Placeholder, won't be used
                tier=org_config.tier,
                organization_id=org_config.organization_id,
            )

        elif org_config.provider_type == LLMProviderType.SHARED:
            # Use system Azure config
            return EffectiveProviderConfig(
                source="organization",
                provider=AIProvider.AZURE_OPENAI,
                tier=org_config.tier,
                organization_id=org_config.organization_id,
                api_key=settings.AZURE_OPENAI_API_KEY,
                api_endpoint=settings.AZURE_OPENAI_ENDPOINT,
                deployment_name=settings.AZURE_OPENAI_DEPLOYMENT_NAME,
                daily_limit=org_config.daily_document_limit,
                monthly_limit=org_config.monthly_document_limit,
                documents_today=org_config.documents_processed_today,
                documents_month=org_config.documents_processed_month,
            )

        elif org_config.provider_type == LLMProviderType.BYOK_AZURE:
            # Customer's Azure key
            return EffectiveProviderConfig(
                source="organization",
                provider=AIProvider.AZURE_OPENAI,
                tier=org_config.tier,
                organization_id=org_config.organization_id,
                api_key=org_config.api_key,
                api_endpoint=org_config.api_endpoint,
                deployment_name=org_config.deployment_name,
            )

        elif org_config.provider_type == LLMProviderType.BYOK_OPENAI:
            # Customer's OpenAI key - route through Azure provider with OpenAI endpoint
            return EffectiveProviderConfig(
                source="organization",
                provider=AIProvider.AZURE_OPENAI,  # Will need special handling
                tier=org_config.tier,
                organization_id=org_config.organization_id,
                api_key=org_config.api_key,
                api_endpoint="https://api.openai.com/v1",  # OpenAI endpoint
            )

        elif org_config.provider_type == LLMProviderType.SELF_HOSTED:
            # Customer's Ollama/vLLM endpoint
            return EffectiveProviderConfig(
                source="organization",
                provider=AIProvider.OLLAMA,
                tier=org_config.tier,
                organization_id=org_config.organization_id,
                custom_endpoint=org_config.custom_endpoint,
            )

        # Fallback to system default
        return EffectiveProviderConfig(
            source="system_default",
            provider=self.current_provider,
            tier=LLMTier.NON_MANAGED,
            organization_id=org_config.organization_id,
            api_key=settings.AZURE_OPENAI_API_KEY,
            api_endpoint=settings.AZURE_OPENAI_ENDPOINT,
            deployment_name=settings.AZURE_OPENAI_DEPLOYMENT_NAME,
        )

    def increment_usage(self, organization_id: str) -> bool:
        """Increment usage counters for an organization (non_managed tier)"""
        from .database import db_config

        if not db_config.client:
            logger.warning("Supabase client not available, cannot increment usage")
            return False

        try:
            # Use RPC or direct update
            db_config.client.rpc(
                'increment_org_document_usage',
                {'org_id': organization_id}
            ).execute()

            # Clear cache so next request gets fresh counts
            self.clear_org_config_cache(organization_id)
            return True

        except Exception:
            # Fallback to direct update if RPC doesn't exist
            try:
                db_config.client.table('organization_llm_configs') \
                    .update({
                        'documents_processed_today': db_config.client.table('organization_llm_configs')
                            .select('documents_processed_today')
                            .eq('organization_id', organization_id)
                            .single()
                            .execute().data.get('documents_processed_today', 0) + 1,
                        'documents_processed_month': db_config.client.table('organization_llm_configs')
                            .select('documents_processed_month')
                            .eq('organization_id', organization_id)
                            .single()
                            .execute().data.get('documents_processed_month', 0) + 1,
                    }) \
                    .eq('organization_id', organization_id) \
                    .execute()

                self.clear_org_config_cache(organization_id)
                return True
            except Exception as e2:
                logger.error(f"Error incrementing usage for {organization_id}: {e2}")
                return False


# Global instance
provider_config = ProviderConfig()