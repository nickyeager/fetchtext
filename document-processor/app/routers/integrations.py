"""
Integrations Router

Generic OAuth2 router for all integrations.
One router handles all providers using the integration registry.
"""

from fastapi import APIRouter, Query, Request, HTTPException, Depends
from fastapi.responses import RedirectResponse
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
import logging
import os

# Frontend URL for OAuth redirects
FRONTEND_URL = os.getenv("APP_URL", "")

if not FRONTEND_URL:
    logging.warning("APP_URL environment variable not set - OAuth redirects will fail")

from ..services.integrations.registry import (
    get_integration,
    list_integrations as list_registry_integrations,
    INTEGRATION_REGISTRY,
)
from ..services.integrations.oauth_manager import OAuthManager
from ..services.vault_service import vault_service
from ..config.database import db_config
from ..middleware.admin_auth import admin_auth
from datetime import datetime

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/integrations", tags=["integrations"])


# =============================================================================
# Response Models
# =============================================================================

class CredentialField(BaseModel):
    """Definition of a credential field for non-OAuth integrations"""
    name: str
    label: str
    type: str  # text, password, textarea
    required: str = "true"
    placeholder: Optional[str] = None
    help: Optional[str] = None


class IntegrationInfo(BaseModel):
    """Information about an available integration"""
    id: str
    name: str
    description: str
    icon: str
    configured: bool
    auth_mode: str = "oauth"
    auth_modes: Optional[List[str]] = None  # For dual-mode integrations: ["credential", "oauth"]
    credential_fields: Optional[List[CredentialField]] = None
    scope_presets: List[str]
    features: Dict[str, bool]


class CredentialConnectRequest(BaseModel):
    """Request to connect an integration using credentials"""
    organization_id: str
    credentials: Dict[str, str]
    user_id: Optional[str] = None


class PerAccountOAuthInitiateRequest(BaseModel):
    """Request to initiate OAuth for a per-account provider (e.g., Snowflake)"""
    organization_id: str
    account_identifier: str  # e.g., "uzdboxw-snb92059"
    client_id: str           # from DESCRIBE INTEGRATION in Snowflake
    client_secret: str       # from DESCRIBE INTEGRATION in Snowflake
    redirect_uri: str


class IntegrationStatus(BaseModel):
    """Status of an organization's integration"""
    id: Optional[str] = None
    integration_type: str
    status: str  # pending, connected, expired, revoked, error
    scopes: List[str] = []
    metadata: Dict[str, Any] = {}
    last_error: Optional[str] = None
    last_sync_at: Optional[str] = None
    connected_at: Optional[str] = None
    token_expires_at: Optional[str] = None


class OAuthInitiateResponse(BaseModel):
    """Response from OAuth initiation"""
    authorization_url: str
    state: str


class OAuthCallbackResult(BaseModel):
    """Result of OAuth callback handling"""
    success: bool
    error: Optional[str] = None
    integration_type: str
    organization_id: str


class TokenRefreshResult(BaseModel):
    """Result of token refresh"""
    success: bool
    error: Optional[str] = None
    expires_in: Optional[int] = None
    new_expires_at: Optional[str] = None


# =============================================================================
# List Available Integrations
# =============================================================================

@router.get("", response_model=List[IntegrationInfo])
async def list_available_integrations(
    configured_only: bool = Query(False, description="Only show integrations with credentials configured"),
):
    """
    List all available integrations.

    Returns information about each integration including:
    - Display name and description
    - Whether credentials are configured
    - Available scope presets
    - Supported features (refresh, revoke)
    """
    return list_registry_integrations(configured_only=configured_only)


@router.get("/{integration}")
async def get_integration_info(integration: str):
    """
    Get detailed information about a specific integration.
    """
    try:
        config = get_integration(integration)
        result = {
            "id": integration,
            "type": config.type.value,
            "name": config.display_name,
            "description": config.description,
            "icon": config.icon,
            "configured": config.is_configured,
            "auth_mode": config.auth_mode,
            "scope_presets": list(config.scopes.keys()),
            "default_scope_preset": config.default_scope_preset,
            "features": {
                "refresh": config.supports_refresh,
                "revoke": config.supports_revoke,
                "pkce": config.uses_pkce,
            },
        }
        if config.auth_mode in ("credential", "dual") and config.credential_fields:
            result["credential_fields"] = config.credential_fields
        if config.auth_mode == "dual":
            result["auth_modes"] = ["credential", "oauth"]
        return result
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


