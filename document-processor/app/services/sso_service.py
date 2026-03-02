"""
SSO Service — manages SAML 2.0 identity providers via Supabase Auth.

Abstracts the difference between:
  - Managed Supabase (uses Management API / CLI)
  - Self-hosted Supabase (uses GoTrue Admin API directly)

SAML flow is handled entirely by Supabase Auth — this service only
manages provider registration, not the login flow itself.
"""
import logging
import os
from dataclasses import dataclass
from typing import Any, Dict, List, Optional

import httpx

from ..config.database import db_config

logger = logging.getLogger(__name__)


@dataclass
class SSOProviderConfig:
    """Configuration for registering a SAML IdP."""
    domain: str
    idp_name: str = ""
    metadata_url: Optional[str] = None
    metadata_xml: Optional[str] = None
    attribute_mapping: Optional[Dict[str, str]] = None


@dataclass
class SSOProviderInfo:
    """Info about a registered SSO provider."""
    sso_provider_id: str
    domain: str
    idp_name: str = ""
    organization_id: str = ""
    auto_provision: bool = True
    default_role: str = "member"
    created_at: str = ""


class SSOService:
    """Manages SAML 2.0 SSO providers for FetchText organizations."""

    def __init__(self):
        self.supabase_url = os.getenv("SUPABASE_URL", os.getenv("VITE_SUPABASE_URL", "http://localhost:8000"))
        self.project_ref = os.getenv("SUPABASE_PROJECT_REF", "")
        self.service_role_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")

    @property
    def is_managed(self) -> bool:
        """True if using managed Supabase (has project ref)."""
        return bool(self.project_ref)

    @property
    def _auth_base_url(self) -> str:
        """Base URL for GoTrue admin API."""
        if self.is_managed:
            return f"https://{self.project_ref}.supabase.co/auth/v1"
        return f"{self.supabase_url}/auth/v1"

    def _admin_headers(self) -> Dict[str, str]:
        """Headers for GoTrue admin API calls."""
        return {
            "Authorization": f"Bearer {self.service_role_key}",
            "apikey": self.service_role_key,
            "Content-Type": "application/json",
        }

    def get_acs_url(self) -> str:
        """Get the SAML Assertion Consumer Service URL."""
        return f"{self._auth_base_url}/sso/saml/acs"

    def get_metadata_url(self) -> str:
        """Get the SP metadata URL for IdP configuration."""
        return f"{self._auth_base_url}/sso/saml/metadata"

    def get_entity_id(self) -> str:
        """Get the SP entity ID."""
        return self.get_metadata_url()

    # ── Provider Management ───────────────────────────────

    async def register_provider(
        self,
        organization_id: str,
        config: SSOProviderConfig,
    ) -> SSOProviderInfo:
        """Register a new SAML IdP with Supabase Auth."""
        body: Dict[str, Any] = {
            "type": "saml",
            "domains": [config.domain],
        }

        if config.metadata_url:
            body["metadata_url"] = config.metadata_url
        elif config.metadata_xml:
            body["metadata_xml"] = config.metadata_xml
        else:
            raise ValueError("Either metadata_url or metadata_xml is required")

        if config.attribute_mapping:
            body["attribute_mapping"] = config.attribute_mapping

        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(
                f"{self._auth_base_url}/admin/sso/providers",
                headers=self._admin_headers(),
                json=body,
            )
            resp.raise_for_status()
            data = resp.json()

        sso_provider_id = data.get("id", "")

        # Store mapping in our database
        supabase = db_config.client
        supabase.table("sso_provider_mappings").insert({
            "organization_id": organization_id,
            "sso_provider_id": sso_provider_id,
            "domain": config.domain,
            "idp_name": config.idp_name or config.domain,
            "metadata_url": config.metadata_url,
        }).execute()

        logger.info(f"Registered SAML provider for domain={config.domain} org={organization_id}")

        return SSOProviderInfo(
            sso_provider_id=sso_provider_id,
            domain=config.domain,
            idp_name=config.idp_name,
            organization_id=organization_id,
        )

    async def remove_provider(
        self,
        organization_id: str,
        sso_provider_id: str,
    ) -> bool:
        """Remove a SAML IdP from Supabase Auth."""
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.delete(
                f"{self._auth_base_url}/admin/sso/providers/{sso_provider_id}",
                headers=self._admin_headers(),
            )
            if resp.status_code not in (200, 204):
                logger.error(f"Failed to remove SSO provider: {resp.status_code} {resp.text}")
                return False

        # Remove mapping from our database
        supabase = db_config.client
        supabase.table("sso_provider_mappings") \
            .delete() \
            .eq("sso_provider_id", sso_provider_id) \
            .eq("organization_id", organization_id) \
            .execute()

        logger.info(f"Removed SAML provider {sso_provider_id} from org {organization_id}")
        return True

    async def list_providers(self) -> List[Dict[str, Any]]:
        """List all registered SSO providers from Supabase Auth."""
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.get(
                f"{self._auth_base_url}/admin/sso/providers",
                headers=self._admin_headers(),
            )
            resp.raise_for_status()
            data = resp.json()

        return data.get("items", [])

    # ── JIT Provisioning ──────────────────────────────────

    async def provision_user(
        self,
        user_id: str,
        sso_provider_id: str,
    ) -> Optional[Dict[str, Any]]:
        """JIT provision: add a new SSO user to their organization."""
        supabase = db_config.client

        # Look up the org mapping for this provider
        mapping_result = supabase.table("sso_provider_mappings") \
            .select("*") \
            .eq("sso_provider_id", sso_provider_id) \
            .single() \
            .execute()

        if not mapping_result.data:
            logger.warning(f"No org mapping for SSO provider {sso_provider_id}")
            return None

        mapping = mapping_result.data
        if not mapping.get("auto_provision"):
            logger.info(f"Auto-provision disabled for SSO provider {sso_provider_id}")
            return None

        organization_id = mapping["organization_id"]
        default_role = mapping.get("default_role", "member")

        # Check if user is already a member
        existing = supabase.table("organization_members") \
            .select("id") \
            .eq("user_id", user_id) \
            .eq("organization_id", organization_id) \
            .execute()

        if existing.data:
            logger.info(f"User {user_id} already member of org {organization_id}")
            return {"organization_id": organization_id, "role": default_role, "already_member": True}

        # Create membership
        supabase.table("organization_members").insert({
            "user_id": user_id,
            "organization_id": organization_id,
            "role": default_role,
        }).execute()

        logger.info(f"JIT provisioned user {user_id} into org {organization_id} as {default_role}")
        return {"organization_id": organization_id, "role": default_role, "already_member": False}

    # ── Status ────────────────────────────────────────────

    async def get_org_sso_status(self, organization_id: str) -> Optional[SSOProviderInfo]:
        """Get SSO configuration status for an organization."""
        supabase = db_config.client

        result = supabase.table("sso_provider_mappings") \
            .select("*") \
            .eq("organization_id", organization_id) \
            .execute()

        if not result.data:
            return None

        mapping = result.data[0]
        return SSOProviderInfo(
            sso_provider_id=mapping["sso_provider_id"],
            domain=mapping["domain"],
            idp_name=mapping.get("idp_name", ""),
            organization_id=organization_id,
            auto_provision=mapping.get("auto_provision", True),
            default_role=mapping.get("default_role", "member"),
            created_at=mapping.get("created_at", ""),
        )

    async def get_domain_mapping(self, domain: str) -> Optional[Dict[str, Any]]:
        """Look up SSO configuration by email domain."""
        supabase = db_config.client

        result = supabase.table("sso_provider_mappings") \
            .select("*") \
            .eq("domain", domain) \
            .execute()

        return result.data[0] if result.data else None


# Singleton
sso_service = SSOService()
