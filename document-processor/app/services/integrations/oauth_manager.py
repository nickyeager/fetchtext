"""
OAuth Manager

Generic OAuth2 flow handler for all integrations.
Handles authorization, token exchange, storage, and refresh.
"""

import secrets
import logging
import httpx
from typing import Dict, Any, Optional, Tuple, List
from datetime import datetime, timedelta
from urllib.parse import urlencode
import hashlib
import base64

from .registry import IntegrationConfig, get_integration
from ..vault_service import vault_service
from ...config.database import db_config

logger = logging.getLogger(__name__)


class OAuthManager:
    """
    Generic OAuth2 manager for all integrations.

    Handles:
    - OAuth flow initiation with state management
    - Authorization code exchange
    - Token storage in Vault
    - Token refresh with rotation
    - Integration status tracking
    """

    # State expiration (5 minutes)
    STATE_EXPIRY_MINUTES = 5

    # Token refresh buffer (refresh if expires within this time)
    REFRESH_BUFFER_MINUTES = 10

    @classmethod
    async def initiate_flow(
        cls,
        config: IntegrationConfig,
        organization_id: str,
        redirect_uri: str,
        scope_preset: Optional[str] = None,
        user_id: Optional[str] = None,
    ) -> Tuple[str, str]:
        """
        Initiate OAuth flow for an integration.

        Args:
            config: Integration configuration
            organization_id: Organization initiating the connection
            redirect_uri: Where to redirect after authorization
            scope_preset: Which scope preset to request
            user_id: User initiating the connection (for audit)

        Returns:
            Tuple of (authorization_url, state)
        """
        # Generate CSRF state token
        state_token = secrets.token_urlsafe(32)
        state = f"{organization_id}:{config.type.value}:{state_token}"

        # Store state in database
        await cls._store_oauth_state(
            organization_id=organization_id,
            integration_type=config.type.value,
            state=state,
            user_id=user_id,
        )

        # Get scopes for the preset
        scopes = config.get_scopes(scope_preset)

        # Build authorization URL
        params = {
            "client_id": config.client_id,
            "redirect_uri": redirect_uri,
            "response_type": "code",
            "scope": " ".join(scopes),
            "state": state,
            "access_type": "offline",  # Request refresh token
            "prompt": "consent",  # Force consent to get refresh token
        }

        # Add PKCE if required
        if config.uses_pkce:
            code_verifier = secrets.token_urlsafe(64)
            code_challenge = base64.urlsafe_b64encode(
                hashlib.sha256(code_verifier.encode()).digest()
            ).rstrip(b"=").decode()
            params["code_challenge"] = code_challenge
            params["code_challenge_method"] = "S256"
            # Store verifier for token exchange
            await cls._store_pkce_verifier(organization_id, config.type.value, code_verifier)

        auth_url = f"{config.auth_url}?{urlencode(params)}"

        logger.info(f"Initiated OAuth flow for {config.type.value} (org: {organization_id})")
        return auth_url, state

    @classmethod
    async def handle_callback(
        cls,
        config: IntegrationConfig,
        code: str,
        state: str,
        redirect_uri: str,
        extra_metadata: Optional[Dict[str, Any]] = None,
    ) -> Tuple[bool, Optional[str]]:
        """
        Handle OAuth callback and exchange code for tokens.

        Args:
            config: Integration configuration
            code: Authorization code from provider
            state: State parameter for CSRF validation
            redirect_uri: Redirect URI used in auth request
            extra_metadata: Extra params from callback (e.g., realmId)

        Returns:
            Tuple of (success, error_message)
        """
        try:
            # Parse and validate state
            parts = state.split(":")
            if len(parts) != 3:
                return False, "Invalid state format"

            organization_id, integration_type, _ = parts

            if integration_type != config.type.value:
                return False, f"Integration type mismatch: expected {config.type.value}, got {integration_type}"

            # Verify state hasn't expired
            is_valid = await cls._validate_oauth_state(
                organization_id=organization_id,
                integration_type=config.type.value,
                state=state,
            )
            if not is_valid:
                return False, "Invalid or expired OAuth state"

            # Exchange code for tokens
            tokens = await cls._exchange_code(config, code, redirect_uri, organization_id)

            # Build metadata from callback params and token response
            metadata = extra_metadata or {}
            if config.metadata_mapping:
                for our_key, their_key in config.metadata_mapping.items():
                    if their_key in metadata:
                        continue  # Already set from callback
                    if their_key in tokens:
                        metadata[our_key] = tokens[their_key]

            # Store tokens
            await cls._store_tokens(
                organization_id=organization_id,
                integration_type=config.type.value,
                access_token=tokens["access_token"],
                refresh_token=tokens.get("refresh_token"),
                expires_in=tokens.get("expires_in"),
                scopes=tokens.get("scope", "").split(" ") if tokens.get("scope") else [],
                metadata=metadata,
            )

            logger.info(f"OAuth callback successful for {config.type.value} (org: {organization_id})")
            return True, None

        except Exception as e:
            logger.exception(f"OAuth callback error for {config.type.value}")
            return False, str(e)

    @classmethod
    async def refresh_token(
        cls,
        config: IntegrationConfig,
        organization_id: str,
        reason: str = "expired",
    ) -> Dict[str, Any]:
        """
        Refresh an integration's access token.

        Args:
            config: Integration configuration
            organization_id: Organization to refresh
            reason: Why we're refreshing (for logging)

        Returns:
            Dict with success status and new expiry
        """
        if not config.supports_refresh:
            return {"success": False, "error": f"{config.type.value} does not support token refresh"}

        try:
            # Get current refresh token from database
            if not db_config.client:
                return {"success": False, "error": "Database not configured"}

            result = db_config.client.table("organization_integrations").select(
                "id", "refresh_token_vault_id", "token_expires_at"
            ).eq("organization_id", organization_id).eq(
                "integration_type", config.type.value
            ).maybe_single().execute()

            # maybe_single() returns None when no row found
            if not result or not result.data:
                return {"success": False, "error": "Integration not found"}

            integration_id = result.data["id"]
            refresh_vault_id = result.data.get("refresh_token_vault_id")
            old_expires_at = result.data.get("token_expires_at")

            if not refresh_vault_id:
                return {"success": False, "error": "No refresh token available"}

            # Get refresh token from vault
            refresh_token = await vault_service.get_secret(refresh_vault_id)
            if not refresh_token:
                return {"success": False, "error": "Failed to retrieve refresh token"}

            # Exchange refresh token for new tokens
            tokens = await cls._refresh_tokens(config, refresh_token)

            # Store new tokens
            await cls._store_tokens(
                organization_id=organization_id,
                integration_type=config.type.value,
                access_token=tokens["access_token"],
                refresh_token=tokens.get("refresh_token", refresh_token),  # Some providers issue new refresh token
                expires_in=tokens.get("expires_in"),
                scopes=None,  # Preserve existing scopes
                metadata=None,  # Preserve existing metadata
                update_only=True,  # Don't overwrite metadata
            )

            new_expires_at = None
            if tokens.get("expires_in"):
                new_expires_at = (datetime.utcnow() + timedelta(seconds=tokens["expires_in"])).isoformat()

            # Log refresh
            await cls._log_token_refresh(
                integration_id=integration_id,
                reason=reason,
                success=True,
                old_expires_at=old_expires_at,
                new_expires_at=new_expires_at,
            )

            logger.info(f"Token refreshed for {config.type.value} (org: {organization_id})")
            return {
                "success": True,
                "expires_in": tokens.get("expires_in"),
                "new_expires_at": new_expires_at,
            }

        except Exception as e:
            logger.exception(f"Token refresh error for {config.type.value}")

            # Log failed refresh
            if "integration_id" in locals():
                await cls._log_token_refresh(
                    integration_id=integration_id,
                    reason=reason,
                    success=False,
                    error_message=str(e),
                    old_expires_at=old_expires_at if "old_expires_at" in locals() else None,
                )

            # Update integration status to expired
            if db_config.client:
                db_config.client.table("organization_integrations").update({
                    "status": "expired",
                    "last_error": f"Token refresh failed: {str(e)}",
                }).eq("organization_id", organization_id).eq(
                    "integration_type", config.type.value
                ).execute()

            return {"success": False, "error": str(e)}

    @classmethod
    async def revoke_integration(
        cls,
        config: IntegrationConfig,
        organization_id: str,
    ) -> bool:
        """
        Revoke an integration and clean up tokens.

        Args:
            config: Integration configuration
            organization_id: Organization to disconnect

        Returns:
            True if successful
        """
        try:
            if not db_config.client:
                return False

            # Get vault IDs
            result = db_config.client.table("organization_integrations").select(
                "access_token_vault_id", "refresh_token_vault_id"
            ).eq("organization_id", organization_id).eq(
                "integration_type", config.type.value
            ).maybe_single().execute()

            # maybe_single() returns None when no row found
            if result and result.data:
                # Optionally revoke token with provider
                if config.supports_revoke and config.revoke_url:
                    access_vault_id = result.data.get("access_token_vault_id")
                    if access_vault_id:
                        token = await vault_service.get_secret(access_vault_id)
                        if token:
                            await cls._revoke_token_with_provider(config, token)

                # Delete tokens from vault
                if result.data.get("access_token_vault_id"):
                    await vault_service.delete_secret(result.data["access_token_vault_id"])
                if result.data.get("refresh_token_vault_id"):
                    await vault_service.delete_secret(result.data["refresh_token_vault_id"])

            # Update status
            db_config.client.table("organization_integrations").update({
                "status": "revoked",
                "access_token_vault_id": None,
                "refresh_token_vault_id": None,
                "token_expires_at": None,
            }).eq("organization_id", organization_id).eq(
                "integration_type", config.type.value
            ).execute()

            logger.info(f"Integration revoked: {config.type.value} (org: {organization_id})")
            return True

        except Exception as e:
            logger.exception(f"Revoke error for {config.type.value}")
            return False

    @classmethod
    async def get_access_token(
        cls,
        organization_id: str,
        integration_type: str,
        auto_refresh: bool = True,
    ) -> Optional[str]:
        """
        Get access token for an integration.

        Automatically refreshes if expired and auto_refresh=True.

        Args:
            organization_id: Organization to get token for
            integration_type: Type of integration
            auto_refresh: Whether to auto-refresh expired tokens

        Returns:
            Access token string or None if not available
        """
        if not db_config.client:
            return None

        result = db_config.client.table("organization_integrations").select(
            "access_token_vault_id", "refresh_token_vault_id",
            "token_expires_at", "status"
        ).eq("organization_id", organization_id).eq(
            "integration_type", integration_type
        ).maybe_single().execute()

        # maybe_single() returns None when no row found in this supabase-py version
        if not result or not result.data or result.data["status"] != "connected":
            return None

        # Check if token needs refresh
        expires_at = result.data.get("token_expires_at")
        if expires_at:
            try:
                expiry = datetime.fromisoformat(expires_at.replace("Z", "+00:00"))
                buffer = timedelta(minutes=cls.REFRESH_BUFFER_MINUTES)
                if expiry < datetime.utcnow().replace(tzinfo=expiry.tzinfo) + buffer:
                    if auto_refresh and result.data.get("refresh_token_vault_id"):
                        config = get_integration(integration_type)
                        refresh_result = await cls.refresh_token(config, organization_id, "preemptive")
                        if refresh_result.get("success"):
                            # Get the new token
                            return await cls.get_access_token(organization_id, integration_type, False)
                    return None
            except (ValueError, TypeError):
                pass  # Invalid date format, try to use token anyway

        # Get token from vault
        vault_id = result.data.get("access_token_vault_id")
        if vault_id:
            return await vault_service.get_secret(vault_id)

        return None

    @classmethod
    async def get_integration_status(
        cls,
        organization_id: str,
        integration_type: str,
    ) -> Optional[Dict[str, Any]]:
        """
        Get status of an integration for an organization.

        Args:
            organization_id: Organization to check
            integration_type: Type of integration

        Returns:
            Integration status dict or None
        """
        if not db_config.client:
            return None

        result = db_config.client.table("organization_integrations").select(
            "id", "status", "scopes", "metadata",
            "last_error", "last_sync_at", "connected_at",
            "token_expires_at", "created_at", "updated_at"
        ).eq("organization_id", organization_id).eq(
            "integration_type", integration_type
        ).maybe_single().execute()

        # maybe_single() returns None when no row found
        if not result or not result.data:
            return None

        return result.data

    @classmethod
    async def list_organization_integrations(
        cls,
        organization_id: str,
    ) -> List[Dict[str, Any]]:
        """
        List all integrations for an organization.

        Args:
            organization_id: Organization to list integrations for

        Returns:
            List of integration status dicts
        """
        if not db_config.client:
            return []

        result = db_config.client.table("organization_integrations").select(
            "id", "integration_type", "status", "scopes", "metadata",
            "last_error", "last_sync_at", "connected_at", "token_expires_at"
        ).eq("organization_id", organization_id).execute()

        return result.data or []

    # =========================================================================
    # Private Methods
    # =========================================================================

    @classmethod
    async def _store_oauth_state(
        cls,
        organization_id: str,
        integration_type: str,
        state: str,
        user_id: Optional[str] = None,
    ) -> None:
        """Store OAuth state for CSRF protection"""
        if not db_config.client:
            raise RuntimeError("Database not configured")

        expires_at = datetime.utcnow() + timedelta(minutes=cls.STATE_EXPIRY_MINUTES)

        db_config.client.table("organization_integrations").upsert({
            "organization_id": organization_id,
            "integration_type": integration_type,
            "oauth_state": state,
            "oauth_state_expires_at": expires_at.isoformat(),
            "status": "pending",
            "connected_by": user_id,
        }, on_conflict="organization_id,integration_type").execute()

    @classmethod
    async def _validate_oauth_state(
        cls,
        organization_id: str,
        integration_type: str,
        state: str,
    ) -> bool:
        """Validate OAuth state hasn't expired"""
        if not db_config.client:
            return False

        result = db_config.client.table("organization_integrations").select(
            "oauth_state", "oauth_state_expires_at"
        ).eq("organization_id", organization_id).eq(
            "integration_type", integration_type
        ).maybe_single().execute()

        # maybe_single() returns None when no row found
        if not result or not result.data:
            return False

        stored_state = result.data.get("oauth_state")
        expires_at = result.data.get("oauth_state_expires_at")

        if stored_state != state:
            return False

        if expires_at:
            try:
                expiry = datetime.fromisoformat(expires_at.replace("Z", "+00:00"))
                if expiry < datetime.utcnow().replace(tzinfo=expiry.tzinfo):
                    return False
            except (ValueError, TypeError):
                return False

        return True

    @classmethod
    async def _store_pkce_verifier(
        cls,
        organization_id: str,
        integration_type: str,
        verifier: str,
    ) -> None:
        """Store PKCE verifier for token exchange"""
        if not db_config.client:
            return

        # Store in metadata temporarily
        db_config.client.table("organization_integrations").update({
            "metadata": {"pkce_verifier": verifier}
        }).eq("organization_id", organization_id).eq(
            "integration_type", integration_type
        ).execute()

    @classmethod
    async def _exchange_code(
        cls,
        config: IntegrationConfig,
        code: str,
        redirect_uri: str,
        organization_id: str,
    ) -> Dict[str, Any]:
        """Exchange authorization code for tokens"""
        data = {
            "grant_type": "authorization_code",
            "code": code,
            "redirect_uri": redirect_uri,
            "client_id": config.client_id,
            "client_secret": config.client_secret,
        }

        # Add PKCE verifier if used
        if config.uses_pkce and db_config.client:
            result = db_config.client.table("organization_integrations").select(
                "metadata"
            ).eq("organization_id", organization_id).eq(
                "integration_type", config.type.value
            ).maybe_single().execute()

            # maybe_single() returns None when no row found
            if result and result.data and result.data.get("metadata", {}).get("pkce_verifier"):
                data["code_verifier"] = result.data["metadata"]["pkce_verifier"]

        # Handle different auth methods
        headers = {"Content-Type": "application/x-www-form-urlencoded"}
        if config.token_endpoint_auth_method == "client_secret_basic":
            import base64
            credentials = base64.b64encode(
                f"{config.client_id}:{config.client_secret}".encode()
            ).decode()
            headers["Authorization"] = f"Basic {credentials}"
            del data["client_id"]
            del data["client_secret"]

        async with httpx.AsyncClient() as client:
            response = await client.post(
                config.token_url,
                data=data,
                headers=headers,
            )

            if response.status_code != 200:
                logger.error(f"Token exchange failed: {response.status_code} - {response.text}")
                raise RuntimeError(f"Token exchange failed: {response.status_code}")

            return response.json()

    @classmethod
    async def _refresh_tokens(
        cls,
        config: IntegrationConfig,
        refresh_token: str,
    ) -> Dict[str, Any]:
        """Exchange refresh token for new tokens"""
        data = {
            "grant_type": "refresh_token",
            "refresh_token": refresh_token,
            "client_id": config.client_id,
            "client_secret": config.client_secret,
        }

        headers = {"Content-Type": "application/x-www-form-urlencoded"}
        if config.token_endpoint_auth_method == "client_secret_basic":
            import base64
            credentials = base64.b64encode(
                f"{config.client_id}:{config.client_secret}".encode()
            ).decode()
            headers["Authorization"] = f"Basic {credentials}"
            del data["client_id"]
            del data["client_secret"]

        async with httpx.AsyncClient() as client:
            response = await client.post(
                config.token_url,
                data=data,
                headers=headers,
            )

            if response.status_code != 200:
                logger.error(f"Token refresh failed: {response.status_code} - {response.text}")
                raise RuntimeError(f"Token refresh failed: {response.status_code}")

            return response.json()

    @classmethod
    async def _store_tokens(
        cls,
        organization_id: str,
        integration_type: str,
        access_token: str,
        refresh_token: Optional[str],
        expires_in: Optional[int],
        scopes: Optional[List[str]],
        metadata: Optional[Dict[str, Any]],
        update_only: bool = False,
    ) -> None:
        """Store tokens securely in Vault"""
        logger.info(f"Storing tokens for {integration_type} (org: {organization_id})")

        # Store access token in vault
        access_vault_id = await vault_service.store_secret(
            name=f"integration_{organization_id}_{integration_type}_access",
            secret=access_token,
            description=f"{integration_type} access token for org {organization_id}",
        )

        # Store refresh token if provided
        refresh_vault_id = None
        if refresh_token:
            refresh_vault_id = await vault_service.store_secret(
                name=f"integration_{organization_id}_{integration_type}_refresh",
                secret=refresh_token,
                description=f"{integration_type} refresh token for org {organization_id}",
            )

        # Calculate token expiration
        token_expires_at = None
        if expires_in:
            token_expires_at = (datetime.utcnow() + timedelta(seconds=expires_in)).isoformat()

        # Build update data
        update_data = {
            "organization_id": organization_id,
            "integration_type": integration_type,
            "access_token_vault_id": access_vault_id,
            "token_expires_at": token_expires_at,
            "status": "connected",
            "connected_at": datetime.utcnow().isoformat(),
            "oauth_state": None,  # Clear state after successful auth
            "last_error": None,
        }

        if refresh_vault_id:
            update_data["refresh_token_vault_id"] = refresh_vault_id

        if not update_only:
            if scopes is not None:
                update_data["scopes"] = scopes
            if metadata is not None:
                update_data["metadata"] = metadata

        # Upsert to database
        if db_config.client:
            db_config.client.table("organization_integrations").upsert(
                update_data,
                on_conflict="organization_id,integration_type"
            ).execute()

    @classmethod
    async def _revoke_token_with_provider(
        cls,
        config: IntegrationConfig,
        token: str,
    ) -> None:
        """Revoke token with the OAuth provider"""
        if not config.revoke_url:
            return

        try:
            async with httpx.AsyncClient() as client:
                await client.post(
                    config.revoke_url,
                    data={"token": token},
                    headers={"Content-Type": "application/x-www-form-urlencoded"},
                )
        except Exception as e:
            logger.warning(f"Failed to revoke token with provider: {e}")

    @classmethod
    async def _log_token_refresh(
        cls,
        integration_id: str,
        reason: str,
        success: bool,
        error_message: Optional[str] = None,
        old_expires_at: Optional[str] = None,
        new_expires_at: Optional[str] = None,
    ) -> None:
        """Log token refresh for audit"""
        if not db_config.client:
            return

        try:
            db_config.client.table("integration_token_refreshes").insert({
                "integration_id": integration_id,
                "refresh_reason": reason,
                "success": success,
                "error_message": error_message,
                "old_token_expires_at": old_expires_at,
                "new_token_expires_at": new_expires_at,
            }).execute()
        except Exception as e:
            logger.warning(f"Failed to log token refresh: {e}")