# =============================================================================
# OAuth Flow
# =============================================================================

@router.get("/{integration}/oauth/initiate", response_model=OAuthInitiateResponse)
async def initiate_oauth(
    integration: str,
    organization_id: str = Query(..., description="Organization ID"),
    redirect_uri: str = Query(..., description="OAuth callback URL"),
    scope_preset: Optional[str] = Query(None, description="Scope preset to request"),
    user_id: Optional[str] = Query(None, description="User initiating the connection"),
    current_user: dict = Depends(admin_auth.get_current_user),
):
    """
    Initiate OAuth flow for an integration.

    Returns an authorization URL to redirect the user to.
    The state parameter should be preserved for CSRF protection.
    """
    try:
        config = get_integration(integration)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

    await admin_auth.verify_org_membership(current_user["user_id"], organization_id)

    if not config.is_configured:
        raise HTTPException(
            status_code=400,
            detail=f"Integration '{integration}' is not configured. Set {config.client_id_env} and {config.client_secret_env} environment variables.",
        )

    auth_url, state = await OAuthManager.initiate_flow(
        config=config,
        organization_id=organization_id,
        redirect_uri=redirect_uri,
        scope_preset=scope_preset,
        user_id=user_id,
    )

    return OAuthInitiateResponse(authorization_url=auth_url, state=state)


@router.get("/{integration}/oauth/callback")
async def oauth_callback(
    integration: str,
    request: Request,
    code: str = Query(..., description="Authorization code"),
    state: str = Query(..., description="State for CSRF validation"),
    error: Optional[str] = Query(None, description="Error from provider"),
    error_description: Optional[str] = Query(None, description="Error description"),
):
    """
    Handle OAuth callback from provider.

    This endpoint is called by the OAuth provider after user authorization.
    It exchanges the authorization code for tokens and stores them.

    On success, redirects to /settings/integrations?success=true
    On error, redirects to /settings/integrations?error=...
    """
    # Handle error from provider
    if error:
        error_msg = error_description or error
        logger.warning(f"OAuth error from {integration}: {error_msg}")
        return RedirectResponse(
            f"{FRONTEND_URL}/settings/integrations?error={error_msg}&provider={integration}"
        )

    try:
        config = get_integration(integration)
    except ValueError as e:
        return RedirectResponse(f"{FRONTEND_URL}/settings/integrations?error={str(e)}")

    # Extract extra callback params (e.g., realmId for QuickBooks)
    extra_metadata = {}
    if config.extra_callback_params:
        for param in config.extra_callback_params:
            value = request.query_params.get(param)
            if value:
                extra_metadata[param] = value

    # Parse organization_id from state
    try:
        parts = state.split(":")
        if len(parts) >= 1:
            organization_id = parts[0]
        else:
            raise ValueError("Invalid state format")
    except Exception:
        return RedirectResponse(f"{FRONTEND_URL}/settings/integrations?error=Invalid state&provider={integration}")

    # Build redirect URI (same as what was used in initiate)
    redirect_uri = str(request.url).split("?")[0]

    # Handle the callback
    success, error_msg = await OAuthManager.handle_callback(
        config=config,
        code=code,
        state=state,
        redirect_uri=redirect_uri,
        extra_metadata=extra_metadata,
    )

    if success:
        return RedirectResponse(f"{FRONTEND_URL}/settings/integrations?success=true&provider={integration}")
    else:
        return RedirectResponse(f"{FRONTEND_URL}/settings/integrations?error={error_msg}&provider={integration}")


# =============================================================================
# Per-Account OAuth Flow (for Snowflake and similar per-tenant providers)
# =============================================================================

