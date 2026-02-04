"""
API Key Management Router (Admin)

Provides endpoints for managing API keys through the admin dashboard.
These endpoints are intended for authenticated users managing their organization's API keys.

Note: These endpoints use internal Supabase authentication (via the dashboard),
not the third-party API key authentication.
"""

import secrets
import hashlib
import logging
import sys
from datetime import datetime, timedelta
from typing import Optional, List, Dict, Any

from fastapi import APIRouter, HTTPException, Query, Depends, Header
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from ..config.database import db_config
from ..middleware.admin_auth import admin_auth

# Safe logger initialization
try:
    logger = logging.getLogger(__name__)
    if not logger.handlers:
        handler = logging.StreamHandler(sys.stdout)
        handler.setFormatter(logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s'))
        logger.addHandler(handler)
        logger.setLevel(logging.INFO)
except Exception:
    logging.basicConfig(stream=sys.stdout, level=logging.INFO)
    logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/admin/keys", tags=["API Key Management (Admin)"])


# ============================================================================
# PYDANTIC MODELS
# ============================================================================

class CreateAPIKeyRequest(BaseModel):
    """Request body for creating a new API key."""
    name: str = Field(..., min_length=1, max_length=100, description="Friendly name for the API key")
    organization_id: str = Field(..., description="Organization UUID")
    description: Optional[str] = Field(None, max_length=500, description="Optional description")
    expires_in_days: int = Field(365, ge=1, le=3650, description="Days until expiration (max 10 years)")
    rate_limit_per_minute: int = Field(60, ge=1, le=1000, description="Requests per minute limit")
    upload_limit_per_minute: int = Field(10, ge=1, le=100, description="Uploads per minute limit")
    permissions: Optional[dict] = Field(
        None,
        description="Custom permissions (default: upload, process, templates_read)"
    )


class UpdateAPIKeyRequest(BaseModel):
    """Request body for updating an API key."""
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    description: Optional[str] = Field(None, max_length=500)
    rate_limit_per_minute: Optional[int] = Field(None, ge=1, le=1000)
    upload_limit_per_minute: Optional[int] = Field(None, ge=1, le=100)
    is_active: Optional[bool] = Field(None)
    permissions: Optional[dict] = Field(None)


class APIKeyResponse(BaseModel):
    """Response model for API key (excludes the actual key after creation)."""
    id: str
    name: str
    description: Optional[str]
    key_prefix: str
    organization_id: str
    is_active: bool
    rate_limit_per_minute: int
    upload_limit_per_minute: int
    permissions: dict
    created_at: str
    expires_at: Optional[str]
    last_used_at: Optional[str]


class APIKeyCreatedResponse(APIKeyResponse):
    """Response model for newly created API key (includes the full key once)."""
    api_key: str  # Only shown on creation!
    warning: str = "Save this API key - it will never be shown again!"


# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

def generate_api_key() -> tuple[str, str, str]:
    """
    Generate a new API key.

    Returns:
        Tuple of (full_key, key_hash, key_prefix)
    """
    # Generate 32 bytes of random data, URL-safe base64 encoded
    random_part = secrets.token_urlsafe(32)
    full_key = f"ftxt_{random_part}"

    # Hash the key for storage
    key_hash = hashlib.sha256(full_key.encode()).hexdigest()

    # Keep prefix for identification (first 12 chars)
    key_prefix = full_key[:12]

    return full_key, key_hash, key_prefix


# ============================================================================
# API ENDPOINTS
# ============================================================================

# Constants for error messages
DB_NOT_AVAILABLE = "Database not available"
API_KEY_NOT_FOUND = "API key not found"


async def get_authenticated_user(
    authorization: Optional[str] = Header(None, alias="Authorization")
) -> Dict[str, Any]:
    """Dependency to get authenticated user from JWT token."""
    return await admin_auth.get_current_user(authorization)


async def verify_org_access(
    organization_id: str,
    user: Dict[str, Any] = Depends(get_authenticated_user)
) -> Dict[str, Any]:
    """Dependency to verify user has access to the organization."""
    await admin_auth.verify_org_membership(user['user_id'], organization_id)
    return {**user, 'organization_id': organization_id}


async def verify_key_access(
    key_id: str,
    authorization: Optional[str]
) -> Dict[str, Any]:
    """
    Helper to authenticate user and verify they have access to the API key's organization.

    Returns user info with organization_id from the key.
    """
    user = await admin_auth.get_current_user(authorization)

    if not db_config.client:
        raise HTTPException(status_code=503, detail=DB_NOT_AVAILABLE)

    # Get the key's organization
    key_check = db_config.client.table('api_keys').select(
        'organization_id'
    ).eq('id', key_id).single().execute()

    if not key_check.data:
        raise HTTPException(status_code=404, detail=API_KEY_NOT_FOUND)

    # Verify user has access to this organization
    await admin_auth.verify_org_membership(user['user_id'], key_check.data['organization_id'])

    return {**user, 'organization_id': key_check.data['organization_id']}


@router.post("/create", response_model=APIKeyCreatedResponse)
async def create_api_key(
    request: CreateAPIKeyRequest,
    authorization: Optional[str] = Header(None, alias="Authorization")
):
    """
    Create a new API key for an organization.

    **Requires**: Valid Supabase JWT token and organization membership.

    **Important**: The full API key is only returned once during creation.
    Store it securely - it cannot be retrieved later.

    **Default Permissions**:
    - `upload`: true - Can upload documents
    - `process`: true - Can process documents
    - `templates_read`: true - Can list templates

    **Returns**: API key details including the full key (shown only once)
    """
    # Authenticate user and verify org access
    user = await admin_auth.get_current_user(authorization)
    await admin_auth.verify_org_membership(user['user_id'], request.organization_id)

    if not db_config.client:
        raise HTTPException(status_code=503, detail=DB_NOT_AVAILABLE)

    # Generate API key
    full_key, key_hash, key_prefix = generate_api_key()

    # Calculate expiration
    expires_at = datetime.utcnow() + timedelta(days=request.expires_in_days)

    # Set default permissions if not provided
    permissions = request.permissions or {
        'upload': True,
        'process': True,
        'templates_read': True
    }

    try:
        result = db_config.client.table('api_keys').insert({
            'organization_id': request.organization_id,
            'name': request.name,
            'description': request.description,
            'key_hash': key_hash,
            'key_prefix': key_prefix,
            'rate_limit_per_minute': request.rate_limit_per_minute,
            'upload_limit_per_minute': request.upload_limit_per_minute,
            'permissions': permissions,
            'expires_at': expires_at.isoformat(),
            'is_active': True
        }).execute()

        if not result.data:
            raise HTTPException(status_code=500, detail="Failed to create API key")

        created = result.data[0]

        logger.info(f"API key created: {request.name} ({key_prefix}...) for org {request.organization_id}")

        return JSONResponse(
            content={
                'id': created['id'],
                'name': created['name'],
                'description': created.get('description'),
                'key_prefix': key_prefix,
                'api_key': full_key,  # Only shown once!
                'organization_id': created['organization_id'],
                'is_active': created['is_active'],
                'rate_limit_per_minute': created['rate_limit_per_minute'],
                'upload_limit_per_minute': created['upload_limit_per_minute'],
                'permissions': created['permissions'],
                'created_at': created['created_at'],
                'expires_at': created['expires_at'],
                'last_used_at': None,
                'warning': 'Save this API key now - it will never be shown again!'
            },
            status_code=201
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to create API key: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to create API key: {str(e)}")


@router.get("/list/{organization_id}")
async def list_api_keys(
    organization_id: str,
    include_inactive: bool = Query(False, description="Include inactive/revoked keys"),
    authorization: Optional[str] = Header(None, alias="Authorization")
):
    """
    List all API keys for an organization.

    **Requires**: Valid Supabase JWT token and organization membership.

    **Note**: Actual API keys are never returned - only the prefix for identification.

    **Returns**: List of API keys with metadata (without the actual keys)
    """
    # Authenticate user and verify org access
    user = await admin_auth.get_current_user(authorization)
    await admin_auth.verify_org_membership(user['user_id'], organization_id)

    if not db_config.client:
        raise HTTPException(status_code=503, detail=DB_NOT_AVAILABLE)

    try:
        query = db_config.client.table('api_keys').select(
            'id, name, description, key_prefix, organization_id, is_active, '
            'rate_limit_per_minute, upload_limit_per_minute, permissions, '
            'created_at, expires_at, last_used_at'
        ).eq('organization_id', organization_id).order('created_at', desc=True)

        if not include_inactive:
            query = query.eq('is_active', True)

        result = query.execute()

        keys = result.data or []

        # Add status information
        now = datetime.utcnow()
        for key in keys:
            if not key['is_active']:
                key['status'] = 'revoked'
            elif key.get('expires_at'):
                expires_at = datetime.fromisoformat(key['expires_at'].replace('Z', '+00:00'))
                if now.replace(tzinfo=expires_at.tzinfo) > expires_at:
                    key['status'] = 'expired'
                else:
                    key['status'] = 'active'
            else:
                key['status'] = 'active'

        return JSONResponse(content={
            'keys': keys,
            'count': len(keys),
            'organization_id': organization_id
        })

    except Exception as e:
        logger.error(f"Failed to list API keys: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve API keys")


@router.get("/{key_id}")
async def get_api_key(
    key_id: str,
    authorization: Optional[str] = Header(None, alias="Authorization")
):
    """
    Get details of a specific API key.

    **Requires**: Valid Supabase JWT token and organization membership.

    **Note**: The actual API key is never returned.
    """
    # Authenticate and verify access
    await verify_key_access(key_id, authorization)

    try:
        result = db_config.client.table('api_keys').select(
            'id, name, description, key_prefix, organization_id, is_active, '
            'rate_limit_per_minute, upload_limit_per_minute, permissions, '
            'created_at, expires_at, last_used_at'
        ).eq('id', key_id).single().execute()

        if not result.data:
            raise HTTPException(status_code=404, detail="API key not found")

        return JSONResponse(content=result.data)

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get API key: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve API key")


@router.patch("/{key_id}")
async def update_api_key(
    key_id: str,
    request: UpdateAPIKeyRequest,
    authorization: Optional[str] = Header(None, alias="Authorization")
):
    """
    Update an API key's settings.

    **Requires**: Valid Supabase JWT token and organization membership.

    **Updatable fields**:
    - name
    - description
    - rate_limit_per_minute
    - upload_limit_per_minute
    - is_active (use DELETE /revoke for permanent revocation)
    - permissions
    """
    # Authenticate and verify access
    await verify_key_access(key_id, authorization)

    # Build update data from non-None fields
    update_data = {}
    if request.name is not None:
        update_data['name'] = request.name
    if request.description is not None:
        update_data['description'] = request.description
    if request.rate_limit_per_minute is not None:
        update_data['rate_limit_per_minute'] = request.rate_limit_per_minute
    if request.upload_limit_per_minute is not None:
        update_data['upload_limit_per_minute'] = request.upload_limit_per_minute
    if request.is_active is not None:
        update_data['is_active'] = request.is_active
    if request.permissions is not None:
        update_data['permissions'] = request.permissions

    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")

    try:
        result = db_config.client.table('api_keys').update(
            update_data
        ).eq('id', key_id).execute()

        if not result.data:
            raise HTTPException(status_code=404, detail=API_KEY_NOT_FOUND)

        logger.info(f"API key updated: {key_id}")

        return JSONResponse(content={
            'message': 'API key updated successfully',
            'updated_fields': list(update_data.keys())
        })

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to update API key: {e}")
        raise HTTPException(status_code=500, detail="Failed to update API key")


@router.delete("/{key_id}/revoke")
async def revoke_api_key(
    key_id: str,
    authorization: Optional[str] = Header(None, alias="Authorization")
):
    """
    Revoke (permanently deactivate) an API key.

    **Requires**: Valid Supabase JWT token and organization membership.

    This action cannot be undone. The key will immediately stop working.
    """
    # Authenticate and verify access
    await verify_key_access(key_id, authorization)

    try:
        result = db_config.client.table('api_keys').update({
            'is_active': False
        }).eq('id', key_id).execute()

        if not result.data:
            raise HTTPException(status_code=404, detail=API_KEY_NOT_FOUND)

        logger.info(f"API key revoked: {key_id}")

        return JSONResponse(content={
            'message': 'API key revoked successfully',
            'key_id': key_id
        })

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to revoke API key: {e}")
        raise HTTPException(status_code=500, detail="Failed to revoke API key")


@router.delete("/{key_id}")
async def delete_api_key(
    key_id: str,
    authorization: Optional[str] = Header(None, alias="Authorization")
):
    """
    Permanently delete an API key.

    **Requires**: Valid Supabase JWT token and organization membership.

    **Warning**: This action cannot be undone. All associated rate limit data
    and webhook logs will also be deleted.

    Consider using /revoke instead to preserve audit history.
    """
    # Authenticate and verify access
    await verify_key_access(key_id, authorization)

    try:
        result = db_config.client.table('api_keys').delete().eq('id', key_id).execute()

        if not result.data:
            raise HTTPException(status_code=404, detail=API_KEY_NOT_FOUND)

        logger.info(f"API key deleted: {key_id}")

        return JSONResponse(content={
            'message': 'API key deleted permanently',
            'key_id': key_id
        })

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to delete API key: {e}")
        raise HTTPException(status_code=500, detail="Failed to delete API key")


@router.get("/{key_id}/usage")
async def get_api_key_usage(
    key_id: str,
    days: int = Query(7, ge=1, le=90, description="Number of days to look back"),
    authorization: Optional[str] = Header(None, alias="Authorization")
):
    """
    Get usage statistics for an API key.

    **Requires**: Valid Supabase JWT token and organization membership.

    **Returns**:
    - Total requests in period
    - Total jobs created
    - Success/failure rates
    - Recent jobs
    """
    # Authenticate and verify access
    await verify_key_access(key_id, authorization)

    try:
        # Get key info
        key_result = db_config.client.table('api_keys').select(
            'id, name, key_prefix, last_used_at'
        ).eq('id', key_id).single().execute()

        if not key_result.data:
            raise HTTPException(status_code=404, detail=API_KEY_NOT_FOUND)

        # Get jobs for this key
        since = (datetime.utcnow() - timedelta(days=days)).isoformat()

        jobs_result = db_config.client.table('api_jobs').select(
            'id, status, job_type, created_at, completed_at, processing_time_ms'
        ).eq('api_key_id', key_id).gte('created_at', since).order(
            'created_at', desc=True
        ).limit(100).execute()

        jobs = jobs_result.data or []

        # Calculate statistics
        total_jobs = len(jobs)
        completed = sum(1 for j in jobs if j['status'] == 'completed')
        failed = sum(1 for j in jobs if j['status'] == 'failed')
        pending = sum(1 for j in jobs if j['status'] in ('pending', 'processing'))

        avg_processing_time = None
        if completed > 0:
            times = [j['processing_time_ms'] for j in jobs if j.get('processing_time_ms')]
            if times:
                avg_processing_time = sum(times) / len(times)

        return JSONResponse(content={
            'key_id': key_id,
            'key_name': key_result.data['name'],
            'key_prefix': key_result.data['key_prefix'],
            'last_used_at': key_result.data.get('last_used_at'),
            'period_days': days,
            'statistics': {
                'total_jobs': total_jobs,
                'completed': completed,
                'failed': failed,
                'pending': pending,
                'success_rate': (completed / total_jobs * 100) if total_jobs > 0 else 0,
                'avg_processing_time_ms': avg_processing_time
            },
            'recent_jobs': jobs[:10]  # Last 10 jobs
        })

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get API key usage: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve usage statistics")
