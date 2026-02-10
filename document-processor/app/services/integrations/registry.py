"""
Integration Registry

Central configuration for all integrations (OAuth and credential-based).
To add a new integration, simply add a new IntegrationConfig to INTEGRATION_REGISTRY.
"""

from dataclasses import dataclass, field
from typing import Dict, List, Optional, Any
from enum import Enum
import os


class IntegrationType(str, Enum):
    """Supported integration types"""
    GOOGLE = "google"
    QUICKBOOKS = "quickbooks"
    MICROSOFT = "microsoft"
    DROPBOX = "dropbox"
    SLACK = "slack"
    SALESFORCE = "salesforce"
    HUBSPOT = "hubspot"
    XERO = "xero"
    SNOWFLAKE = "snowflake"


@dataclass
class IntegrationConfig:
    """
    Configuration for an integration.

    Supports two auth modes:
    - "oauth": Standard OAuth2 flow with auth/token endpoints
    - "credential": Direct credential entry (e.g., API keys, private keys)

    For OAuth integrations, this config defines:
    - OAuth endpoints (auth, token, revoke)
    - Available scopes and presets
    - Environment variable names for credentials
    - Provider-specific behavior flags

    For credential integrations, this config defines:
    - credential_fields: Dynamic form field definitions
    - No OAuth endpoints needed
    """

    # Basic identification
    type: IntegrationType
    display_name: str
    description: str = ""
    icon: str = ""  # Icon name or URL

    # Auth mode: "oauth", "credential", or "dual" (supports both)
    auth_mode: str = "oauth"

    # Credential-based auth fields (for auth_mode="credential")
    # Each dict has: name, label, type (text/password/textarea), required, placeholder, help
    credential_fields: List[Dict[str, str]] = field(default_factory=list)

    # OAuth endpoints
    auth_url: str = ""
    token_url: str = ""
    revoke_url: Optional[str] = None
    userinfo_url: Optional[str] = None  # For fetching user/account info

    # URL templates with placeholders (e.g., {account} for Snowflake OAuth)
    auth_url_template: Optional[str] = None
    token_url_template: Optional[str] = None

    # Scopes configuration
    # Keys are preset names, values are lists of scope strings
    # Example: {"readonly": ["read"], "full": ["read", "write"]}
    scopes: Dict[str, List[str]] = field(default_factory=dict)
    default_scope_preset: str = "default"

    # OAuth flow configuration
    uses_pkce: bool = False
    token_endpoint_auth_method: str = "client_secret_post"  # or "client_secret_basic"
    include_granted_scopes: bool = True  # Include scope in token response

    # Callback handling - extra params returned by provider
    # Example: QuickBooks returns "realmId" (company ID) in callback
    extra_callback_params: List[str] = field(default_factory=list)

    # Metadata extraction - how to get provider-specific IDs
    # Maps our field name to the provider's response field
    metadata_mapping: Dict[str, str] = field(default_factory=dict)

    # Environment variable names for credentials
    client_id_env: str = ""
    client_secret_env: str = ""

    # Feature flags
    supports_refresh: bool = True
    supports_revoke: bool = True

    # Rate limiting
    requests_per_minute: int = 60

    # Sandbox/test mode
    sandbox_auth_url: Optional[str] = None
    sandbox_token_url: Optional[str] = None
    sandbox_api_url: Optional[str] = None

    @property
    def client_id(self) -> str:
        """Get client ID from environment"""
        if not self.client_id_env:
            return ""
        return os.getenv(self.client_id_env, "")

    @property
    def client_secret(self) -> str:
        """Get client secret from environment"""
        if not self.client_secret_env:
            return ""
        return os.getenv(self.client_secret_env, "")

    @property
    def is_configured(self) -> bool:
        """Check if integration has required credentials configured"""
        if self.auth_mode in ("credential", "dual"):
            # Credential-based and dual integrations are always "configured" on the backend
            # (credentials are provided by the user at connect time, not env vars)
            return True
        return bool(self.client_id and self.client_secret)

    def get_auth_url_for_account(self, account: str) -> str:
        """Get auth URL with account placeholder filled in (for OAuth mode)"""
        if self.auth_url_template:
            return self.auth_url_template.replace("{account}", account)
        return self.auth_url

    def get_token_url_for_account(self, account: str) -> str:
        """Get token URL with account placeholder filled in (for OAuth mode)"""
        if self.token_url_template:
            return self.token_url_template.replace("{account}", account)
        return self.token_url

    def get_scopes(self, preset: Optional[str] = None) -> List[str]:
        """Get scopes for a preset, or default if not specified"""
        preset = preset or self.default_scope_preset
        return self.scopes.get(preset, self.scopes.get("default", []))

    def get_auth_url(self, use_sandbox: bool = False) -> str:
        """Get auth URL, optionally for sandbox"""
        if use_sandbox and self.sandbox_auth_url:
            return self.sandbox_auth_url
        return self.auth_url

    def get_token_url(self, use_sandbox: bool = False) -> str:
        """Get token URL, optionally for sandbox"""
        if use_sandbox and self.sandbox_token_url:
            return self.sandbox_token_url
        return self.token_url