@router.post("/{integration}/oauth/initiate-with-account", response_model=OAuthInitiateResponse)
async def initiate_oauth_with_account(
    integration: str,
    request: PerAccountOAuthInitiateRequest,
    current_user: dict = Depends(admin_auth.get_current_user),
):
    """
    Initiate OAuth flow for a per-account provider like Snowflake.

    Unlike standard OAuth where client_id/secret come from env vars,
    per-account OAuth requires the customer to provide their own
    client_id and client_secret from their Snowflake Security Integration.

    The customer's Snowflake admin must first create a Security Integration:
        CREATE SECURITY INTEGRATION fetchtext_oauth
          TYPE = OAUTH ENABLED = TRUE OAUTH_CLIENT = CUSTOM ...

    Then run DESCRIBE INTEGRATION to get client_id and client_secret.
    """
    try:
        config = get_integration(integration)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

    await admin_auth.verify_org_membership(current_user["user_id"], request.organization_id)

    if config.auth_mode not in ("oauth", "dual"):
        raise HTTPException(
            status_code=400,
            detail=f"Integration '{integration}' does not support OAuth.",
        )

    if not config.auth_url_template:
        raise HTTPException(
            status_code=400,
            detail=f"Integration '{integration}' does not support per-account OAuth.",
        )

    try:
        # Store client_id and client_secret in Vault (needed for token exchange during callback)
        client_id_vault_id = await vault_service.store_secret(
            name=f"integration_{request.organization_id}_{integration}_oauth_client_id",
            secret=request.client_id,
            description=f"{integration} OAuth client_id for org {request.organization_id}",
        )
        client_secret_vault_id = await vault_service.store_secret(
            name=f"integration_{request.organization_id}_{integration}_oauth_client_secret",
            secret=request.client_secret,
            description=f"{integration} OAuth client_secret for org {request.organization_id}",
        )

        if not client_id_vault_id or not client_secret_vault_id:
            raise HTTPException(status_code=500, detail="Failed to store OAuth credentials securely")

        # Initiate the flow with per-account URLs
        auth_url, state = await OAuthManager.initiate_flow_with_account(
            config=config,
            organization_id=request.organization_id,
            account=request.account_identifier,
            client_id=request.client_id,
            redirect_uri=request.redirect_uri,
        )

        # Store account identifier and vault IDs in metadata for the callback
        if db_config.client:
            db_config.client.table("organization_integrations").upsert(
                {
                    "organization_id": request.organization_id,
                    "integration_type": integration,
                    "metadata": {
                        "account_identifier": request.account_identifier,
                        "oauth_client_id_vault_id": client_id_vault_id,
                        "oauth_client_secret_vault_id": client_secret_vault_id,
                        "auth_method": "oauth",
                    },
                },
                on_conflict="organization_id,integration_type",
            ).execute()

        return OAuthInitiateResponse(authorization_url=auth_url, state=state)

    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Failed to initiate per-account OAuth for {integration}")
        error_msg = str(e)
        if "foreign key" in error_msg.lower() or "23503" in error_msg:
            raise HTTPException(
                status_code=400,
                detail=f"Organization '{request.organization_id}' not found. Create the organization first.",
            )
        raise HTTPException(status_code=500, detail=f"Failed to initiate OAuth: {error_msg}")


# =============================================================================
# Credential-Based Connection
# =============================================================================

@router.post("/{integration}/connect-credentials")
async def connect_with_credentials(
    integration: str,
    request: CredentialConnectRequest,
    current_user: dict = Depends(admin_auth.get_current_user),
):
    """
    Connect an integration using direct credentials (non-OAuth).

    Used for integrations like Snowflake that use key-pair auth
    instead of OAuth flows. Stores credentials securely in Vault.
    """
    try:
        config = get_integration(integration)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

    await admin_auth.verify_org_membership(current_user["user_id"], request.organization_id)

    if config.auth_mode not in ("credential", "dual"):
        raise HTTPException(
            status_code=400,
            detail=f"Integration '{integration}' uses OAuth, not credentials. Use the OAuth flow instead.",
        )

    # Validate required fields
    required_fields = [
        f["name"] for f in config.credential_fields
        if f.get("required", "true") == "true"
    ]
    missing = [f for f in required_fields if not request.credentials.get(f)]
    if missing:
        raise HTTPException(
            status_code=422,
            detail=f"Missing required credential fields: {', '.join(missing)}",
        )

    organization_id = request.organization_id

    # Store each credential in Vault using deterministic name pattern.
    # Retrieval uses name-based lookup, so we don't need to store vault IDs.
    for field_def in config.credential_fields:
        field_name = field_def["name"]
        value = request.credentials.get(field_name)
        if not value:
            continue

        vault_key = f"integration_{organization_id}_{integration}_{field_name}"
        vault_id = await vault_service.store_secret(
            name=vault_key,
            secret=value,
            description=f"{integration} {field_name} for org {organization_id}",
        )
        if not vault_id:
            logger.error(f"Failed to store credential '{field_name}' in Vault")
            raise HTTPException(
                status_code=500,
                detail=f"Failed to store credential '{field_name}' securely",
            )

    # Build non-sensitive metadata for the integration record.
    # No vault IDs stored — retrieval uses deterministic name-based lookup.
    metadata = {
        "account_identifier": request.credentials.get("account_identifier", ""),
        "username": request.credentials.get("username", ""),
        "warehouse": request.credentials.get("warehouse", ""),
        "database": request.credentials.get("database", ""),
        "role": request.credentials.get("role", ""),
    }

    # Upsert organization_integrations row
    if not db_config.client:
        raise HTTPException(status_code=500, detail="Database not configured")

    db_config.client.table("organization_integrations").upsert(
        {
            "organization_id": organization_id,
            "integration_type": integration,
            "status": "connected",
            "connected_at": datetime.utcnow().isoformat(),
            "connected_by": request.user_id,
            "metadata": metadata,
            "last_error": None,
        },
        on_conflict="organization_id,integration_type",
    ).execute()

    logger.info(f"Snowflake credentials stored for org {organization_id}")

    return {
        "success": True,
        "message": f"{config.display_name} connected successfully",
        "metadata": {
            "account_identifier": metadata["account_identifier"],
            "username": metadata["username"],
            "warehouse": metadata["warehouse"],
        },
    }


