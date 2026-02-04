"""
Integrations Router

Generic OAuth2 router for all integrations.
One router handles all providers using the integration registry.
"""

from fastapi import APIRouter, Query, Request, HTTPException
from fastapi.responses import RedirectResponse
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
import logging
import os

# Frontend URL for OAuth redirects
FRONTEND_URL = os.getenv("APP_URL", "http://localhost:5173")

from ..services.integrations.registry import (
    get_integration,
    list_integrations as list_registry_integrations,
    INTEGRATION_REGISTRY,
)
from ..services.integrations.oauth_manager import OAuthManager
from ..config.database import db_config

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/integrations", tags=["integrations"])


# =============================================================================
# Response Models
# =============================================================================

class IntegrationInfo(BaseModel):
    """Information about an available integration"""
    id: str
    name: str
    description: str
    icon: str
    configured: bool
    scope_presets: List[str]
    features: Dict[str, bool]


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

@router.get("/", response_model=List[IntegrationInfo])
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
        return {
            "id": integration,
            "type": config.type.value,
            "name": config.display_name,
            "description": config.description,
            "icon": config.icon,
            "configured": config.is_configured,
            "scope_presets": list(config.scopes.keys()),
            "default_scope_preset": config.default_scope_preset,
            "features": {
                "refresh": config.supports_refresh,
                "revoke": config.supports_revoke,
                "pkce": config.uses_pkce,
            },
        }
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
# Organization Integration Status
# =============================================================================

@router.get("/{integration}/status", response_model=Optional[IntegrationStatus])
async def get_integration_status(
    integration: str,
    organization_id: str = Query(..., description="Organization ID"),
):
    """
    Get the status of an integration for an organization.

    Returns connection status, granted scopes, metadata, and any errors.
    """
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
):
    """
    Get status of all integrations for an organization.

    Returns a dict mapping integration type to status.
    Useful for displaying integration cards in settings UI.
    """
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
):
    """
    Manually refresh an integration's access token.

    Normally tokens are refreshed automatically, but this endpoint
    allows manual refresh for debugging or recovery.
    """
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
):
    """
    Disconnect an integration and revoke tokens.

    This will:
    1. Revoke the token with the provider (if supported)
    2. Delete tokens from Vault
    3. Update integration status to 'revoked'
    """
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
):
    """
    Test an integration connection by making a simple API call.

    Returns success status and user/account info if available.
    """
    try:
        config = get_integration(integration)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

    # Get access token
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