# =============================================================================
# Integration Registry - Add new integrations here
# =============================================================================

INTEGRATION_REGISTRY: Dict[str, IntegrationConfig] = {

    # -------------------------------------------------------------------------
    # Google (Drive, Docs, Sheets)
    # -------------------------------------------------------------------------
    "google": IntegrationConfig(
        type=IntegrationType.GOOGLE,
        display_name="Google Drive & Docs",
        description="Import documents from Drive and generate Google Docs from templates",
        icon="google",

        auth_url="https://accounts.google.com/o/oauth2/v2/auth",
        token_url="https://oauth2.googleapis.com/token",
        revoke_url="https://oauth2.googleapis.com/revoke",
        # Use tokeninfo endpoint - works without enabling any specific API
        userinfo_url="https://oauth2.googleapis.com/tokeninfo",

        scopes={
            "drive_readonly": [
                "https://www.googleapis.com/auth/drive.readonly",
            ],
            "docs": [
                "https://www.googleapis.com/auth/documents",
                "https://www.googleapis.com/auth/drive.file",
            ],
            "default": [
                "https://www.googleapis.com/auth/documents",
                "https://www.googleapis.com/auth/drive.file",
            ],
            "full": [
                "https://www.googleapis.com/auth/drive",
                "https://www.googleapis.com/auth/documents",
            ],
        },
        default_scope_preset="default",

        client_id_env="GOOGLE_CLIENT_ID",
        client_secret_env="GOOGLE_CLIENT_SECRET",

        supports_refresh=True,
        supports_revoke=True,
    ),

    # -------------------------------------------------------------------------
    # QuickBooks Online
    # -------------------------------------------------------------------------
    "quickbooks": IntegrationConfig(
        type=IntegrationType.QUICKBOOKS,
        display_name="QuickBooks Online",
        description="Create invoices and sync accounting data from extracted documents",
        icon="quickbooks",

        auth_url="https://appcenter.intuit.com/connect/oauth2",
        token_url="https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer",
        revoke_url="https://developer.api.intuit.com/v2/oauth2/tokens/revoke",

        # Sandbox URLs for testing
        sandbox_auth_url="https://appcenter.intuit.com/connect/oauth2",
        sandbox_token_url="https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer",
        sandbox_api_url="https://sandbox-quickbooks.api.intuit.com/v3",

        scopes={
            "default": ["com.intuit.quickbooks.accounting"],
            "payments": [
                "com.intuit.quickbooks.accounting",
                "com.intuit.quickbooks.payment",
            ],
        },
        default_scope_preset="default",

        # QuickBooks returns company ID in callback
        extra_callback_params=["realmId"],
        metadata_mapping={
            "company_id": "realmId",
        },

        client_id_env="QUICKBOOKS_CLIENT_ID",
        client_secret_env="QUICKBOOKS_CLIENT_SECRET",

        supports_refresh=True,
        supports_revoke=True,
        requests_per_minute=500,  # QB has generous limits
    ),

    # -------------------------------------------------------------------------
    # Microsoft 365 (OneDrive, Word, SharePoint)
    # -------------------------------------------------------------------------
    "microsoft": IntegrationConfig(
        type=IntegrationType.MICROSOFT,
        display_name="Microsoft 365",
        description="Generate Word documents and integrate with OneDrive/SharePoint",
        icon="microsoft",

        auth_url="https://login.microsoftonline.com/common/oauth2/v2.0/authorize",
        token_url="https://login.microsoftonline.com/common/oauth2/v2.0/token",
        userinfo_url="https://graph.microsoft.com/v1.0/me",

        scopes={
            "onedrive": [
                "https://graph.microsoft.com/Files.ReadWrite.All",
                "https://graph.microsoft.com/User.Read",
                "offline_access",
            ],
            "default": [
                "https://graph.microsoft.com/Files.ReadWrite.All",
                "https://graph.microsoft.com/User.Read",
                "offline_access",
            ],
            "sharepoint": [
                "https://graph.microsoft.com/Sites.ReadWrite.All",
                "https://graph.microsoft.com/Files.ReadWrite.All",
                "https://graph.microsoft.com/User.Read",
                "offline_access",
            ],
            "full": [
                "https://graph.microsoft.com/Sites.ReadWrite.All",
                "https://graph.microsoft.com/Files.ReadWrite.All",
                "https://graph.microsoft.com/Mail.Send",
                "https://graph.microsoft.com/User.Read",
                "offline_access",
            ],
        },
        default_scope_preset="default",

        client_id_env="MICROSOFT_CLIENT_ID",
        client_secret_env="MICROSOFT_CLIENT_SECRET",

        supports_refresh=True,
        supports_revoke=False,  # MS doesn't have a revoke endpoint
    ),

    # -------------------------------------------------------------------------
    # Dropbox (Future)
    # -------------------------------------------------------------------------
    "dropbox": IntegrationConfig(
        type=IntegrationType.DROPBOX,
        display_name="Dropbox",
        description="Import and export documents from Dropbox",
        icon="dropbox",

        auth_url="https://www.dropbox.com/oauth2/authorize",
        token_url="https://api.dropboxapi.com/oauth2/token",
        revoke_url="https://api.dropboxapi.com/2/auth/token/revoke",

        scopes={
            "default": [],  # Dropbox uses app-level permissions, not scopes
        },

        client_id_env="DROPBOX_CLIENT_ID",
        client_secret_env="DROPBOX_CLIENT_SECRET",

        token_endpoint_auth_method="client_secret_basic",
        supports_refresh=True,
        supports_revoke=True,
    ),

    # -------------------------------------------------------------------------
    # Slack (Future - for notifications)
    # -------------------------------------------------------------------------
    "slack": IntegrationConfig(
        type=IntegrationType.SLACK,
        display_name="Slack",
        description="Send notifications and document summaries to Slack channels",
        icon="slack",

        auth_url="https://slack.com/oauth/v2/authorize",
        token_url="https://slack.com/api/oauth.v2.access",
        revoke_url="https://slack.com/api/auth.revoke",

        scopes={
            "default": [
                "chat:write",
                "files:write",
            ],
            "full": [
                "chat:write",
                "files:write",
                "channels:read",
                "users:read",
            ],
        },

        extra_callback_params=["team_id"],
        metadata_mapping={
            "team_id": "team_id",
            "team_name": "team_name",
        },

        client_id_env="SLACK_CLIENT_ID",
        client_secret_env="SLACK_CLIENT_SECRET",

        supports_refresh=False,  # Slack tokens don't expire
        supports_revoke=True,
    ),

    # -------------------------------------------------------------------------
    # Xero (Future - accounting alternative to QuickBooks)
    # -------------------------------------------------------------------------
    "xero": IntegrationConfig(
        type=IntegrationType.XERO,
        display_name="Xero",
        description="Create invoices and sync accounting data with Xero",
        icon="xero",

        auth_url="https://login.xero.com/identity/connect/authorize",
        token_url="https://identity.xero.com/connect/token",
        revoke_url="https://identity.xero.com/connect/revocation",

        scopes={
            "default": [
                "openid",
                "profile",
                "email",
                "accounting.transactions",
                "accounting.contacts",
                "offline_access",
            ],
        },

        extra_callback_params=["tenant_id"],
        metadata_mapping={
            "tenant_id": "xero_tenant_id",
        },

        client_id_env="XERO_CLIENT_ID",
        client_secret_env="XERO_CLIENT_SECRET",

        uses_pkce=True,
        supports_refresh=True,
        supports_revoke=True,
    ),

    # -------------------------------------------------------------------------
    # Snowflake (Stages - file storage and data exports)
    # -------------------------------------------------------------------------
    "snowflake": IntegrationConfig(
        type=IntegrationType.SNOWFLAKE,
        display_name="Snowflake Stages",
        description="Browse and import documents from Snowflake Stages for processing",
        icon="snowflake",

        # Dual mode: supports both key-pair credentials and OAuth
        auth_mode="dual",

        credential_fields=[
            {
                "name": "account_identifier",
                "label": "Account Identifier",
                "type": "text",
                "required": "true",
                "placeholder": "xy12345.us-east-1",
                "help": "Your Snowflake account identifier (e.g., xy12345.us-east-1)",
            },
            {
                "name": "username",
                "label": "Username",
                "type": "text",
                "required": "true",
                "placeholder": "my_user",
                "help": "Snowflake username for authentication",
            },
            {
                "name": "private_key",
                "label": "Private Key (PEM)",
                "type": "textarea",
                "required": "true",
                "placeholder": "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----",
                "help": "RSA private key in PEM format for key-pair authentication",
            },
            {
                "name": "warehouse",
                "label": "Warehouse",
                "type": "text",
                "required": "true",
                "placeholder": "COMPUTE_WH",
                "help": "Default warehouse to use for queries",
            },
            {
                "name": "database",
                "label": "Database",
                "type": "text",
                "required": "false",
                "placeholder": "MY_DATABASE",
                "help": "Default database (optional, can be selected later)",
            },
            {
                "name": "role",
                "label": "Role",
                "type": "text",
                "required": "false",
                "placeholder": "SYSADMIN",
                "help": "Snowflake role to use (optional, defaults to user's default role)",
            },
        ],

        # Per-account OAuth endpoints (Snowflake is per-account, not global)
        auth_url_template="https://{account}.snowflakecomputing.com/oauth/authorize",
        token_url_template="https://{account}.snowflakecomputing.com/oauth/token-request",

        scopes={
            "default": ["session:role:PUBLIC"],
        },

        # Client credentials come from the customer's Snowflake Security Integration,
        # not from our env vars - but keep env vars for optional pre-configuration
        client_id_env="SNOWFLAKE_OAUTH_CLIENT_ID",
        client_secret_env="SNOWFLAKE_OAUTH_CLIENT_SECRET",

        token_endpoint_auth_method="client_secret_post",
        supports_refresh=True,
        supports_revoke=False,
    ),
}


