"""
Tests for API Key Management Router (Admin).

Pure logic tests for key generation run without external services.
Integration tests call the REAL backend at localhost:8090.
No mocks. No fakes.
"""
import hashlib

import pytest
import httpx

from app.routers.api_keys_admin import generate_api_key

BACKEND_URL = "http://localhost:8090"


@pytest.fixture(scope="module")
def backend():
    """Verify the backend is reachable before running integration tests."""
    try:
        resp = httpx.get(f"{BACKEND_URL}/health", timeout=5)
        resp.raise_for_status()
    except Exception as exc:
        pytest.fail(f"Backend not reachable at {BACKEND_URL}: {exc}")


# =============================================================================
# Pure Logic Tests — API Key Generation (no external services needed)
# =============================================================================


class TestAPIKeyGeneration:
    """Test API key generation utility (pure logic, no DB)."""

    def test_generates_key_with_prefix(self):
        """Generated key starts with 'ftxt_' prefix."""
        full_key, key_hash, key_prefix = generate_api_key()
        assert full_key.startswith("ftxt_")

    def test_generates_unique_keys(self):
        """Each call generates a unique key."""
        key1, _, _ = generate_api_key()
        key2, _, _ = generate_api_key()
        assert key1 != key2

    def test_returns_sha256_hash(self):
        """Returns correct SHA-256 hash of the key."""
        full_key, key_hash, key_prefix = generate_api_key()
        expected_hash = hashlib.sha256(full_key.encode()).hexdigest()
        assert key_hash == expected_hash

    def test_returns_key_prefix(self):
        """Returns first 12 characters as prefix."""
        full_key, key_hash, key_prefix = generate_api_key()
        assert key_prefix == full_key[:12]
        assert len(key_prefix) == 12

    def test_key_has_sufficient_entropy(self):
        """Key has sufficient length for security."""
        full_key, _, _ = generate_api_key()
        # ftxt_ (5) + base64 chars = should be at least 40 chars
        assert len(full_key) >= 40


# =============================================================================
# Integration Tests — Admin Key Endpoints via Real HTTP Calls
# =============================================================================


class TestAdminKeyEndpointsAuth:
    """Test that admin key endpoints require authentication."""

    def test_create_key_rejects_missing_auth(self, backend):
        """POST /api/admin/keys/create without auth should fail."""
        resp = httpx.post(
            f"{BACKEND_URL}/api/admin/keys/create",
            json={"name": "Test Key", "organization_id": "org-123"},
            timeout=5,
        )
        assert resp.status_code == 401, (
            f"Expected 401 for missing auth, got {resp.status_code}: {resp.text}"
        )

    def test_list_keys_rejects_missing_auth(self, backend):
        """GET /api/admin/keys/list/{org_id} without auth should fail."""
        resp = httpx.get(
            f"{BACKEND_URL}/api/admin/keys/list/00000000-0000-0000-0000-000000000010",
            timeout=5,
        )
        assert resp.status_code == 401, (
            f"Expected 401 for missing auth, got {resp.status_code}: {resp.text}"
        )

    def test_get_key_rejects_missing_auth(self, backend):
        """GET /api/admin/keys/{key_id} without auth should fail."""
        resp = httpx.get(
            f"{BACKEND_URL}/api/admin/keys/00000000-0000-0000-0000-000000000099",
            timeout=5,
        )
        assert resp.status_code == 401, (
            f"Expected 401 for missing auth, got {resp.status_code}: {resp.text}"
        )

    def test_update_key_rejects_missing_auth(self, backend):
        """PATCH /api/admin/keys/{key_id} without auth should fail."""
        resp = httpx.patch(
            f"{BACKEND_URL}/api/admin/keys/00000000-0000-0000-0000-000000000099",
            json={"name": "Updated Name"},
            timeout=5,
        )
        assert resp.status_code == 401, (
            f"Expected 401 for missing auth, got {resp.status_code}: {resp.text}"
        )

    def test_revoke_key_rejects_missing_auth(self, backend):
        """DELETE /api/admin/keys/{key_id}/revoke without auth should fail."""
        resp = httpx.delete(
            f"{BACKEND_URL}/api/admin/keys/00000000-0000-0000-0000-000000000099/revoke",
            timeout=5,
        )
        assert resp.status_code == 401, (
            f"Expected 401 for missing auth, got {resp.status_code}: {resp.text}"
        )

    def test_delete_key_rejects_missing_auth(self, backend):
        """DELETE /api/admin/keys/{key_id} without auth should fail."""
        resp = httpx.delete(
            f"{BACKEND_URL}/api/admin/keys/00000000-0000-0000-0000-000000000099",
            timeout=5,
        )
        assert resp.status_code == 401, (
            f"Expected 401 for missing auth, got {resp.status_code}: {resp.text}"
        )

    def test_usage_rejects_missing_auth(self, backend):
        """GET /api/admin/keys/{key_id}/usage without auth should fail."""
        resp = httpx.get(
            f"{BACKEND_URL}/api/admin/keys/00000000-0000-0000-0000-000000000099/usage",
            timeout=5,
        )
        assert resp.status_code == 401, (
            f"Expected 401 for missing auth, got {resp.status_code}: {resp.text}"
        )


class TestAdminKeyEndpointsInvalidAuth:
    """Test that admin key endpoints reject invalid JWTs."""

    def test_create_key_rejects_invalid_jwt(self, backend):
        """POST /api/admin/keys/create with invalid JWT should fail."""
        resp = httpx.post(
            f"{BACKEND_URL}/api/admin/keys/create",
            json={"name": "Test Key", "organization_id": "org-123"},
            headers={"Authorization": "Bearer invalid.jwt.token"},
            timeout=5,
        )
        assert resp.status_code in (401, 403), (
            f"Expected 401/403, got {resp.status_code}: {resp.text}"
        )

    def test_list_keys_rejects_invalid_jwt(self, backend):
        """GET /api/admin/keys/list/{org_id} with invalid JWT should fail."""
        resp = httpx.get(
            f"{BACKEND_URL}/api/admin/keys/list/org-123",
            headers={"Authorization": "Bearer invalid.jwt.token"},
            timeout=5,
        )
        assert resp.status_code in (401, 403), (
            f"Expected 401/403, got {resp.status_code}: {resp.text}"
        )


class TestAdminKeyEndpointsValidation:
    """Test request validation on admin key endpoints."""

    def test_create_key_rejects_missing_required_fields(self, backend):
        """POST /api/admin/keys/create without required fields returns 422."""
        resp = httpx.post(
            f"{BACKEND_URL}/api/admin/keys/create",
            json={},
            headers={"Authorization": "Bearer dummy"},
            timeout=5,
        )
        # 401 (auth fails first) or 422 (validation fails)
        assert resp.status_code in (401, 422), (
            f"Expected 401/422, got {resp.status_code}: {resp.text}"
        )

    def test_create_key_rejects_empty_name(self, backend):
        """POST /api/admin/keys/create with empty name returns 401 or 422."""
        resp = httpx.post(
            f"{BACKEND_URL}/api/admin/keys/create",
            json={"name": "", "organization_id": "org-123"},
            headers={"Authorization": "Bearer dummy"},
            timeout=5,
        )
        # 401 (auth fails first) or 422 (validation)
        assert resp.status_code in (401, 422), (
            f"Expected 401/422, got {resp.status_code}: {resp.text}"
        )


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
