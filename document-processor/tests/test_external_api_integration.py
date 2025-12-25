"""
Integration Tests for External API (No Mocks)

Tests the actual API behavior against real code paths.
These tests verify the code works correctly without mocking.
"""

import pytest
import io
import hashlib
from datetime import datetime, timedelta
from fastapi.testclient import TestClient

import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))

from app.main import app
from app.middleware.api_auth import APIKeyAuth
from app.middleware.admin_auth import AdminAuth
from app.services.webhook_service import WebhookService
from app.routers.api_keys_admin import generate_api_key

client = TestClient(app)


# ============================================================================
# API Key Generation Tests (Pure Logic, No DB)
# ============================================================================

class TestAPIKeyGenerationLogic:
    """Test API key generation - pure logic, no database needed."""

    def test_generate_key_returns_three_values(self):
        """generate_api_key returns tuple of (key, hash, prefix)."""
        result = generate_api_key()

        assert isinstance(result, tuple)
        assert len(result) == 3

    def test_generated_key_starts_with_prefix(self):
        """Generated key starts with 'ftxt_'."""
        full_key, key_hash, key_prefix = generate_api_key()

        assert full_key.startswith('ftxt_')

    def test_generated_hash_matches_key(self):
        """Hash is correct SHA-256 of the key."""
        full_key, key_hash, key_prefix = generate_api_key()

        expected_hash = hashlib.sha256(full_key.encode()).hexdigest()
        assert key_hash == expected_hash

    def test_prefix_is_first_12_chars(self):
        """Prefix is first 12 characters of the key."""
        full_key, key_hash, key_prefix = generate_api_key()

        assert key_prefix == full_key[:12]

    def test_keys_are_unique(self):
        """Each generation produces unique keys."""
        keys = set()
        for _ in range(100):
            full_key, _, _ = generate_api_key()
            keys.add(full_key)

        assert len(keys) == 100  # All unique


# ============================================================================
# Webhook Signature Tests (Pure Logic, No Network)
# ============================================================================

class TestWebhookSignatureLogic:
    """Test webhook signature generation - pure logic, no network needed."""

    def test_signature_format(self):
        """Signature has correct format 'sha256=...'."""
        service = WebhookService()

        signature = service._generate_signature(
            payload={'test': 'data'},
            secret='my-secret',
            timestamp='2025-01-01T00:00:00'
        )

        assert signature.startswith('sha256=')
        # SHA-256 hex is 64 chars
        assert len(signature) == 7 + 64

    def test_signature_is_deterministic(self):
        """Same inputs produce same signature."""
        service = WebhookService()

        sig1 = service._generate_signature({'a': 1}, 'secret', '2025-01-01T00:00:00')
        sig2 = service._generate_signature({'a': 1}, 'secret', '2025-01-01T00:00:00')

        assert sig1 == sig2

    def test_different_payloads_different_signatures(self):
        """Different payloads produce different signatures."""
        service = WebhookService()

        sig1 = service._generate_signature({'a': 1}, 'secret', '2025-01-01T00:00:00')
        sig2 = service._generate_signature({'a': 2}, 'secret', '2025-01-01T00:00:00')

        assert sig1 != sig2

    def test_different_timestamps_different_signatures(self):
        """Different timestamps produce different signatures (replay protection)."""
        service = WebhookService()

        sig1 = service._generate_signature({'a': 1}, 'secret', '2025-01-01T00:00:00')
        sig2 = service._generate_signature({'a': 1}, 'secret', '2025-01-01T00:00:01')

        assert sig1 != sig2

    def test_verify_valid_signature(self):
        """verify_signature returns True for valid signature."""
        service = WebhookService()
        payload = {'job_id': '123', 'status': 'completed'}
        secret = 'webhook-secret'
        timestamp = '2025-01-01T12:00:00'

        signature = service._generate_signature(payload, secret, timestamp)

        result = WebhookService.verify_signature(payload, secret, timestamp, signature)
        assert result is True

    def test_verify_invalid_signature(self):
        """verify_signature returns False for invalid signature."""
        result = WebhookService.verify_signature(
            {'job_id': '123'},
            'secret',
            '2025-01-01T00:00:00',
            'sha256=invalid_signature_here'
        )
        assert result is False

    def test_verify_wrong_secret_fails(self):
        """verify_signature fails with wrong secret."""
        service = WebhookService()
        payload = {'test': 'data'}
        timestamp = '2025-01-01T00:00:00'

        signature = service._generate_signature(payload, 'correct-secret', timestamp)

        result = WebhookService.verify_signature(payload, 'wrong-secret', timestamp, signature)
        assert result is False

    def test_verify_tampered_payload_fails(self):
        """verify_signature fails with tampered payload."""
        service = WebhookService()
        original = {'amount': 100}
        tampered = {'amount': 1000000}
        secret = 'secret'
        timestamp = '2025-01-01T00:00:00'

        signature = service._generate_signature(original, secret, timestamp)

        result = WebhookService.verify_signature(tampered, secret, timestamp, signature)
        assert result is False


