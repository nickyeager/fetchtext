"""
Admin Dashboard Authentication Middleware

Provides JWT validation for admin dashboard users accessing the API.
This is separate from third-party API key authentication.
"""

import logging
import sys
import os
from typing import Dict, Any, Optional

from fastapi import HTTPException, Depends, Header
import jwt

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

    def __init__(self):
        # Get JWT secret from environment (same as Supabase config)
        self.jwt_secret = os.getenv('JWT_SECRET', os.getenv('SUPABASE_JWT_SECRET', ''))
        self.jwt_algorithms = ['HS256']

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
            # Decode JWT token
            if not self.jwt_secret:
                raise HTTPException(
                    status_code=503,
                    detail="Authentication service misconfigured — JWT_SECRET not set"
                )
            else:
                payload = jwt.decode(
                    token,
                    self.jwt_secret,
                    algorithms=self.jwt_algorithms,
                    audience="authenticated"
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
