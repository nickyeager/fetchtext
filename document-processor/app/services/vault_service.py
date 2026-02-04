"""
Supabase Vault Service

Stores and retrieves secrets securely using Supabase Vault.
"""
import logging
from typing import Optional
import httpx

from ..config import settings

logger = logging.getLogger(__name__)

# Timeout for Vault API requests
VAULT_TIMEOUT_SECONDS = 30.0

# Warning message for unconfigured vault
VAULT_NOT_CONFIGURED_MSG = "Vault not configured"


class VaultService:
    """Service for storing secrets in Supabase Vault"""

    def __init__(self):
        self.supabase_url = settings.SUPABASE_URL
        self.service_role_key = settings.SUPABASE_SERVICE_ROLE_KEY
        self._client: Optional[httpx.AsyncClient] = None

    @property
    def is_configured(self) -> bool:
        """Check if vault access is configured"""
        return bool(self.supabase_url and self.service_role_key)

    def _get_client(self) -> httpx.AsyncClient:
        """Get or create the shared httpx client for connection pooling"""
        if self._client is None or self._client.is_closed:
            self._client = httpx.AsyncClient(
                timeout=VAULT_TIMEOUT_SECONDS,
                headers=self._get_headers(),
            )
        return self._client

    async def close(self):
        """Close the shared httpx client"""
        if self._client is not None and not self._client.is_closed:
            await self._client.aclose()
            self._client = None

    def _get_headers(self) -> dict:
        """Get headers for Supabase API requests"""
        return {
            "apikey": self.service_role_key,
            "Authorization": f"Bearer {self.service_role_key}",
            "Content-Type": "application/json",
        }

    async def store_secret(
        self,
        name: str,
        secret: str,
        description: Optional[str] = None,
    ) -> Optional[str]:
        """
        Store a secret in Supabase Vault (upsert behavior).

        If a secret with the same name already exists, it will be updated.

        Args:
            name: Unique name for the secret
            secret: The secret value to store
            description: Optional description

        Returns:
            The secret ID if successful, None otherwise
        """
        if not self.is_configured:
            logger.warning(VAULT_NOT_CONFIGURED_MSG)
            return None

        try:
            client = self._get_client()
            response = await client.post(
                f"{self.supabase_url}/rest/v1/rpc/vault_insert_secret",
                json={
                    "new_name": name,
                    "new_secret": secret,
                    "new_description": description or "",
                },
            )

            if response.status_code == 200:
                result = response.json()
                # Extract just the ID if it's a dict
                secret_id = result.get("id") if isinstance(result, dict) else result
                logger.info(f"Stored secret: {name} (ID: {secret_id})")
                return secret_id
            elif response.status_code == 409:
                # Secret with this name already exists - delete and recreate
                logger.info(f"Secret '{name}' already exists, deleting and recreating")
                # Get the existing secret ID first
                get_id_response = await client.post(
                    f"{self.supabase_url}/rest/v1/rpc/vault_get_secret_id_by_name",
                    json={"secret_name": name},
                )
                if get_id_response.status_code == 200:
                    old_secret_id = get_id_response.json()
                    if old_secret_id:
                        logger.debug(f"Deleting old secret {old_secret_id}")
                        await self.delete_secret(old_secret_id)
                        # Create new secret
                        return await self._create_secret_directly(name, secret, description)
                logger.warning(f"Could not find existing secret '{name}' to delete, trying update fallback")
                result = await self._update_secret_by_name(name, secret, description)
                logger.debug(f"Update result for '{name}': {result}")
                return result
            else:
                logger.error(f"Failed to store secret '{name}': HTTP {response.status_code} - {response.text}")
                return None

        except Exception:
            logger.exception(f"Vault error storing secret '{name}'")
            return None

    async def _update_secret_by_name(
        self,
        name: str,
        secret: str,
        description: Optional[str] = None,
    ) -> Optional[str]:
        """
        Update an existing secret by name.

        Args:
            name: Name of the secret to update
            secret: The new secret value
            description: Optional new description

        Returns:
            The secret ID if successful, None otherwise
        """
        try:
            client = self._get_client()
            # First, get the secret ID by name
            response = await client.post(
                f"{self.supabase_url}/rest/v1/rpc/vault_get_secret_id_by_name",
                json={"secret_name": name},
            )

            logger.debug(f"vault_get_secret_id_by_name response: {response.status_code}")
            if response.status_code == 200:
                secret_id = response.json()
                logger.debug(f"Got secret_id: {secret_id}")
                if secret_id:
                    # Update the secret
                    update_response = await client.post(
                        f"{self.supabase_url}/rest/v1/rpc/vault_update_secret",
                        json={
                            "p_secret_id": secret_id,  # Match function parameter names
                            "p_new_secret": secret,
                            "p_new_description": description or "",
                        },
                    )
                    logger.debug(f"vault_update_secret response: {update_response.status_code}")
                    # 200 OK or 204 No Content both indicate success
                    if update_response.status_code in (200, 204):
                        logger.info(f"Updated secret: {name} (ID: {secret_id})")
                        return secret_id
                    else:
                        logger.error(f"Failed to update secret '{name}': HTTP {update_response.status_code}")
                        return None

            # If vault_get_secret_id_by_name doesn't exist, try deleting and re-creating
            logger.info(f"Falling back to delete+create for secret '{name}'")
            # Query for the secret ID directly from the secrets table
            query_response = await client.get(
                f"{self.supabase_url}/rest/v1/vault.secrets",
                params={"name": f"eq.{name}", "select": "id"},
            )

            if query_response.status_code == 200:
                secrets = query_response.json()
                if secrets and len(secrets) > 0:
                    old_secret_id = secrets[0].get("id")
                    if old_secret_id:
                        # Delete old secret
                        await self.delete_secret(old_secret_id)
                        # Create new secret
                        return await self._create_secret_directly(name, secret, description)

            logger.error(f"Could not find existing secret '{name}' to update")
            return None

        except Exception:
            logger.exception(f"Vault error updating secret '{name}'")
            return None

    async def _create_secret_directly(
        self,
        name: str,
        secret: str,
        description: Optional[str] = None,
    ) -> Optional[str]:
        """Create a secret directly after deletion (for fallback)"""
        try:
            client = self._get_client()
            response = await client.post(
                f"{self.supabase_url}/rest/v1/rpc/vault_insert_secret",
                json={
                    "new_name": name,
                    "new_secret": secret,
                    "new_description": description or "",
                },
            )
            if response.status_code == 200:
                result = response.json()
                secret_id = result.get("id") if isinstance(result, dict) else result
                logger.info(f"Re-created secret: {name} (ID: {secret_id})")
                return secret_id
            else:
                logger.error(f"Failed to re-create secret '{name}': HTTP {response.status_code}")
                return None
        except Exception:
            logger.exception(f"Vault error re-creating secret '{name}'")
            return None

    async def get_secret(self, secret_id: str) -> Optional[str]:
        """
        Retrieve a secret from Supabase Vault.

        Args:
            secret_id: The ID of the secret to retrieve

        Returns:
            The decrypted secret value, or None if not found
        """
        if not self.is_configured:
            logger.warning(VAULT_NOT_CONFIGURED_MSG)
            return None

        try:
            client = self._get_client()
            response = await client.post(
                f"{self.supabase_url}/rest/v1/rpc/vault_read_secret",
                json={"secret_id": secret_id},
            )

            if response.status_code == 200:
                return response.json()
            else:
                logger.error(f"Failed to read secret '{secret_id}': HTTP {response.status_code} - {response.text}")
                return None

        except Exception:
            logger.exception(f"Vault error reading secret '{secret_id}'")
            return None

    async def delete_secret(self, secret_id: str) -> bool:
        """Delete a secret from the vault"""
        if not self.is_configured:
            logger.warning(VAULT_NOT_CONFIGURED_MSG)
            return False

        try:
            client = self._get_client()
            response = await client.post(
                f"{self.supabase_url}/rest/v1/rpc/vault_delete_secret",
                json={"secret_id": secret_id},
            )
            if response.status_code == 200:
                logger.info(f"Deleted secret: {secret_id}")
                return True
            else:
                logger.error(f"Failed to delete secret '{secret_id}': HTTP {response.status_code} - {response.text}")
                return False

        except Exception:
            logger.exception(f"Vault error deleting secret '{secret_id}'")
            return False


# Global instance
vault_service = VaultService()
