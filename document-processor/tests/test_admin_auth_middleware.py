"""
Tests for Admin Dashboard Authentication Middleware

Tests JWT validation for admin dashboard users accessing the API.
"""

import pytest
import jwt
from datetime import datetime, timedelta
from unittest.mock import MagicMock, patch
from fastapi import HTTPException

import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))

from app.middleware.admin_auth import AdminAuth, admin_auth


class TestAuthorizationHeader:
    """Test authorization header parsing."""

    @pytest.mark.asyncio
    async def test_rejects_missing_authorization(self):
        """Missing Authorization header returns 401."""
        auth = AdminAuth()

        with pytest.raises(HTTPException) as exc_info:
            await auth.get_current_user(None)

        assert exc_info.value.status_code == 401
        assert "Authorization header required" in exc_info.value.detail

    @pytest.mark.asyncio
    async def test_rejects_non_bearer_scheme(self):
        """Non-Bearer authorization scheme returns 401."""
        auth = AdminAuth()

        with pytest.raises(HTTPException) as exc_info:
            await auth.get_current_user("Basic dXNlcm5hbWU6cGFzc3dvcmQ=")

        assert exc_info.value.status_code == 401
        assert "Invalid authorization header format" in exc_info.value.detail

    @pytest.mark.asyncio
    async def test_rejects_malformed_header(self):
        """Malformed header without space returns 401."""
        auth = AdminAuth()

        with pytest.raises(HTTPException) as exc_info:
            await auth.get_current_user("BearerTokenWithoutSpace")

        assert exc_info.value.status_code == 401

    @pytest.mark.asyncio
    async def test_extracts_token_from_bearer_header(self):
        """Correctly extracts token from 'Bearer <token>' format."""
        auth = AdminAuth()

        # Create a valid JWT for testing
        test_payload = {
            'sub': 'user-123',
            'email': 'test@example.com',
            'role': 'authenticated',
            'aud': 'authenticated',
            'exp': datetime.utcnow() + timedelta(hours=1)
        }

        # Without JWT_SECRET, it should decode without verification
        with patch.object(auth, 'jwt_secret', ''):
            token = jwt.encode(test_payload, 'any-secret', algorithm='HS256')
            result = await auth.get_current_user(f"Bearer {token}")

            assert result['user_id'] == 'user-123'
            assert result['email'] == 'test@example.com'


class TestJWTValidation:
    """Test JWT token validation."""

    @pytest.mark.asyncio
    async def test_rejects_expired_token(self):
        """Expired JWT returns 401."""
        auth = AdminAuth()
        auth.jwt_secret = 'test-secret'

        expired_payload = {
            'sub': 'user-123',
            'email': 'test@example.com',
            'aud': 'authenticated',
            'exp': datetime.utcnow() - timedelta(hours=1)  # Expired 1 hour ago
        }

        token = jwt.encode(expired_payload, 'test-secret', algorithm='HS256')

        with pytest.raises(HTTPException) as exc_info:
            await auth.get_current_user(f"Bearer {token}")

        assert exc_info.value.status_code == 401
        assert "expired" in exc_info.value.detail.lower()

    @pytest.mark.asyncio
    async def test_rejects_invalid_signature(self):
        """Token with invalid signature returns 401."""
        auth = AdminAuth()
        auth.jwt_secret = 'correct-secret'

        payload = {
            'sub': 'user-123',
            'email': 'test@example.com',
            'aud': 'authenticated',
            'exp': datetime.utcnow() + timedelta(hours=1)
        }

        # Sign with wrong secret
        token = jwt.encode(payload, 'wrong-secret', algorithm='HS256')

        with pytest.raises(HTTPException) as exc_info:
            await auth.get_current_user(f"Bearer {token}")

        assert exc_info.value.status_code == 401
        assert "Invalid token" in exc_info.value.detail

    @pytest.mark.asyncio
    async def test_rejects_token_missing_user_id(self):
        """Token without 'sub' claim returns 401."""
        auth = AdminAuth()

        payload = {
            'email': 'test@example.com',
            'aud': 'authenticated',
            'exp': datetime.utcnow() + timedelta(hours=1)
            # Missing 'sub' claim
        }

        with patch.object(auth, 'jwt_secret', ''):
            token = jwt.encode(payload, 'any-secret', algorithm='HS256')

            with pytest.raises(HTTPException) as exc_info:
                await auth.get_current_user(f"Bearer {token}")

            assert exc_info.value.status_code == 401
            assert "missing user ID" in exc_info.value.detail

    @pytest.mark.asyncio
    async def test_accepts_valid_token(self):
        """Valid JWT returns user context."""
        auth = AdminAuth()
        auth.jwt_secret = 'test-secret'

        payload = {
            'sub': 'user-uuid-123',
            'email': 'admin@example.com',
            'role': 'authenticated',
            'aud': 'authenticated',
            'exp': datetime.utcnow() + timedelta(hours=1)
        }

        token = jwt.encode(payload, 'test-secret', algorithm='HS256')
        result = await auth.get_current_user(f"Bearer {token}")

        assert result['user_id'] == 'user-uuid-123'
        assert result['email'] == 'admin@example.com'
        assert result['role'] == 'authenticated'
        assert 'claims' in result

    @pytest.mark.asyncio
    async def test_permissive_mode_without_secret(self):
        """Without JWT_SECRET, decodes without signature verification."""
        auth = AdminAuth()
        auth.jwt_secret = ''  # No secret configured

        payload = {
            'sub': 'user-123',
            'email': 'test@example.com',
            'aud': 'authenticated',
            'exp': datetime.utcnow() + timedelta(hours=1)
        }

        # Can use any secret when decoding without verification
        token = jwt.encode(payload, 'any-secret-at-all', algorithm='HS256')
        result = await auth.get_current_user(f"Bearer {token}")

        assert result['user_id'] == 'user-123'


