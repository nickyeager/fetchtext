"""
Admin Dashboard Authentication Middleware

Provides JWT validation for admin dashboard users accessing the API.
This is separate from third-party API key authentication.

Supports two verification modes, selected by inspecting the token's alg header:
- Shared secret (symmetric HS256): Used by Supabase (both managed and local Docker).
  Configured via JWT_SECRET or SUPABASE_JWT_SECRET env var.
- JWKS (asymmetric ES256): Fallback when token uses ES256 and SUPABASE_URL is set.
  Fetches public keys from {SUPABASE_URL}/auth/v1/.well-known/jwks.json

Note: Managed Supabase exposes JWKS ES256 keys but currently still signs tokens
with HS256.  The middleware checks the token's actual algorithm first to avoid
"alg value not allowed" errors from algorithm mismatches.
"""

import logging
import sys
import os
import time
from typing import Dict, Any, Optional

from fastapi import HTTPException, Depends, Header
import jwt
from jose import jwk
from jose.utils import base64url_decode
import httpx

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


class AdminAuth:
    """
    Admin authentication for dashboard API endpoints.

    Validates Supabase JWT tokens and extracts user information.
    Also verifies organization membership for organization-scoped operations.
    """

    # Cache JWKS keys for 1 hour
    JWKS_CACHE_TTL = 3600

    def __init__(self):
        self.jwt_secret = os.getenv('JWT_SECRET', os.getenv('SUPABASE_JWT_SECRET', ''))
        self.supabase_url = os.getenv('SUPABASE_URL', '').rstrip('/')
        self.jwks_uri = f"{self.supabase_url}/auth/v1/.well-known/jwks.json" if self.supabase_url else ''
        self._jwks_cache: Optional[Dict] = None
        self._jwks_fetched_at: float = 0

        modes = []
        if self.jwt_secret:
            modes.append("HS256")
        if self.jwks_uri:
            modes.append(f"JWKS({self.jwks_uri})")
        if self.supabase_url and not self.jwt_secret:
            modes.append("Supabase-API-fallback")
        if modes:
            logger.info(f"Auth configured: {' + '.join(modes)}")
        else:
            logger.warning("Auth NOT configured — no SUPABASE_URL or JWT_SECRET set")

    def _fetch_jwks(self) -> Dict:
        """Fetch and cache JWKS keys from Supabase discovery endpoint."""
        now = time.time()
        if self._jwks_cache and (now - self._jwks_fetched_at) < self.JWKS_CACHE_TTL:
            return self._jwks_cache

        try:
            resp = httpx.get(self.jwks_uri, timeout=10)
            resp.raise_for_status()
            self._jwks_cache = resp.json()
            self._jwks_fetched_at = now
            key_count = len(self._jwks_cache.get('keys', []))
            logger.info(f"Fetched {key_count} JWKS key(s) from {self.jwks_uri}")
            return self._jwks_cache
        except Exception as e:
            logger.error(f"Failed to fetch JWKS from {self.jwks_uri}: {e}")
            if self._jwks_cache:
                logger.warning("Using stale JWKS cache")
                return self._jwks_cache
            raise

    def _verify_via_supabase_api(self, token: str) -> Dict[str, Any]:
        """Verify a token by calling the Supabase Auth API.

        Used as a fallback when the JWT secret is not available locally
        (e.g. managed Supabase signs with HS256 but we don't have the secret).
        """
        url = f"{self.supabase_url}/auth/v1/user"
        try:
            resp = httpx.get(
                url,
                headers={"Authorization": f"Bearer {token}", "apikey": os.getenv('SUPABASE_ANON_KEY', '')},
                timeout=10,
            )
            if resp.status_code != 200:
                logger.warning(f"Supabase auth API returned {resp.status_code}")
                raise jwt.InvalidTokenError(f"Supabase auth API returned {resp.status_code}")

            user_data = resp.json()
            user_id = user_data.get('id')
            if not user_id:
                raise jwt.InvalidTokenError("Supabase auth API returned no user ID")

            logger.info(f"Token verified via Supabase auth API for user {user_id}")
            return {
                'sub': user_id,
                'email': user_data.get('email'),
                'role': user_data.get('role', 'authenticated'),
            }
        except httpx.RequestError as e:
            logger.error(f"Failed to reach Supabase auth API: {e}")
            raise jwt.InvalidTokenError(f"Supabase auth API unreachable: {e}")

    def _decode_with_jwks(self, token: str) -> Dict[str, Any]:
        """Decode a JWT using JWKS public keys (ES256)."""
        jwks_data = self._fetch_jwks()
        keys = jwks_data.get('keys', [])
        if not keys:
            raise jwt.InvalidTokenError("No keys found in JWKS endpoint")

        # Get the kid from the token header to find the right key
        unverified_header = jwt.get_unverified_header(token)
        token_kid = unverified_header.get('kid')

        signing_key = None
        for key_data in keys:
            if token_kid and key_data.get('kid') == token_kid:
                signing_key = key_data
                break

        if not signing_key:
            # If no kid match, use the first key
            signing_key = keys[0]

        # Convert JWK to PEM for verification
        key_obj = jwk.construct(signing_key)
        pem_key = key_obj.to_pem()

        return jwt.decode(
            token,
            pem_key,
            algorithms=[signing_key.get('alg', 'ES256')],
            audience="authenticated"
        )

    async def get_current_user(
        self,
        authorization: Optional[str] = Header(None, alias="Authorization")
    ) -> Dict[str, Any]:
        """
        Extract and validate user from Supabase JWT token.

        Args:
            authorization: Bearer token from Authorization header

        Returns:
            Dict with user_id, email, and other JWT claims

        Raises:
            HTTPException: 401 if token is invalid or missing
        """
        if not authorization:
            raise HTTPException(
                status_code=401,
                detail="Authorization header required"
            )

        # Extract token from "Bearer <token>" format
        parts = authorization.split()
        if len(parts) != 2 or parts[0].lower() != 'bearer':
            raise HTTPException(
                status_code=401,
                detail="Invalid authorization header format. Use: Bearer <token>"
            )

        token = parts[1]

        try:
            # Inspect the token header to choose the right verification method.
            # Managed Supabase exposes JWKS with ES256 keys but still signs
            # tokens with HS256, so we must route by the token's actual alg.
            token_alg = jwt.get_unverified_header(token).get('alg', '')

            if token_alg == 'HS256' and self.jwt_secret:
                # Symmetric verification — local Docker or managed Supabase with JWT_SECRET
                payload = jwt.decode(
                    token,
                    self.jwt_secret,
                    algorithms=['HS256'],
                    audience="authenticated"
                )
            elif token_alg == 'HS256' and self.supabase_url:
                # HS256 token but no local secret — verify via Supabase Auth API
                logger.info("No JWT_SECRET set, verifying HS256 token via Supabase auth API")
                payload = self._verify_via_supabase_api(token)
            elif self.jwks_uri and token_alg in ('ES256', 'RS256'):
                # Asymmetric verification via JWKS
                payload = self._decode_with_jwks(token)
            elif self.jwt_secret:
                # Unknown alg, try HS256 with secret
                payload = jwt.decode(
                    token,
                    self.jwt_secret,
                    algorithms=['HS256'],
                    audience="authenticated"
                )
            elif self.supabase_url:
                # Last resort — verify via Supabase Auth API
                logger.info(f"No local verification available for alg={token_alg}, using Supabase auth API")
                payload = self._verify_via_supabase_api(token)
            else:
                raise HTTPException(
                    status_code=503,
                    detail="Authentication service misconfigured — no SUPABASE_URL or JWT_SECRET set"
                )

            user_id = payload.get('sub')
            if not user_id:
                raise HTTPException(
                    status_code=401,
                    detail="Invalid token: missing user ID"
                )

            return {
                'user_id': user_id,
                'email': payload.get('email'),
                'role': payload.get('role', 'authenticated'),
                'claims': payload
            }

        except jwt.ExpiredSignatureError:
            raise HTTPException(
                status_code=401,
                detail="Token has expired"
            )
        except jwt.InvalidTokenError as e:
            logger.warning(f"Invalid JWT token: {e}")
            raise HTTPException(
                status_code=401,
                detail="Invalid token"
            )

    async def verify_org_membership(
        self,
        user_id: str,
        organization_id: str
    ) -> bool:
        """
        Verify that a user is a member of an organization.

        Args:
            user_id: The user's UUID
            organization_id: The organization's UUID

        Returns:
            True if user is a member

        Raises:
            HTTPException: 403 if user is not a member
        """
        if not db_config.is_configured or not db_config.client:
            logger.warning("Database not configured - skipping org membership check")
            return True

        try:
            # Check organization_members table
            result = db_config.client.table('organization_members').select(
                'id'
            ).eq('user_id', user_id).eq('organization_id', organization_id).execute()

            if not result.data:
                logger.warning(f"User {user_id} is not a member of org {organization_id}")
                raise HTTPException(
                    status_code=403,
                    detail="You do not have access to this organization"
                )

            return True

        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Error checking org membership: {e}")
            # Fail closed - deny access on error
            raise HTTPException(
                status_code=500,
                detail="Failed to verify organization membership"
            )

    async def require_org_access(
        self,
        organization_id: str,
        authorization: Optional[str] = Header(None, alias="Authorization")
    ) -> Dict[str, Any]:
        """
        Combined authentication and organization access check.

        Use this as a dependency for endpoints that require both auth and org access.

        Args:
            organization_id: The organization UUID to check access for
            authorization: Bearer token from Authorization header

        Returns:
            Dict with user info and organization_id
        """
        user = await self.get_current_user(authorization)
        await self.verify_org_membership(user['user_id'], organization_id)

        return {
            **user,
            'organization_id': organization_id
        }


# Global singleton instance
admin_auth = AdminAuth()