# ============================================================================
# API Key Auth Logic Tests (No DB)
# ============================================================================

class TestAPIKeyAuthLogic:
    """Test API key auth logic - validation without database."""

    def test_api_key_prefix_constant(self):
        """API key prefix is correctly defined."""
        auth = APIKeyAuth()
        assert auth.API_KEY_PREFIX == 'ftxt_'

    def test_has_permission_with_granted(self):
        """has_permission returns True when permission granted."""
        auth = APIKeyAuth()
        context = {'permissions': {'upload': True, 'process': True}}

        assert auth.has_permission(context, 'upload') is True
        assert auth.has_permission(context, 'process') is True

    def test_has_permission_with_missing(self):
        """has_permission returns False when permission not in dict."""
        auth = APIKeyAuth()
        context = {'permissions': {'upload': True}}

        assert auth.has_permission(context, 'admin') is False
        assert auth.has_permission(context, 'delete') is False

    def test_has_permission_with_explicit_false(self):
        """has_permission returns False when permission explicitly False."""
        auth = APIKeyAuth()
        context = {'permissions': {'upload': True, 'admin': False}}

        assert auth.has_permission(context, 'admin') is False

    def test_has_permission_empty_permissions(self):
        """has_permission handles empty permissions dict."""
        auth = APIKeyAuth()
        context = {'permissions': {}}

        assert auth.has_permission(context, 'anything') is False

    def test_has_permission_missing_key(self):
        """has_permission handles missing permissions key."""
        auth = APIKeyAuth()
        context = {}

        assert auth.has_permission(context, 'anything') is False

    def test_rate_limit_headers_format(self):
        """Rate limit headers have correct format."""
        auth = APIKeyAuth()
        reset_time = datetime(2025, 1, 1, 12, 30, 0)

        headers = auth._build_rate_limit_headers(60, 45, reset_time)

        assert headers['X-RateLimit-Limit'] == '60'
        assert headers['X-RateLimit-Remaining'] == '45'
        assert '2025-01-01' in headers['X-RateLimit-Reset']
        assert '12:30' in headers['X-RateLimit-Reset']


# ============================================================================
# Admin Auth Logic Tests (No DB)
# ============================================================================

class TestAdminAuthLogic:
    """Test admin auth logic - JWT parsing without database."""

    def test_jwt_algorithms_configured(self):
        """JWT algorithms are properly configured."""
        auth = AdminAuth()
        assert 'HS256' in auth.jwt_algorithms

    @pytest.mark.asyncio
    async def test_rejects_missing_auth_header(self):
        """Rejects request with missing Authorization header."""
        auth = AdminAuth()

        from fastapi import HTTPException
        with pytest.raises(HTTPException) as exc_info:
            await auth.get_current_user(None)

        assert exc_info.value.status_code == 401
        assert 'Authorization header required' in exc_info.value.detail

    @pytest.mark.asyncio
    async def test_rejects_non_bearer_scheme(self):
        """Rejects non-Bearer authorization scheme."""
        auth = AdminAuth()

        from fastapi import HTTPException
        with pytest.raises(HTTPException) as exc_info:
            await auth.get_current_user("Basic dXNlcjpwYXNz")

        assert exc_info.value.status_code == 401
        assert 'Invalid authorization header format' in exc_info.value.detail

    @pytest.mark.asyncio
    async def test_rejects_malformed_bearer(self):
        """Rejects malformed Bearer token (no space)."""
        auth = AdminAuth()

        from fastapi import HTTPException
        with pytest.raises(HTTPException) as exc_info:
            await auth.get_current_user("BearerTokenWithNoSpace")

        assert exc_info.value.status_code == 401


# ============================================================================
# HTTP Endpoint Tests (Real Routes, No Auth Bypass)
# ============================================================================

class TestAPIV1HealthEndpoint:
    """Test /api/v1/health endpoint - no auth required."""

    def test_health_returns_200(self):
        """Health endpoint returns 200."""
        response = client.get("/api/v1/health")
        assert response.status_code == 200

    def test_health_response_structure(self):
        """Health response has expected structure."""
        response = client.get("/api/v1/health")
        data = response.json()

        assert 'status' in data
        assert 'api_version' in data
        assert 'database' in data
        assert 'timestamp' in data

    def test_health_status_is_healthy(self):
        """Health status reports healthy."""
        response = client.get("/api/v1/health")
        data = response.json()

        assert data['status'] == 'healthy'
        assert data['api_version'] == 'v1'


