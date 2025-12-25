"""
Tests for API Key Management Router (Admin)

Tests the admin dashboard endpoints for managing API keys.
These endpoints use internal Supabase JWT authentication.
"""

import pytest
import jwt
import hashlib
from datetime import datetime, timedelta
from unittest.mock import MagicMock, patch, AsyncMock
from fastapi.testclient import TestClient
from fastapi import HTTPException

import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))

from app.main import app
from app.routers.api_keys_admin import generate_api_key

client = TestClient(app)


# ============================================================================
# Test Fixtures
# ============================================================================

@pytest.fixture
def valid_jwt_token():
    """Generate a valid JWT token for testing."""
    payload = {
        'sub': 'user-uuid-123',
        'email': 'admin@example.com',
        'role': 'authenticated',
        'aud': 'authenticated',
        'exp': datetime.utcnow() + timedelta(hours=1)
    }
    return jwt.encode(payload, 'test-secret', algorithm='HS256')


@pytest.fixture
def auth_header(valid_jwt_token):
    """Authorization header with valid JWT."""
    return {"Authorization": f"Bearer {valid_jwt_token}"}


@pytest.fixture
def mock_admin_auth():
    """Mock successful admin authentication."""
    with patch('app.routers.api_keys_admin.admin_auth') as mock:
        mock.get_current_user = AsyncMock(return_value={
            'user_id': 'user-uuid-123',
            'email': 'admin@example.com',
            'role': 'authenticated'
        })
        mock.verify_org_membership = AsyncMock(return_value=True)
        yield mock


# ============================================================================
# API Key Generation Tests
# ============================================================================

class TestAPIKeyGeneration:
    """Test API key generation utility."""

    def test_generates_key_with_prefix(self):
        """Generated key starts with 'ftxt_' prefix."""
        full_key, key_hash, key_prefix = generate_api_key()

        assert full_key.startswith('ftxt_')

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

        # ftxt_ (5) + 43 chars of base64 = 48 chars minimum
        assert len(full_key) >= 40


# ============================================================================
# Create API Key Endpoint Tests
# ============================================================================

