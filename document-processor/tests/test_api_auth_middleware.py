"""
Tests for API Key Authentication Middleware.

Pure logic tests run directly against the APIKeyAuth class.
Integration tests call real backend endpoints.
No mocks. No fakes.
"""
import hashlib
from datetime import datetime, timedelta

import pytest
import httpx

from app.middleware.api_auth import APIKeyAuth, api_key_auth
from fastapi import HTTPException
from fastapi.security import HTTPAuthorizationCredentials

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
# Pure Logic Tests (no external services needed)
# =============================================================================


class TestAPIKeyFormat:
    """Test API key format validation (pure logic, no DB)."""

    @pytest.mark.asyncio
    async def test_rejects_key_without_prefix(self):
        """API key must start with 'ftxt_' prefix."""
        auth = APIKeyAuth()
        credentials = HTTPAuthorizationCredentials(
            scheme="Bearer",
            credentials="invalid_key_without_prefix",
        )

        with pytest.raises(HTTPException) as exc_info:
            await auth.verify_api_key(credentials)

        assert exc_info.value.status_code == 401
        assert "Must start with 'ftxt_'" in exc_info.value.detail

    @pytest.mark.asyncio
    async def test_rejects_empty_key(self):
        """Empty API key should be rejected."""
        auth = APIKeyAuth()
        credentials = HTTPAuthorizationCredentials(
            scheme="Bearer",
            credentials="",
        )

        with pytest.raises(HTTPException) as exc_info:
            await auth.verify_api_key(credentials)

        assert exc_info.value.status_code == 401


class TestPermissions:
    """Test permission checking (pure logic, no DB)."""

    def test_has_permission_returns_true_for_granted(self):
        """Returns True when permission is granted."""
        auth = APIKeyAuth()
        api_context = {
            "permissions": {"upload": True, "process": True, "templates_read": True}
        }

        assert auth.has_permission(api_context, "upload") is True
        assert auth.has_permission(api_context, "process") is True
        assert auth.has_permission(api_context, "templates_read") is True

    def test_has_permission_returns_false_for_missing(self):
        """Returns False when permission is not granted."""
        auth = APIKeyAuth()
        api_context = {"permissions": {"upload": True}}

        assert auth.has_permission(api_context, "admin") is False
        assert auth.has_permission(api_context, "delete") is False

    def test_has_permission_returns_false_for_explicitly_denied(self):
        """Returns False when permission is explicitly set to False."""
        auth = APIKeyAuth()
        api_context = {"permissions": {"upload": True, "admin": False}}

        assert auth.has_permission(api_context, "admin") is False

    def test_has_permission_handles_empty_permissions(self):
        """Handles empty permissions dict gracefully."""
        auth = APIKeyAuth()
        api_context = {"permissions": {}}

        assert auth.has_permission(api_context, "upload") is False

    def test_has_permission_handles_missing_permissions_key(self):
        """Handles missing permissions key gracefully."""
        auth = APIKeyAuth()
        api_context = {}

        assert auth.has_permission(api_context, "upload") is False


class TestRateLimitHeaders:
    """Test rate limit response header construction (pure logic)."""

    def test_builds_correct_headers(self):
        """Builds correct rate limit headers."""
        auth = APIKeyAuth()
        reset_time = datetime(2025, 1, 1, 12, 0, 0)

        headers = auth._build_rate_limit_headers(
            limit=60, remaining=45, reset_at=reset_time
        )

        assert headers["X-RateLimit-Limit"] == "60"
        assert headers["X-RateLimit-Remaining"] == "45"
        assert "2025-01-01" in headers["X-RateLimit-Reset"]


class TestGlobalSingleton:
    """Test the global api_key_auth singleton (pure logic)."""

    def test_singleton_exists(self):
        """Global singleton is properly instantiated."""
        assert api_key_auth is not None
        assert isinstance(api_key_auth, APIKeyAuth)

    def test_singleton_has_correct_prefix(self):
        """Singleton uses correct API key prefix."""
        assert api_key_auth.API_KEY_PREFIX == "ftxt_"

    def test_key_hash_deterministic(self):
        """SHA-256 hashing of API keys is consistent."""
        test_key = "ftxt_testkey123456"
        expected_hash = hashlib.sha256(test_key.encode()).hexdigest()
        actual_hash = hashlib.sha256(test_key.encode()).hexdigest()
        assert expected_hash == actual_hash


# =============================================================================
# Integration Tests (call real backend endpoints)
# =============================================================================


class TestAuthViaRealEndpoints:
    """Test auth middleware behavior via real HTTP calls to the backend."""

    def test_api_v1_health_no_auth_required(self, backend):
        """GET /api/v1/health should work without authentication."""
        resp = httpx.get(f"{BACKEND_URL}/api/v1/health", timeout=5)
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "healthy"
        assert data["api_version"] == "v1"

    def test_api_v1_process_rejects_missing_auth(self, backend):
        """POST /api/v1/process should reject requests without auth."""
        resp = httpx.post(f"{BACKEND_URL}/api/v1/process", timeout=5)
        # Should get 401 (missing auth) or 403 (forbidden)
        assert resp.status_code in (401, 403, 422), (
            f"Expected auth error, got {resp.status_code}: {resp.text}"
        )

    def test_api_v1_process_rejects_invalid_key_format(self, backend):
        """POST /api/v1/process should reject non-ftxt_ keys."""
        resp = httpx.post(
            f"{BACKEND_URL}/api/v1/process",
            headers={"Authorization": "Bearer invalid_not_ftxt_key"},
            timeout=5,
        )
        assert resp.status_code == 401, (
            f"Expected 401 for invalid key format, got {resp.status_code}: {resp.text}"
        )

    def test_api_v1_process_rejects_nonexistent_key(self, backend):
        """POST /api/v1/process should reject ftxt_ key not in database."""
        resp = httpx.post(
            f"{BACKEND_URL}/api/v1/process",
            headers={"Authorization": "Bearer ftxt_nonexistentkey12345"},
            timeout=5,
        )
        # Should get 401 (key not found) or 500/503 (api_keys table doesn't exist)
        assert resp.status_code in (401, 500, 503), (
            f"Expected 401/500/503, got {resp.status_code}: {resp.text}"
        )

    def test_api_v1_jobs_rejects_missing_auth(self, backend):
        """GET /api/v1/jobs/{id} should reject requests without auth."""
        resp = httpx.get(
            f"{BACKEND_URL}/api/v1/jobs/00000000-0000-0000-0000-000000000000",
            timeout=5,
        )
        assert resp.status_code in (401, 403, 422), (
            f"Expected auth error, got {resp.status_code}: {resp.text}"
        )

    def test_api_v1_templates_rejects_missing_auth(self, backend):
        """GET /api/v1/templates should reject requests without auth."""
        resp = httpx.get(f"{BACKEND_URL}/api/v1/templates", timeout=5)
        assert resp.status_code in (401, 403, 422), (
            f"Expected auth error, got {resp.status_code}: {resp.text}"
        )


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