# =============================================================================
# Organization Integration Status
# =============================================================================

@router.get("/{integration}/status", response_model=Optional[IntegrationStatus])
async def get_integration_status(
    integration: str,
    organization_id: str = Query(..., description="Organization ID"),
    current_user: dict = Depends(admin_auth.get_current_user),
):
    """
    Get the status of an integration for an organization.

    Returns connection status, granted scopes, metadata, and any errors.
    """
    await admin_auth.verify_org_membership(current_user["user_id"], organization_id)

    try:
        get_integration(integration)  # Validate integration exists
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

    status = await OAuthManager.get_integration_status(organization_id, integration)

    if not status:
        return IntegrationStatus(
            integration_type=integration,
            status="disconnected",
        )

    return IntegrationStatus(
        id=status.get("id"),
        integration_type=integration,
        status=status.get("status", "disconnected"),
        scopes=status.get("scopes", []),
        metadata=status.get("metadata", {}),
        last_error=status.get("last_error"),
        last_sync_at=status.get("last_sync_at"),
        connected_at=status.get("connected_at"),
        token_expires_at=status.get("token_expires_at"),
    )


@router.get("/status/all")
async def get_all_integration_statuses(
    organization_id: str = Query(..., description="Organization ID"),
    current_user: dict = Depends(admin_auth.get_current_user),
):
    """
    Get status of all integrations for an organization.

    Returns a dict mapping integration type to status.
    Useful for displaying integration cards in settings UI.
    """
    await admin_auth.verify_org_membership(current_user["user_id"], organization_id)
    # Get all connected integrations for org
    connected = await OAuthManager.list_organization_integrations(organization_id)
    connected_map = {i["integration_type"]: i for i in connected}

    # Build response with all available integrations
    result = {}
    for integration_id, config in INTEGRATION_REGISTRY.items():
        if integration_id in connected_map:
            status_data = connected_map[integration_id]
            result[integration_id] = {
                "status": status_data.get("status", "disconnected"),
                "scopes": status_data.get("scopes", []),
                "metadata": status_data.get("metadata", {}),
                "connected_at": status_data.get("connected_at"),
                "last_error": status_data.get("last_error"),
            }
        else:
            result[integration_id] = {
                "status": "disconnected",
                "configured": config.is_configured,
            }

    return result


# =============================================================================
# Token Management
# =============================================================================

@router.post("/{integration}/refresh", response_model=TokenRefreshResult)
async def refresh_token(
    integration: str,
    organization_id: str = Query(..., description="Organization ID"),
    current_user: dict = Depends(admin_auth.get_current_user),
):
    """
    Manually refresh an integration's access token.

    Normally tokens are refreshed automatically, but this endpoint
    allows manual refresh for debugging or recovery.
    """
    await admin_auth.verify_org_membership(current_user["user_id"], organization_id)

    try:
        config = get_integration(integration)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

    if not config.supports_refresh:
        return TokenRefreshResult(
            success=False,
            error=f"{integration} does not support token refresh",
        )

    result = await OAuthManager.refresh_token(config, organization_id, "manual")

    return TokenRefreshResult(
        success=result.get("success", False),
        error=result.get("error"),
        expires_in=result.get("expires_in"),
        new_expires_at=result.get("new_expires_at"),
    )