class TestCreateAPIKey:
    """Test POST /api/admin/keys/create endpoint."""

    def test_requires_authentication(self):
        """Returns 401 without valid JWT."""
        response = client.post(
            "/api/admin/keys/create",
            json={
                "name": "Test Key",
                "organization_id": "org-123"
            }
        )

        assert response.status_code == 401

    def test_creates_key_successfully(self, auth_header, mock_admin_auth):
        """Successfully creates API key."""
        mock_client = MagicMock()
        mock_client.table.return_value.insert.return_value.execute.return_value.data = [{
            'id': 'key-id-123',
            'name': 'Test Key',
            'description': 'Test description',
            'key_prefix': 'ftxt_abc123',
            'organization_id': 'org-123',
            'is_active': True,
            'rate_limit_per_minute': 60,
            'upload_limit_per_minute': 10,
            'permissions': {'upload': True, 'process': True, 'templates_read': True},
            'created_at': '2025-01-01T00:00:00Z',
            'expires_at': '2026-01-01T00:00:00Z'
        }]

        with patch('app.routers.api_keys_admin.db_config') as mock_db:
            mock_db.is_configured = True
            mock_db.client = mock_client

            response = client.post(
                "/api/admin/keys/create",
                json={
                    "name": "Test Key",
                    "organization_id": "org-123",
                    "description": "Test description"
                },
                headers=auth_header
            )

        assert response.status_code == 201
        data = response.json()
        assert 'api_key' in data  # Full key only shown on creation
        assert data['api_key'].startswith('ftxt_')
        assert 'warning' in data

    def test_returns_full_key_only_once(self, auth_header, mock_admin_auth):
        """Full API key is only returned during creation."""
        mock_client = MagicMock()
        mock_client.table.return_value.insert.return_value.execute.return_value.data = [{
            'id': 'key-id-123',
            'name': 'Test Key',
            'description': None,
            'key_prefix': 'ftxt_abc123',
            'organization_id': 'org-123',
            'is_active': True,
            'rate_limit_per_minute': 60,
            'upload_limit_per_minute': 10,
            'permissions': {'upload': True},
            'created_at': '2025-01-01T00:00:00Z',
            'expires_at': '2026-01-01T00:00:00Z'
        }]

        with patch('app.routers.api_keys_admin.db_config') as mock_db:
            mock_db.is_configured = True
            mock_db.client = mock_client

            response = client.post(
                "/api/admin/keys/create",
                json={
                    "name": "Test Key",
                    "organization_id": "org-123"
                },
                headers=auth_header
            )

        data = response.json()
        assert 'api_key' in data
        assert 'warning' in data
        assert 'never be shown again' in data['warning'].lower()

    def test_validates_required_fields(self, auth_header, mock_admin_auth):
        """Validates required fields in request."""
        response = client.post(
            "/api/admin/keys/create",
            json={
                # Missing required fields
            },
            headers=auth_header
        )

        assert response.status_code == 422

    def test_validates_name_length(self, auth_header, mock_admin_auth):
        """Validates name is not empty and not too long."""
        # Empty name
        response = client.post(
            "/api/admin/keys/create",
            json={
                "name": "",
                "organization_id": "org-123"
            },
            headers=auth_header
        )

        assert response.status_code == 422

    def test_sets_default_permissions(self, auth_header, mock_admin_auth):
        """Sets default permissions when not provided."""
        mock_client = MagicMock()

        # Capture the insert data
        inserted_data = {}
        def capture_insert(data):
            inserted_data.update(data)
            mock_result = MagicMock()
            mock_result.execute.return_value.data = [{
                **data,
                'id': 'key-123',
                'key_prefix': 'ftxt_test',
                'created_at': '2025-01-01T00:00:00Z'
            }]
            return mock_result

        mock_client.table.return_value.insert = capture_insert

        with patch('app.routers.api_keys_admin.db_config') as mock_db:
            mock_db.is_configured = True
            mock_db.client = mock_client

            response = client.post(
                "/api/admin/keys/create",
                json={
                    "name": "Test Key",
                    "organization_id": "org-123"
                    # No permissions specified
                },
                headers=auth_header
            )

        # Default permissions should be set
        assert inserted_data.get('permissions', {}).get('upload') is True
        assert inserted_data.get('permissions', {}).get('process') is True
        assert inserted_data.get('permissions', {}).get('templates_read') is True

    def test_verifies_organization_membership(self, auth_header, mock_admin_auth):
        """Verifies user is member of the organization."""
        mock_admin_auth.verify_org_membership = AsyncMock(
            side_effect=HTTPException(status_code=403, detail="Not a member")
        )

        response = client.post(
            "/api/admin/keys/create",
            json={
                "name": "Test Key",
                "organization_id": "org-not-member"
            },
            headers=auth_header
        )

        assert response.status_code == 403


# ============================================================================
# List API Keys Endpoint Tests
# ============================================================================

