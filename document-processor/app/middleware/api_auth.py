"""
API Authentication Middleware for Third-Party Access

Provides API key validation and rate limiting for external integrations.
API keys are prefixed with 'ftxt_' and stored as SHA-256 hashes.
"""

import hashlib
import logging
import sys
from datetime import datetime, timedelta
from typing import Dict, Any, Optional, Tuple

from fastapi import HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from ..config.database import db_config

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

# Security scheme for OpenAPI documentation
security = HTTPBearer(
    scheme_name="APIKey",
    description="API key starting with 'ftxt_'. Example: ftxt_abc123def456..."
)


class APIKeyAuth:
    """
    API Key authentication and rate limiting for third-party API access.

    Usage:
        @router.post("/endpoint")
        async def endpoint(api_context: dict = Depends(api_key_auth.verify_api_key)):
            organization_id = api_context['organization_id']
            ...
    """

    API_KEY_PREFIX = "ftxt_"

    async def verify_api_key(
        self,
        authorization: HTTPAuthorizationCredentials = Depends(security)
    ) -> Dict[str, Any]:
        """
        Verify API key and return organization context.

        Args:
            authorization: Bearer token from Authorization header

        Returns:
            Dict with api_key_id, organization_id, permissions, and rate limits

        Raises:
            HTTPException: 401 if invalid, 403 if expired/inactive
        """
        api_key = authorization.credentials

        # Validate key format
        if not api_key.startswith(self.API_KEY_PREFIX):
            logger.warning(f"Invalid API key format: {api_key[:12]}...")
            raise HTTPException(
                status_code=401,
                detail=f"Invalid API key format. Must start with '{self.API_KEY_PREFIX}'"
            )

        # Hash the key for database lookup
        key_hash = hashlib.sha256(api_key.encode()).hexdigest()

        # Check if database is configured
        if not db_config.is_configured or not db_config.client:
            logger.error("Database not configured for API key verification")
            raise HTTPException(
                status_code=503,
                detail="Authentication service unavailable"
            )

        try:
            # Look up API key in database
            result = db_config.client.table('api_keys').select(
                'id, organization_id, name, permissions, rate_limit_per_minute, '
                'upload_limit_per_minute, is_active, expires_at'
            ).eq('key_hash', key_hash).execute()

            if not result.data:
                logger.warning(f"API key not found: {api_key[:12]}...")
                raise HTTPException(
                    status_code=401,
                    detail="Invalid API key"
                )

            key_data = result.data[0]

            # Check if key is active
            if not key_data.get('is_active', False):
                logger.warning(f"Inactive API key used: {key_data['id']}")
                raise HTTPException(
                    status_code=403,
                    detail="API key is inactive"
                )

            # Check expiration
            expires_at = key_data.get('expires_at')
            if expires_at:
                try:
                    # Handle ISO format with timezone
                    if isinstance(expires_at, str):
                        expires_at_str = expires_at.replace('Z', '+00:00')
                        expires_dt = datetime.fromisoformat(expires_at_str)
                    else:
                        expires_dt = expires_at

                    # Use timezone-aware comparison
                    now = datetime.utcnow()
                    if expires_dt.tzinfo is not None:
                        from datetime import timezone
                        now = now.replace(tzinfo=timezone.utc)

                    if now > expires_dt:
                        logger.warning(f"Expired API key used: {key_data['id']}")
                        raise HTTPException(
                            status_code=403,
                            detail="API key has expired"
                        )
                except (ValueError, TypeError) as e:
                    logger.error(f"Error parsing expiration date: {e}")

            # Update last_used_at (fire and forget)
            try:
                db_config.client.table('api_keys').update({
                    'last_used_at': datetime.utcnow().isoformat()
                }).eq('id', key_data['id']).execute()
            except Exception as e:
                logger.warning(f"Failed to update last_used_at: {e}")

            logger.info(f"API key verified: {key_data['name']} (org: {key_data['organization_id']})")

            return {
                'api_key_id': key_data['id'],
                'organization_id': key_data['organization_id'],
                'permissions': key_data.get('permissions', {}),
                'rate_limit_per_minute': key_data.get('rate_limit_per_minute', 60),
                'upload_limit_per_minute': key_data.get('upload_limit_per_minute', 10),
                'key_name': key_data.get('name', 'Unknown')
            }

        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"API key verification error: {e}", exc_info=True)
            raise HTTPException(
                status_code=500,
                detail="Authentication service error"
            )

    async def check_rate_limit(
        self,
        api_context: Dict[str, Any],
        endpoint: str,
        is_upload: bool = False
    ) -> Tuple[bool, Dict[str, Any]]:
        """
        Check and enforce rate limits using PostgreSQL.

        Args:
            api_context: Context from verify_api_key
            endpoint: Endpoint being accessed (e.g., '/api/v1/process')
            is_upload: True for upload operations (uses upload_limit)

        Returns:
            Tuple of (allowed: bool, headers: dict with rate limit info)

        Raises:
            HTTPException: 429 if rate limit exceeded
        """
        api_key_id = api_context['api_key_id']
        limit = (
            api_context['upload_limit_per_minute'] if is_upload
            else api_context['rate_limit_per_minute']
        )

        now = datetime.utcnow()
        # Use minute-based window
        window_start = now.replace(second=0, microsecond=0)
        window_end = window_start + timedelta(minutes=1)

        if not db_config.is_configured or not db_config.client:
            logger.warning("Database not configured for rate limiting - allowing request")
            return True, self._build_rate_limit_headers(limit, limit - 1, window_end)

        try:
            # Count requests in current window
            count_result = db_config.client.table('api_rate_limits').select(
                'request_count'
            ).eq('api_key_id', api_key_id).eq('endpoint', endpoint).gte(
                'window_start', window_start.isoformat()
            ).lte('window_end', window_end.isoformat()).execute()

            current_count = sum(
                row.get('request_count', 0) for row in (count_result.data or [])
            )

            # Check if limit exceeded
            if current_count >= limit:
                retry_after = int((window_end - now).total_seconds())
                headers = self._build_rate_limit_headers(limit, 0, window_end)
                headers['Retry-After'] = str(max(1, retry_after))

                logger.warning(
                    f"Rate limit exceeded for {api_context['key_name']}: "
                    f"{current_count}/{limit} on {endpoint}"
                )

                raise HTTPException(
                    status_code=429,
                    detail=f"Rate limit exceeded. Limit: {limit}/minute. Retry after {retry_after} seconds.",
                    headers=headers
                )

            # Record this request
            db_config.client.table('api_rate_limits').insert({
                'api_key_id': api_key_id,
                'endpoint': endpoint,
                'request_count': 1,
                'window_start': window_start.isoformat(),
                'window_end': window_end.isoformat()
            }).execute()

            # Cleanup old records (async, don't block)
            self._cleanup_old_rate_limits()

            remaining = max(0, limit - current_count - 1)
            headers = self._build_rate_limit_headers(limit, remaining, window_end)

            return True, headers

        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Rate limit check error: {e}", exc_info=True)
            # Fail open - don't block requests if rate limiting is broken
            logger.warning("Rate limiting error - allowing request")
            return True, self._build_rate_limit_headers(limit, limit - 1, window_end)

    def _build_rate_limit_headers(
        self,
        limit: int,
        remaining: int,
        reset_at: datetime
    ) -> Dict[str, str]:
        """Build standard rate limit headers."""
        return {
            'X-RateLimit-Limit': str(limit),
            'X-RateLimit-Remaining': str(remaining),
            'X-RateLimit-Reset': reset_at.isoformat()
        }

    def _cleanup_old_rate_limits(self) -> None:
        """Clean up rate limit records older than 5 minutes (fire and forget)."""
        try:
            cleanup_before = (datetime.utcnow() - timedelta(minutes=5)).isoformat()
            db_config.client.table('api_rate_limits').delete().lt(
                'window_end', cleanup_before
            ).execute()
        except Exception as e:
            logger.debug(f"Rate limit cleanup failed (non-critical): {e}")

    def has_permission(self, api_context: Dict[str, Any], permission: str) -> bool:
        """
        Check if API key has a specific permission.

        Args:
            api_context: Context from verify_api_key
            permission: Permission to check (e.g., 'upload', 'process', 'templates_read')

        Returns:
            True if permission is granted
        """
        permissions = api_context.get('permissions', {})
        return permissions.get(permission, False)


# Global singleton instance
api_key_auth = APIKeyAuth()