@router.delete("/{integration}/disconnect")
async def disconnect_integration(
    integration: str,
    organization_id: str = Query(..., description="Organization ID"),
    current_user: dict = Depends(admin_auth.get_current_user),
):
    """
    Disconnect an integration and revoke tokens.

    This will:
    1. Revoke the token with the provider (if supported)
    2. Delete tokens from Vault
    3. Update integration status to 'revoked'
    """
    await admin_auth.verify_org_membership(current_user["user_id"], organization_id)

    try:
        config = get_integration(integration)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

    success = await OAuthManager.revoke_integration(config, organization_id)

    if success:
        return {"success": True, "message": f"{config.display_name} disconnected"}
    else:
        raise HTTPException(status_code=500, detail="Failed to disconnect integration")


# =============================================================================
# Connection Testing
# =============================================================================

@router.get("/{integration}/test")
async def test_connection(
    integration: str,
    organization_id: str = Query(..., description="Organization ID"),
    current_user: dict = Depends(admin_auth.get_current_user),
):
    """
    Test an integration connection by making a simple API call.

    Returns success status and user/account info if available.
    """
    await admin_auth.verify_org_membership(current_user["user_id"], organization_id)

    try:
        config = get_integration(integration)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

    # Handle credential-based integrations (e.g., Snowflake key-pair)
    # For dual-mode integrations, check if this org used credentials or OAuth
    if config.auth_mode in ("credential", "dual"):
        try:
            if integration == "snowflake":
                from ..services.snowflake_service import snowflake_service
                result = await snowflake_service.test_connection(organization_id)
                return result
            else:
                return {
                    "success": False,
                    "message": f"No test handler for credential integration '{integration}'",
                }
        except ImportError:
            return {
                "success": False,
                "message": "Snowflake service not available",
            }
        except Exception as e:
            logger.exception(f"Connection test failed for {integration}")
            return {
                "success": False,
                "message": f"Connection test failed: {str(e)}",
            }

    # Get access token (OAuth integrations)
    token = await OAuthManager.get_access_token(organization_id, integration)
    if not token:
        return {
            "success": False,
            "message": f"{config.display_name} is not connected",
        }

    # Test based on integration type
    try:
        if config.userinfo_url:
            import httpx
            async with httpx.AsyncClient() as client:
                # Google tokeninfo uses query param, others use Authorization header
                if "tokeninfo" in config.userinfo_url:
                    response = await client.get(
                        f"{config.userinfo_url}?access_token={token}",
                    )
                else:
                    response = await client.get(
                        config.userinfo_url,
                        headers={"Authorization": f"Bearer {token}"},
                    )
                if response.status_code == 200:
                    user_info = response.json()
                    # Extract display name based on provider
                    scope_info = user_info.get("scope", "").split()[0] if user_info.get("scope") else None
                    display_name = (
                        user_info.get("name") or
                        user_info.get("displayName") or
                        user_info.get("email") or
                        user_info.get("userPrincipalName") or
                        scope_info or
                        "Connected"
                    )
                    return {
                        "success": True,
                        "message": f"Connected as {display_name}",
                        "user_info": user_info,
                    }
                else:
                    return {
                        "success": False,
                        "message": f"API returned {response.status_code}",
                    }
        else:
            # No userinfo URL - just verify token exists
            return {
                "success": True,
                "message": f"{config.display_name} connected",
            }
    except Exception as e:
        logger.exception(f"Connection test failed for {integration}")
        return {
            "success": False,
            "message": f"Connection test failed: {str(e)}",
        }


# =============================================================================
# Token Expiry Endpoint (for N8N workflow)
# =============================================================================

@router.get("/expiring-tokens")
async def get_expiring_tokens(
    minutes: int = Query(30, description="Minutes until expiry threshold"),
    current_user: dict = Depends(admin_auth.get_current_user),
):
    """
    Get all tokens expiring within the specified time.

    Used by N8N token refresh workflow to preemptively refresh tokens.
    """
    if not db_config.client:
        return {"tokens": []}

    result = db_config.client.rpc(
        "get_expiring_integration_tokens",
        {"minutes_until_expiry": minutes}
    ).execute()

    return {"tokens": result.data or []}