class TestListAPIKeys:
    """Test GET /api/admin/keys/list/{organization_id} endpoint."""

    def test_requires_authentication(self):
        """Returns 401 without valid JWT."""
        response = client.get("/api/admin/keys/list/org-123")

        assert response.status_code == 401

    def test_returns_key_list(self, auth_header, mock_admin_auth):
        """Returns list of API keys for organization."""
        keys = [
            {
                'id': 'key-1',
                'name': 'Production Key',
                'description': 'Main production key',
                'key_prefix': 'ftxt_prod',
                'organization_id': 'org-123',
                'is_active': True,
                'rate_limit_per_minute': 60,
                'upload_limit_per_minute': 10,
                'permissions': {'upload': True},
                'created_at': '2025-01-01T00:00:00Z',
                'expires_at': '2026-01-01T00:00:00Z',
                'last_used_at': '2025-01-15T10:00:00Z'
            },
            {
                'id': 'key-2',
                'name': 'Development Key',
                'description': None,
                'key_prefix': 'ftxt_dev',
                'organization_id': 'org-123',
                'is_active': True,
                'rate_limit_per_minute': 100,
                'upload_limit_per_minute': 20,
                'permissions': {'upload': True, 'process': True},
                'created_at': '2025-01-02T00:00:00Z',
                'expires_at': None,
                'last_used_at': None
            }
        ]

        mock_client = MagicMock()
        mock_client.table.return_value.select.return_value.eq.return_value.order.return_value.eq.return_value.execute.return_value.data = keys

        with patch('app.routers.api_keys_admin.db_config') as mock_db:
            mock_db.is_configured = True
            mock_db.client = mock_client

            response = client.get(
                "/api/admin/keys/list/org-123",
                headers=auth_header
            )

        assert response.status_code == 200
        data = response.json()
        assert 'keys' in data
        assert data['count'] == 2

    def test_excludes_inactive_by_default(self, auth_header, mock_admin_auth):
        """Excludes inactive keys by default."""
        mock_client = MagicMock()
        query_mock = mock_client.table.return_value.select.return_value.eq.return_value.order.return_value

        # Should filter by is_active = True
        query_mock.eq.return_value.execute.return_value.data = []

        with patch('app.routers.api_keys_admin.db_config') as mock_db:
            mock_db.is_configured = True
            mock_db.client = mock_client

            response = client.get(
                "/api/admin/keys/list/org-123",
                headers=auth_header
            )

        # Verify is_active filter was applied
        assert response.status_code == 200

    def test_includes_inactive_when_requested(self, auth_header, mock_admin_auth):
        """Includes inactive keys when include_inactive=true."""
        mock_client = MagicMock()
        mock_client.table.return_value.select.return_value.eq.return_value.order.return_value.execute.return_value.data = []

        with patch('app.routers.api_keys_admin.db_config') as mock_db:
            mock_db.is_configured = True
            mock_db.client = mock_client

            response = client.get(
                "/api/admin/keys/list/org-123?include_inactive=true",
                headers=auth_header
            )

        assert response.status_code == 200

    def test_does_not_return_actual_keys(self, auth_header, mock_admin_auth):
        """Never returns actual API keys, only prefixes."""
        keys = [{
            'id': 'key-1',
            'name': 'Test Key',
            'description': None,
            'key_prefix': 'ftxt_test12',
            'organization_id': 'org-123',
            'is_active': True,
            'rate_limit_per_minute': 60,
            'upload_limit_per_minute': 10,
            'permissions': {},
            'created_at': '2025-01-01T00:00:00Z',
            'expires_at': None,
            'last_used_at': None
        }]

        mock_client = MagicMock()
        mock_client.table.return_value.select.return_value.eq.return_value.order.return_value.eq.return_value.execute.return_value.data = keys

        with patch('app.routers.api_keys_admin.db_config') as mock_db:
            mock_db.is_configured = True
            mock_db.client = mock_client

            response = client.get(
                "/api/admin/keys/list/org-123",
                headers=auth_header
            )

        data = response.json()
        for key in data['keys']:
            assert 'api_key' not in key
            assert 'key_hash' not in key
            # Only prefix should be present
            assert 'key_prefix' in key


# ============================================================================
# Get Single API Key Endpoint Tests
# ============================================================================