class TestAPIV1AuthenticationRequired:
    """Test that protected endpoints require authentication."""

    def test_process_requires_auth(self):
        """POST /api/v1/process requires authentication."""
        test_file = io.BytesIO(b"test content")
        response = client.post(
            "/api/v1/process",
            files={"file": ("test.pdf", test_file, "application/pdf")}
        )

        # Should fail with 401 or 403 (not 200 or 500)
        assert response.status_code in [401, 403]

    def test_jobs_requires_auth(self):
        """GET /api/v1/jobs/{id} requires authentication."""
        response = client.get("/api/v1/jobs/some-job-id")

        assert response.status_code in [401, 403]

    def test_templates_requires_auth(self):
        """GET /api/v1/templates requires authentication."""
        response = client.get("/api/v1/templates")

        assert response.status_code in [401, 403]


class TestAPIV1InvalidAPIKey:
    """Test API rejects invalid API keys."""

    def test_rejects_key_without_prefix(self):
        """Rejects API key without 'ftxt_' prefix."""
        response = client.get(
            "/api/v1/jobs/test-job",
            headers={"Authorization": "Bearer invalid_key_no_prefix"}
        )

        assert response.status_code == 401
        assert 'ftxt_' in response.json().get('detail', '')

    def test_rejects_empty_bearer_token(self):
        """Rejects empty Bearer token."""
        response = client.get(
            "/api/v1/jobs/test-job",
            headers={"Authorization": "Bearer "}
        )

        assert response.status_code in [401, 403, 422]


class TestAdminAPIAuthenticationRequired:
    """Test that admin API endpoints require authentication."""

    def test_create_key_requires_auth(self):
        """POST /api/admin/keys/create requires authentication."""
        response = client.post(
            "/api/admin/keys/create",
            json={"name": "Test", "organization_id": "org-123"}
        )

        assert response.status_code == 401

    def test_list_keys_requires_auth(self):
        """GET /api/admin/keys/list/{org} requires authentication."""
        response = client.get("/api/admin/keys/list/org-123")

        assert response.status_code == 401

    def test_get_key_requires_auth(self):
        """GET /api/admin/keys/{id} requires authentication."""
        response = client.get("/api/admin/keys/key-123")

        assert response.status_code == 401

    def test_update_key_requires_auth(self):
        """PATCH /api/admin/keys/{id} requires authentication."""
        response = client.patch(
            "/api/admin/keys/key-123",
            json={"name": "Updated"}
        )

        assert response.status_code == 401

    def test_revoke_key_requires_auth(self):
        """DELETE /api/admin/keys/{id}/revoke requires authentication."""
        response = client.delete("/api/admin/keys/key-123/revoke")

        assert response.status_code == 401

    def test_delete_key_requires_auth(self):
        """DELETE /api/admin/keys/{id} requires authentication."""
        response = client.delete("/api/admin/keys/key-123")

        assert response.status_code == 401

    def test_usage_requires_auth(self):
        """GET /api/admin/keys/{id}/usage requires authentication."""
        response = client.get("/api/admin/keys/key-123/usage")

        assert response.status_code == 401


# ============================================================================
# Webhook Service Configuration Tests
# ============================================================================

class TestWebhookServiceConfig:
    """Test webhook service configuration."""

    def test_default_timeout_is_30(self):
        """Default timeout is 30 seconds."""
        service = WebhookService()
        assert service.default_timeout == 30

    def test_default_max_retries_is_3(self):
        """Default max retries is 3."""
        service = WebhookService()
        assert service.default_max_retries == 3

    def test_custom_timeout(self):
        """Can configure custom timeout."""
        service = WebhookService(default_timeout=60)
        assert service.default_timeout == 60

    def test_custom_max_retries(self):
        """Can configure custom max retries."""
        service = WebhookService(default_max_retries=5)
        assert service.default_max_retries == 5


# ============================================================================
# Request Validation Tests
# ============================================================================

class TestRequestValidation:
    """Test request validation on admin endpoints."""

    def test_create_key_validates_name_required(self):
        """Create key requires name field."""
        # Even without auth, validation should fail first or auth fails
        response = client.post(
            "/api/admin/keys/create",
            json={"organization_id": "org-123"}  # Missing name
        )

        # Either 401 (auth first) or 422 (validation)
        assert response.status_code in [401, 422]

    def test_create_key_validates_org_required(self):
        """Create key requires organization_id field."""
        response = client.post(
            "/api/admin/keys/create",
            json={"name": "Test Key"}  # Missing organization_id
        )

        assert response.status_code in [401, 422]