# =============================================================================
# Registry Functions
# =============================================================================

def get_integration(name: str) -> IntegrationConfig:
    """
    Get integration config by name.

    Args:
        name: Integration identifier (e.g., 'google', 'quickbooks')

    Returns:
        IntegrationConfig for the requested integration

    Raises:
        ValueError: If integration is not registered
    """
    if name not in INTEGRATION_REGISTRY:
        available = list(INTEGRATION_REGISTRY.keys())
        raise ValueError(f"Unknown integration: {name}. Available: {available}")
    return INTEGRATION_REGISTRY[name]


def register_integration(config: IntegrationConfig) -> None:
    """
    Register a new integration at runtime.

    This allows adding integrations dynamically without modifying
    the registry code (useful for plugins or custom integrations).

    Args:
        config: IntegrationConfig to register
    """
    INTEGRATION_REGISTRY[config.type.value] = config


def list_integrations(configured_only: bool = False) -> List[Dict[str, Any]]:
    """
    List all available integrations.

    Args:
        configured_only: If True, only return integrations with credentials set

    Returns:
        List of integration info dicts
    """
    result = []
    for key, config in INTEGRATION_REGISTRY.items():
        if configured_only and not config.is_configured:
            continue
        entry = {
            "id": key,
            "type": config.type.value,
            "name": config.display_name,
            "description": config.description,
            "icon": config.icon,
            "configured": config.is_configured,
            "auth_mode": config.auth_mode,
            "scope_presets": list(config.scopes.keys()),
            "features": {
                "refresh": config.supports_refresh,
                "revoke": config.supports_revoke,
            },
        }
        if config.auth_mode in ("credential", "dual") and config.credential_fields:
            entry["credential_fields"] = config.credential_fields
        if config.auth_mode == "dual":
            entry["auth_modes"] = ["credential", "oauth"]
        result.append(entry)
    return result


def get_configured_integrations() -> List[str]:
    """Get list of integration IDs that have credentials configured"""
    return [
        key for key, config in INTEGRATION_REGISTRY.items()
        if config.is_configured
    ]