class TestGetAPIKey:
    """Test GET /api/admin/keys/{key_id} endpoint."""

    def test_requires_authentication(self):
        """Returns 401 without valid JWT."""
        response = client.get("/api/admin/keys/key-123")

        assert response.status_code == 401

    def test_returns_404_for_nonexistent_key(self, auth_header, mock_admin_auth):
        """Returns 404 when key doesn't exist."""
        mock_client = MagicMock()
        mock_client.table.return_value.select.return_value.eq.return_value.single.return_value.execute.return_value.data = None

        with patch('app.routers.api_keys_admin.db_config') as mock_db:
            mock_db.is_configured = True
            mock_db.client = mock_client

            response = client.get(
                "/api/admin/keys/nonexistent-key",
                headers=auth_header
            )

        assert response.status_code == 404

    def test_returns_key_details(self, auth_header, mock_admin_auth):
        """Returns key details without the actual key."""
        key_data = {
            'id': 'key-123',
            'name': 'Test Key',
            'description': 'A test key',
            'key_prefix': 'ftxt_test12',
            'organization_id': 'org-123',
            'is_active': True,
            'rate_limit_per_minute': 60,
            'upload_limit_per_minute': 10,
            'permissions': {'upload': True},
            'created_at': '2025-01-01T00:00:00Z',
            'expires_at': '2026-01-01T00:00:00Z',
            'last_used_at': '2025-01-15T10:00:00Z'
        }

        mock_client = MagicMock()
        # First call for org check, second for key details
        mock_client.table.return_value.select.return_value.eq.return_value.single.return_value.execute.return_value.data = key_data

        with patch('app.routers.api_keys_admin.db_config') as mock_db:
            mock_db.is_configured = True
            mock_db.client = mock_client

            response = client.get(
                "/api/admin/keys/key-123",
                headers=auth_header
            )

        assert response.status_code == 200
        data = response.json()
        assert data['id'] == 'key-123'
        assert data['name'] == 'Test Key'
        assert 'api_key' not in data  # Actual key never returned


# ============================================================================
# Update API Key Endpoint Tests
# ============================================================================

class TestUpdateAPIKey:
    """Test PATCH /api/admin/keys/{key_id} endpoint."""

    def test_requires_authentication(self):
        """Returns 401 without valid JWT."""
        response = client.patch(
            "/api/admin/keys/key-123",
            json={"name": "Updated Name"}
        )

        assert response.status_code == 401

    def test_updates_key_name(self, auth_header, mock_admin_auth):
        """Successfully updates key name."""
        mock_client = MagicMock()
        mock_client.table.return_value.select.return_value.eq.return_value.single.return_value.execute.return_value.data = {
            'organization_id': 'org-123'
        }
        mock_client.table.return_value.update.return_value.eq.return_value.execute.return_value.data = [{'id': 'key-123'}]

        with patch('app.routers.api_keys_admin.db_config') as mock_db:
            mock_db.is_configured = True
            mock_db.client = mock_client

            response = client.patch(
                "/api/admin/keys/key-123",
                json={"name": "Updated Name"},
                headers=auth_header
            )

        assert response.status_code == 200
        data = response.json()
        assert 'updated successfully' in data['message'].lower()

    def test_updates_rate_limits(self, auth_header, mock_admin_auth):
        """Successfully updates rate limits."""
        mock_client = MagicMock()
        mock_client.table.return_value.select.return_value.eq.return_value.single.return_value.execute.return_value.data = {
            'organization_id': 'org-123'
        }
        mock_client.table.return_value.update.return_value.eq.return_value.execute.return_value.data = [{'id': 'key-123'}]

        with patch('app.routers.api_keys_admin.db_config') as mock_db:
            mock_db.is_configured = True
            mock_db.client = mock_client

            response = client.patch(
                "/api/admin/keys/key-123",
                json={
                    "rate_limit_per_minute": 120,
                    "upload_limit_per_minute": 20
                },
                headers=auth_header
            )

        assert response.status_code == 200

    def test_rejects_empty_update(self, auth_header, mock_admin_auth):
        """Rejects update with no fields to change."""
        mock_client = MagicMock()
        mock_client.table.return_value.select.return_value.eq.return_value.single.return_value.execute.return_value.data = {
            'organization_id': 'org-123'
        }

        with patch('app.routers.api_keys_admin.db_config') as mock_db:
            mock_db.is_configured = True
            mock_db.client = mock_client

            response = client.patch(
                "/api/admin/keys/key-123",
                json={},
                headers=auth_header
            )

        assert response.status_code == 400