class TestOrganizationMembership:
    """Test organization membership verification."""

    @pytest.mark.asyncio
    async def test_allows_member(self):
        """User who is a member gets access."""
        auth = AdminAuth()

        mock_client = MagicMock()
        mock_client.table.return_value.select.return_value.eq.return_value.eq.return_value.execute.return_value.data = [
            {'id': 'membership-id-123'}
        ]

        with patch('app.middleware.admin_auth.db_config') as mock_db:
            mock_db.is_configured = True
            mock_db.client = mock_client

            result = await auth.verify_org_membership('user-123', 'org-456')
            assert result is True

    @pytest.mark.asyncio
    async def test_rejects_non_member(self):
        """User who is not a member gets 403."""
        auth = AdminAuth()

        mock_client = MagicMock()
        mock_client.table.return_value.select.return_value.eq.return_value.eq.return_value.execute.return_value.data = []

        with patch('app.middleware.admin_auth.db_config') as mock_db:
            mock_db.is_configured = True
            mock_db.client = mock_client

            with pytest.raises(HTTPException) as exc_info:
                await auth.verify_org_membership('user-123', 'org-456')

            assert exc_info.value.status_code == 403
            assert "do not have access" in exc_info.value.detail

    @pytest.mark.asyncio
    async def test_skips_check_when_db_unavailable(self):
        """Skips membership check when database is unavailable (dev mode)."""
        auth = AdminAuth()

        with patch('app.middleware.admin_auth.db_config') as mock_db:
            mock_db.is_configured = False
            mock_db.client = None

            result = await auth.verify_org_membership('user-123', 'org-456')
            assert result is True

    @pytest.mark.asyncio
    async def test_fails_closed_on_db_error(self):
        """Database errors result in denied access (fail closed)."""
        auth = AdminAuth()

        mock_client = MagicMock()
        mock_client.table.return_value.select.return_value.eq.return_value.eq.return_value.execute.side_effect = Exception("Database error")

        with patch('app.middleware.admin_auth.db_config') as mock_db:
            mock_db.is_configured = True
            mock_db.client = mock_client

            with pytest.raises(HTTPException) as exc_info:
                await auth.verify_org_membership('user-123', 'org-456')

            assert exc_info.value.status_code == 500


class TestRequireOrgAccess:
    """Test combined auth and org access check."""

    @pytest.mark.asyncio
    async def test_combines_auth_and_membership(self):
        """require_org_access combines both checks."""
        auth = AdminAuth()
        auth.jwt_secret = 'test-secret'

        payload = {
            'sub': 'user-123',
            'email': 'test@example.com',
            'aud': 'authenticated',
            'exp': datetime.utcnow() + timedelta(hours=1)
        }

        token = jwt.encode(payload, 'test-secret', algorithm='HS256')

        mock_client = MagicMock()
        mock_client.table.return_value.select.return_value.eq.return_value.eq.return_value.execute.return_value.data = [
            {'id': 'membership-id'}
        ]

        with patch('app.middleware.admin_auth.db_config') as mock_db:
            mock_db.is_configured = True
            mock_db.client = mock_client

            result = await auth.require_org_access('org-456', f"Bearer {token}")

            assert result['user_id'] == 'user-123'
            assert result['organization_id'] == 'org-456'

    @pytest.mark.asyncio
    async def test_fails_on_auth_failure(self):
        """Fails if authentication fails."""
        auth = AdminAuth()

        with pytest.raises(HTTPException) as exc_info:
            await auth.require_org_access('org-456', None)

        assert exc_info.value.status_code == 401

    @pytest.mark.asyncio
    async def test_fails_on_membership_failure(self):
        """Fails if membership check fails."""
        auth = AdminAuth()
        auth.jwt_secret = 'test-secret'

        payload = {
            'sub': 'user-123',
            'email': 'test@example.com',
            'aud': 'authenticated',
            'exp': datetime.utcnow() + timedelta(hours=1)
        }

        token = jwt.encode(payload, 'test-secret', algorithm='HS256')

        mock_client = MagicMock()
        mock_client.table.return_value.select.return_value.eq.return_value.eq.return_value.execute.return_value.data = []

        with patch('app.middleware.admin_auth.db_config') as mock_db:
            mock_db.is_configured = True
            mock_db.client = mock_client

            with pytest.raises(HTTPException) as exc_info:
                await auth.require_org_access('org-456', f"Bearer {token}")

            assert exc_info.value.status_code == 403


class TestGlobalSingleton:
    """Test the global admin_auth singleton."""

    def test_singleton_exists(self):
        """Global singleton is properly instantiated."""
        assert admin_auth is not None
        assert isinstance(admin_auth, AdminAuth)

    def test_singleton_has_jwt_config(self):
        """Singleton has JWT configuration."""
        assert hasattr(admin_auth, 'jwt_secret')
        assert hasattr(admin_auth, 'jwt_algorithms')
        assert 'HS256' in admin_auth.jwt_algorithms
