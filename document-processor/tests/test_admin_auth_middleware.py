"""
Tests for Admin Dashboard Authentication Middleware.

Pure logic tests exercise the AdminAuth class directly.
Integration tests call the REAL backend at localhost:8090.
No mocks. No fakes.
"""

import pytest
import jwt
import httpx
from datetime import datetime, timedelta
from fastapi import HTTPException

from app.middleware.admin_auth import AdminAuth, admin_auth

BACKEND_URL = "http://localhost:8090"
TEST_ORG_ID = "00000000-0000-0000-0000-000000000010"


@pytest.fixture(scope="module")
def backend():
    """Verify the backend is reachable before running integration tests."""
    try:
        resp = httpx.get(f"{BACKEND_URL}/health", timeout=5)
        resp.raise_for_status()
    except Exception as exc:
        pytest.fail(f"Backend not reachable at {BACKEND_URL}: {exc}")


# =============================================================================
# Pure Logic Tests — Authorization Header Parsing (no external services)
# =============================================================================


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
        auth.jwt_secret = ''  # Permissive mode (no verification)

        test_payload = {
            'sub': 'user-123',
            'email': 'test@example.com',
            'role': 'authenticated',
            'aud': 'authenticated',
            'exp': datetime.utcnow() + timedelta(hours=1)
        }

        token = jwt.encode(test_payload, 'any-secret', algorithm='HS256')
        result = await auth.get_current_user(f"Bearer {token}")

        assert result['user_id'] == 'user-123'
        assert result['email'] == 'test@example.com'


# =============================================================================
# Pure Logic Tests — JWT Validation (no external services)
# =============================================================================


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
        auth.jwt_secret = ''  # Permissive mode

        payload = {
            'email': 'test@example.com',
            'aud': 'authenticated',
            'exp': datetime.utcnow() + timedelta(hours=1)
            # Missing 'sub' claim
        }

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


# =============================================================================
# Pure Logic Tests — require_org_access auth failure (no external services)
# =============================================================================


class TestRequireOrgAccessAuthFailure:
    """Test require_org_access when authentication itself fails."""

    @pytest.mark.asyncio
    async def test_fails_on_missing_auth(self):
        """Fails if authentication header is missing."""
        auth = AdminAuth()

        with pytest.raises(HTTPException) as exc_info:
            await auth.require_org_access('org-456', None)

        assert exc_info.value.status_code == 401


# =============================================================================
# Integration Tests — Admin Auth via Real HTTP Endpoints
# =============================================================================


class TestAdminAuthViaRealEndpoints:
    """Test admin auth middleware behavior via real HTTP calls to the backend."""

    def test_admin_create_rejects_missing_auth(self, backend):
        """POST /api/admin/keys/create without auth returns 401."""
        resp = httpx.post(
            f"{BACKEND_URL}/api/admin/keys/create",
            json={"name": "Test Key", "organization_id": TEST_ORG_ID},
            timeout=5,
        )
        assert resp.status_code == 401

    def test_admin_list_rejects_missing_auth(self, backend):
        """GET /api/admin/keys/list/{org_id} without auth returns 401."""
        resp = httpx.get(
            f"{BACKEND_URL}/api/admin/keys/list/{TEST_ORG_ID}",
            timeout=5,
        )
        assert resp.status_code == 401

    def test_admin_get_rejects_missing_auth(self, backend):
        """GET /api/admin/keys/{key_id} without auth returns 401."""
        resp = httpx.get(
            f"{BACKEND_URL}/api/admin/keys/00000000-0000-0000-0000-000000000099",
            timeout=5,
        )
        assert resp.status_code == 401

    def test_admin_update_rejects_missing_auth(self, backend):
        """PATCH /api/admin/keys/{key_id} without auth returns 401."""
        resp = httpx.patch(
            f"{BACKEND_URL}/api/admin/keys/00000000-0000-0000-0000-000000000099",
            json={"name": "Updated"},
            timeout=5,
        )
        assert resp.status_code == 401

    def test_admin_revoke_rejects_missing_auth(self, backend):
        """DELETE /api/admin/keys/{key_id}/revoke without auth returns 401."""
        resp = httpx.delete(
            f"{BACKEND_URL}/api/admin/keys/00000000-0000-0000-0000-000000000099/revoke",
            timeout=5,
        )
        assert resp.status_code == 401

    def test_admin_delete_rejects_missing_auth(self, backend):
        """DELETE /api/admin/keys/{key_id} without auth returns 401."""
        resp = httpx.delete(
            f"{BACKEND_URL}/api/admin/keys/00000000-0000-0000-0000-000000000099",
            timeout=5,
        )
        assert resp.status_code == 401

    def test_admin_usage_rejects_missing_auth(self, backend):
        """GET /api/admin/keys/{key_id}/usage without auth returns 401."""
        resp = httpx.get(
            f"{BACKEND_URL}/api/admin/keys/00000000-0000-0000-0000-000000000099/usage",
            timeout=5,
        )
        assert resp.status_code == 401

    def test_admin_create_rejects_invalid_jwt(self, backend):
        """POST /api/admin/keys/create with invalid JWT returns 401."""
        resp = httpx.post(
            f"{BACKEND_URL}/api/admin/keys/create",
            json={"name": "Test Key", "organization_id": TEST_ORG_ID},
            headers={"Authorization": "Bearer invalid.jwt.token"},
            timeout=5,
        )
        assert resp.status_code in (401, 403)

    def test_admin_create_rejects_non_bearer(self, backend):
        """POST /api/admin/keys/create with non-Bearer scheme returns 401."""
        resp = httpx.post(
            f"{BACKEND_URL}/api/admin/keys/create",
            json={"name": "Test Key", "organization_id": TEST_ORG_ID},
            headers={"Authorization": "Basic dXNlcm5hbWU6cGFzc3dvcmQ="},
            timeout=5,
        )
        assert resp.status_code == 401

    def test_admin_list_rejects_invalid_jwt(self, backend):
        """GET /api/admin/keys/list/{org_id} with invalid JWT returns 401."""
        resp = httpx.get(
            f"{BACKEND_URL}/api/admin/keys/list/{TEST_ORG_ID}",
            headers={"Authorization": "Bearer invalid.jwt.token"},
            timeout=5,
        )
        assert resp.status_code in (401, 403)


# =============================================================================
# Pure Logic Tests — Global Singleton
# =============================================================================


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


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