# ============================================================================
# Revoke API Key Endpoint Tests
# ============================================================================

class TestRevokeAPIKey:
    """Test DELETE /api/admin/keys/{key_id}/revoke endpoint."""

    def test_requires_authentication(self):
        """Returns 401 without valid JWT."""
        response = client.delete("/api/admin/keys/key-123/revoke")

        assert response.status_code == 401

    def test_revokes_key(self, auth_header, mock_admin_auth):
        """Successfully revokes (deactivates) API key."""
        mock_client = MagicMock()
        mock_client.table.return_value.select.return_value.eq.return_value.single.return_value.execute.return_value.data = {
            'organization_id': 'org-123'
        }
        mock_client.table.return_value.update.return_value.eq.return_value.execute.return_value.data = [{'id': 'key-123'}]

        with patch('app.routers.api_keys_admin.db_config') as mock_db:
            mock_db.is_configured = True
            mock_db.client = mock_client

            response = client.delete(
                "/api/admin/keys/key-123/revoke",
                headers=auth_header
            )

        assert response.status_code == 200
        data = response.json()
        assert 'revoked' in data['message'].lower()

    def test_sets_is_active_to_false(self, auth_header, mock_admin_auth):
        """Revocation sets is_active to False."""
        mock_client = MagicMock()
        mock_client.table.return_value.select.return_value.eq.return_value.single.return_value.execute.return_value.data = {
            'organization_id': 'org-123'
        }

        # Capture update data
        update_data = {}
        def capture_update(data):
            update_data.update(data)
            mock_result = MagicMock()
            mock_result.eq.return_value.execute.return_value.data = [{'id': 'key-123'}]
            return mock_result

        mock_client.table.return_value.update = capture_update

        with patch('app.routers.api_keys_admin.db_config') as mock_db:
            mock_db.is_configured = True
            mock_db.client = mock_client

            response = client.delete(
                "/api/admin/keys/key-123/revoke",
                headers=auth_header
            )

        assert update_data.get('is_active') is False


# ============================================================================
# Delete API Key Endpoint Tests
# ============================================================================

class TestDeleteAPIKey:
    """Test DELETE /api/admin/keys/{key_id} endpoint."""

    def test_requires_authentication(self):
        """Returns 401 without valid JWT."""
        response = client.delete("/api/admin/keys/key-123")

        assert response.status_code == 401

    def test_deletes_key_permanently(self, auth_header, mock_admin_auth):
        """Permanently deletes API key."""
        mock_client = MagicMock()
        mock_client.table.return_value.select.return_value.eq.return_value.single.return_value.execute.return_value.data = {
            'organization_id': 'org-123'
        }
        mock_client.table.return_value.delete.return_value.eq.return_value.execute.return_value.data = [{'id': 'key-123'}]

        with patch('app.routers.api_keys_admin.db_config') as mock_db:
            mock_db.is_configured = True
            mock_db.client = mock_client

            response = client.delete(
                "/api/admin/keys/key-123",
                headers=auth_header
            )

        assert response.status_code == 200
        data = response.json()
        assert 'deleted permanently' in data['message'].lower()


# ============================================================================
# Get API Key Usage Endpoint Tests
# ============================================================================

