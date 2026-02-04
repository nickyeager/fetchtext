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

    # Azure Service Principal for provisioning (enterprise tier)
    AZURE_TENANT_ID: str = os.getenv("AZURE_TENANT_ID", "")
    AZURE_CLIENT_ID: str = os.getenv("AZURE_CLIENT_ID", "")
    AZURE_CLIENT_SECRET: str = os.getenv("AZURE_CLIENT_SECRET", "")
    AZURE_SUBSCRIPTION_ID: str = os.getenv("AZURE_SUBSCRIPTION_ID", "")
    AZURE_CUSTOMER_RESOURCE_GROUP: str = os.getenv("AZURE_CUSTOMER_RESOURCE_GROUP", "rg-fetchtext-customers-eastus")
    AZURE_CUSTOMER_LOCATION: str = os.getenv("AZURE_CUSTOMER_LOCATION", "eastus")

    # Supabase Configuration (for Vault and other services)
    SUPABASE_URL: str = os.getenv("SUPABASE_URL", "http://supabase-kong:8000")
    # Support both SUPABASE_SERVICE_ROLE_KEY and SERVICE_ROLE_KEY for compatibility
    SUPABASE_SERVICE_ROLE_KEY: Optional[str] = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SERVICE_ROLE_KEY")

    # ==========================================================================
    # OAuth Integration Credentials
    # ==========================================================================
    # These are used by the integration registry for OAuth flows.
    # Each integration reads its credentials from environment variables.

    # Google OAuth (Drive, Docs, Sheets)
    GOOGLE_CLIENT_ID: Optional[str] = os.getenv("GOOGLE_CLIENT_ID")
    GOOGLE_CLIENT_SECRET: Optional[str] = os.getenv("GOOGLE_CLIENT_SECRET")

    # QuickBooks Online OAuth
    QUICKBOOKS_CLIENT_ID: Optional[str] = os.getenv("QUICKBOOKS_CLIENT_ID")
    QUICKBOOKS_CLIENT_SECRET: Optional[str] = os.getenv("QUICKBOOKS_CLIENT_SECRET")
    QUICKBOOKS_SANDBOX: bool = os.getenv("QUICKBOOKS_SANDBOX", "true").lower() == "true"

    # Microsoft 365 OAuth (OneDrive, Word, SharePoint)
    MICROSOFT_CLIENT_ID: Optional[str] = os.getenv("MICROSOFT_CLIENT_ID")
    MICROSOFT_CLIENT_SECRET: Optional[str] = os.getenv("MICROSOFT_CLIENT_SECRET")
    MICROSOFT_TENANT_ID: str = os.getenv("MICROSOFT_TENANT_ID", "common")

    # Dropbox OAuth (future)
    DROPBOX_CLIENT_ID: Optional[str] = os.getenv("DROPBOX_CLIENT_ID")
    DROPBOX_CLIENT_SECRET: Optional[str] = os.getenv("DROPBOX_CLIENT_SECRET")

    # Slack OAuth (future - for notifications)
    SLACK_CLIENT_ID: Optional[str] = os.getenv("SLACK_CLIENT_ID")
    SLACK_CLIENT_SECRET: Optional[str] = os.getenv("SLACK_CLIENT_SECRET")

    # Xero OAuth (future - accounting alternative)
    XERO_CLIENT_ID: Optional[str] = os.getenv("XERO_CLIENT_ID")
    XERO_CLIENT_SECRET: Optional[str] = os.getenv("XERO_CLIENT_SECRET")

    # ==========================================================================
    # Stripe Configuration
    # ==========================================================================
    STRIPE_SECRET_KEY: Optional[str] = os.getenv("STRIPE_SECRET_KEY")
    STRIPE_PUBLISHABLE_KEY: Optional[str] = os.getenv("STRIPE_PUBLISHABLE_KEY")
    STRIPE_WEBHOOK_SECRET: Optional[str] = os.getenv("STRIPE_WEBHOOK_SECRET")

    # Stripe Product IDs (set after creating products in Stripe Dashboard)
    STRIPE_PRICE_NON_MANAGED: Optional[str] = os.getenv("STRIPE_PRICE_NON_MANAGED")
    STRIPE_PRICE_PROFESSIONAL: Optional[str] = os.getenv("STRIPE_PRICE_PROFESSIONAL")
    STRIPE_PRICE_ENTERPRISE: Optional[str] = os.getenv("STRIPE_PRICE_ENTERPRISE")

    # Frontend URLs for Stripe redirects
    FRONTEND_URL: str = os.getenv("FRONTEND_URL", "http://localhost:5173")

    @classmethod
    def is_azure_configured(cls) -> bool:
        """Check if Azure OpenAI is properly configured"""
        return bool(
            cls.AZURE_OPENAI_API_KEY and
            cls.AZURE_OPENAI_ENDPOINT and
            cls.AZURE_OPENAI_DEPLOYMENT_NAME
        )

    @classmethod
    def is_azure_provisioning_configured(cls) -> bool:
        """Check if Azure provisioning credentials are set"""
        return bool(
            cls.AZURE_TENANT_ID and
            cls.AZURE_CLIENT_ID and
            cls.AZURE_CLIENT_SECRET and
            cls.AZURE_SUBSCRIPTION_ID
        )

    @classmethod
    def is_google_configured(cls) -> bool:
        """Check if Google OAuth is configured"""
        return bool(cls.GOOGLE_CLIENT_ID and cls.GOOGLE_CLIENT_SECRET)

    @classmethod
    def is_quickbooks_configured(cls) -> bool:
        """Check if QuickBooks OAuth is configured"""
        return bool(cls.QUICKBOOKS_CLIENT_ID and cls.QUICKBOOKS_CLIENT_SECRET)

    @classmethod
    def is_microsoft_configured(cls) -> bool:
        """Check if Microsoft OAuth is configured"""
        return bool(cls.MICROSOFT_CLIENT_ID and cls.MICROSOFT_CLIENT_SECRET)

    @classmethod
    def is_stripe_configured(cls) -> bool:
        """Check if Stripe is properly configured"""
        return bool(cls.STRIPE_SECRET_KEY)

    @classmethod
    def get_configured_integrations(cls) -> list:
        """Get list of configured integration types"""
        configured = []
        if cls.is_google_configured():
            configured.append("google")
        if cls.is_quickbooks_configured():
            configured.append("quickbooks")
        if cls.is_microsoft_configured():
            configured.append("microsoft")
        return configured

# Create global settings instance
settings = Settings()