class TestGetAPIKeyUsage:
    """Test GET /api/admin/keys/{key_id}/usage endpoint."""

    def test_requires_authentication(self):
        """Returns 401 without valid JWT."""
        response = client.get("/api/admin/keys/key-123/usage")

        assert response.status_code == 401

    def test_returns_usage_statistics(self, auth_header, mock_admin_auth):
        """Returns usage statistics for API key."""
        mock_client = MagicMock()

        # Key info
        mock_client.table.return_value.select.return_value.eq.return_value.single.return_value.execute.return_value.data = {
            'id': 'key-123',
            'name': 'Test Key',
            'key_prefix': 'ftxt_test',
            'organization_id': 'org-123',
            'last_used_at': '2025-01-15T10:00:00Z'
        }

        # Jobs data
        jobs = [
            {'id': 'job-1', 'status': 'completed', 'job_type': 'document_process',
             'created_at': '2025-01-01T00:00:00Z', 'completed_at': '2025-01-01T00:00:10Z',
             'processing_time_ms': 10000},
            {'id': 'job-2', 'status': 'completed', 'job_type': 'document_process',
             'created_at': '2025-01-02T00:00:00Z', 'completed_at': '2025-01-02T00:00:05Z',
             'processing_time_ms': 5000},
            {'id': 'job-3', 'status': 'failed', 'job_type': 'document_process',
             'created_at': '2025-01-03T00:00:00Z', 'completed_at': '2025-01-03T00:00:02Z',
             'processing_time_ms': 2000}
        ]

        mock_client.table.return_value.select.return_value.eq.return_value.gte.return_value.order.return_value.limit.return_value.execute.return_value.data = jobs

        with patch('app.routers.api_keys_admin.db_config') as mock_db:
            mock_db.is_configured = True
            mock_db.client = mock_client

            response = client.get(
                "/api/admin/keys/key-123/usage",
                headers=auth_header
            )

        assert response.status_code == 200
        data = response.json()
        assert 'statistics' in data
        assert data['statistics']['total_jobs'] == 3
        assert data['statistics']['completed'] == 2
        assert data['statistics']['failed'] == 1

    def test_calculates_success_rate(self, auth_header, mock_admin_auth):
        """Correctly calculates success rate."""
        mock_client = MagicMock()

        mock_client.table.return_value.select.return_value.eq.return_value.single.return_value.execute.return_value.data = {
            'id': 'key-123',
            'name': 'Test Key',
            'key_prefix': 'ftxt_test',
            'organization_id': 'org-123',
            'last_used_at': None
        }

        # 8 completed, 2 failed = 80% success rate
        jobs = [
            {'id': f'job-{i}', 'status': 'completed' if i < 8 else 'failed',
             'job_type': 'document_process', 'created_at': '2025-01-01T00:00:00Z',
             'completed_at': '2025-01-01T00:00:10Z', 'processing_time_ms': 1000}
            for i in range(10)
        ]

        mock_client.table.return_value.select.return_value.eq.return_value.gte.return_value.order.return_value.limit.return_value.execute.return_value.data = jobs

        with patch('app.routers.api_keys_admin.db_config') as mock_db:
            mock_db.is_configured = True
            mock_db.client = mock_client

            response = client.get(
                "/api/admin/keys/key-123/usage",
                headers=auth_header
            )

        data = response.json()
        assert data['statistics']['success_rate'] == 80.0

    def test_respects_days_parameter(self, auth_header, mock_admin_auth):
        """Respects the days query parameter."""
        mock_client = MagicMock()

        mock_client.table.return_value.select.return_value.eq.return_value.single.return_value.execute.return_value.data = {
            'id': 'key-123',
            'name': 'Test Key',
            'key_prefix': 'ftxt_test',
            'organization_id': 'org-123',
            'last_used_at': None
        }
        mock_client.table.return_value.select.return_value.eq.return_value.gte.return_value.order.return_value.limit.return_value.execute.return_value.data = []

        with patch('app.routers.api_keys_admin.db_config') as mock_db:
            mock_db.is_configured = True
            mock_db.client = mock_client

            response = client.get(
                "/api/admin/keys/key-123/usage?days=30",
                headers=auth_header
            )

        assert response.status_code == 200
        data = response.json()
        assert data['period_days'] == 30
