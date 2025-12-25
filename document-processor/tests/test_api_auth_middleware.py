"""
Tests for API Key Authentication Middleware

Tests the third-party API key validation, rate limiting, and permission checking.
"""

import pytest
import hashlib
from datetime import datetime, timedelta, timezone
from unittest.mock import MagicMock, patch, AsyncMock
from fastapi import HTTPException
from fastapi.security import HTTPAuthorizationCredentials

import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))

from app.middleware.api_auth import APIKeyAuth, api_key_auth


class TestAPIKeyFormat:
    """Test API key format validation."""

    @pytest.mark.asyncio
    async def test_rejects_key_without_prefix(self):
        """API key must start with 'ftxt_' prefix."""
        auth = APIKeyAuth()
        credentials = HTTPAuthorizationCredentials(
            scheme="Bearer",
            credentials="invalid_key_without_prefix"
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
            credentials=""
        )

        with pytest.raises(HTTPException) as exc_info:
            await auth.verify_api_key(credentials)

        assert exc_info.value.status_code == 401

    @pytest.mark.asyncio
    async def test_accepts_valid_prefix(self):
        """Key with valid prefix proceeds to database lookup."""
        auth = APIKeyAuth()
        credentials = HTTPAuthorizationCredentials(
            scheme="Bearer",
            credentials="ftxt_validkey123"
        )

        # Mock database to return no results (key not found)
        with patch.object(auth, '_lookup_key_in_db', new_callable=AsyncMock) as mock_lookup:
            mock_lookup.side_effect = HTTPException(status_code=401, detail="Invalid API key")

            with pytest.raises(HTTPException) as exc_info:
                await auth.verify_api_key(credentials)

            # Should fail with "Invalid API key" not "Invalid format"
            assert "Invalid API key" in exc_info.value.detail


class TestAPIKeyDatabaseLookup:
    """Test API key database verification."""

    @pytest.mark.asyncio
    async def test_returns_503_when_database_unavailable(self):
        """Returns 503 when database is not configured."""
        auth = APIKeyAuth()
        credentials = HTTPAuthorizationCredentials(
            scheme="Bearer",
            credentials="ftxt_validkey123"
        )

        with patch('app.middleware.api_auth.db_config') as mock_db:
            mock_db.is_configured = False
            mock_db.client = None

            with pytest.raises(HTTPException) as exc_info:
                await auth.verify_api_key(credentials)

            assert exc_info.value.status_code == 503
            assert "unavailable" in exc_info.value.detail.lower()

    @pytest.mark.asyncio
    async def test_returns_401_when_key_not_found(self):
        """Returns 401 when API key is not in database."""
        auth = APIKeyAuth()
        credentials = HTTPAuthorizationCredentials(
            scheme="Bearer",
            credentials="ftxt_nonexistentkey"
        )

        mock_client = MagicMock()
        mock_client.table.return_value.select.return_value.eq.return_value.execute.return_value.data = []

        with patch('app.middleware.api_auth.db_config') as mock_db:
            mock_db.is_configured = True
            mock_db.client = mock_client

            with pytest.raises(HTTPException) as exc_info:
                await auth.verify_api_key(credentials)

            assert exc_info.value.status_code == 401
            assert "Invalid API key" in exc_info.value.detail

    @pytest.mark.asyncio
    async def test_hashes_key_for_lookup(self):
        """API key is hashed with SHA-256 for database lookup."""
        auth = APIKeyAuth()
        test_key = "ftxt_testkey123456"
        expected_hash = hashlib.sha256(test_key.encode()).hexdigest()

        credentials = HTTPAuthorizationCredentials(
            scheme="Bearer",
            credentials=test_key
        )

        mock_client = MagicMock()
        mock_select = mock_client.table.return_value.select.return_value
        mock_eq = mock_select.eq
        mock_eq.return_value.execute.return_value.data = []

        with patch('app.middleware.api_auth.db_config') as mock_db:
            mock_db.is_configured = True
            mock_db.client = mock_client

            with pytest.raises(HTTPException):
                await auth.verify_api_key(credentials)

            # Verify hash was used in database query
            mock_eq.assert_called_with('key_hash', expected_hash)


class TestAPIKeyStatus:
    """Test API key status validation (active, expired)."""

    @pytest.mark.asyncio
    async def test_rejects_inactive_key(self):
        """Inactive API keys return 403."""
        auth = APIKeyAuth()
        credentials = HTTPAuthorizationCredentials(
            scheme="Bearer",
            credentials="ftxt_inactivekey"
        )

        mock_client = MagicMock()
        mock_client.table.return_value.select.return_value.eq.return_value.execute.return_value.data = [{
            'id': 'key-id-123',
            'organization_id': 'org-id-456',
            'name': 'Inactive Key',
            'permissions': {'upload': True},
            'rate_limit_per_minute': 60,
            'upload_limit_per_minute': 10,
            'is_active': False,
            'expires_at': None
        }]

        with patch('app.middleware.api_auth.db_config') as mock_db:
            mock_db.is_configured = True
            mock_db.client = mock_client

            with pytest.raises(HTTPException) as exc_info:
                await auth.verify_api_key(credentials)

            assert exc_info.value.status_code == 403
            assert "inactive" in exc_info.value.detail.lower()

    @pytest.mark.asyncio
    async def test_rejects_expired_key(self):
        """Expired API keys return 403."""
        auth = APIKeyAuth()
        credentials = HTTPAuthorizationCredentials(
            scheme="Bearer",
            credentials="ftxt_expiredkey"
        )

        # Key expired yesterday
        expired_date = (datetime.utcnow() - timedelta(days=1)).isoformat() + 'Z'

        mock_client = MagicMock()
        mock_client.table.return_value.select.return_value.eq.return_value.execute.return_value.data = [{
            'id': 'key-id-123',
            'organization_id': 'org-id-456',
            'name': 'Expired Key',
            'permissions': {'upload': True},
            'rate_limit_per_minute': 60,
            'upload_limit_per_minute': 10,
            'is_active': True,
            'expires_at': expired_date
        }]

        with patch('app.middleware.api_auth.db_config') as mock_db:
            mock_db.is_configured = True
            mock_db.client = mock_client

            with pytest.raises(HTTPException) as exc_info:
                await auth.verify_api_key(credentials)

            assert exc_info.value.status_code == 403
            assert "expired" in exc_info.value.detail.lower()

    @pytest.mark.asyncio
    async def test_accepts_valid_active_key(self):
        """Valid active non-expired key returns context dict."""
        auth = APIKeyAuth()
        credentials = HTTPAuthorizationCredentials(
            scheme="Bearer",
            credentials="ftxt_validactivekey"
        )

        # Key expires in 30 days
        future_date = (datetime.utcnow() + timedelta(days=30)).isoformat() + 'Z'

        mock_client = MagicMock()
        mock_client.table.return_value.select.return_value.eq.return_value.execute.return_value.data = [{
            'id': 'key-id-123',
            'organization_id': 'org-id-456',
            'name': 'Valid Key',
            'permissions': {'upload': True, 'process': True},
            'rate_limit_per_minute': 60,
            'upload_limit_per_minute': 10,
            'is_active': True,
            'expires_at': future_date
        }]

        # Mock the update call for last_used_at
        mock_client.table.return_value.update.return_value.eq.return_value.execute.return_value = MagicMock()

        with patch('app.middleware.api_auth.db_config') as mock_db:
            mock_db.is_configured = True
            mock_db.client = mock_client

            result = await auth.verify_api_key(credentials)

            assert result['api_key_id'] == 'key-id-123'
            assert result['organization_id'] == 'org-id-456'
            assert result['permissions'] == {'upload': True, 'process': True}
            assert result['rate_limit_per_minute'] == 60
            assert result['upload_limit_per_minute'] == 10


class TestRateLimiting:
    """Test rate limiting functionality."""

    @pytest.mark.asyncio
    async def test_allows_request_under_limit(self):
        """Requests under rate limit are allowed."""
        auth = APIKeyAuth()
        api_context = {
            'api_key_id': 'key-123',
            'key_name': 'Test Key',
            'rate_limit_per_minute': 60,
            'upload_limit_per_minute': 10
        }

        mock_client = MagicMock()
        # Return count of 5 requests (under limit of 60)
        mock_client.table.return_value.select.return_value.eq.return_value.eq.return_value.gte.return_value.lte.return_value.execute.return_value.data = [
            {'request_count': 5}
        ]
        mock_client.table.return_value.insert.return_value.execute.return_value = MagicMock()
        mock_client.table.return_value.delete.return_value.lt.return_value.execute.return_value = MagicMock()

        with patch('app.middleware.api_auth.db_config') as mock_db:
            mock_db.is_configured = True
            mock_db.client = mock_client

            allowed, headers = await auth.check_rate_limit(api_context, '/api/v1/process')

            assert allowed is True
            assert 'X-RateLimit-Limit' in headers
            assert headers['X-RateLimit-Limit'] == '60'

    @pytest.mark.asyncio
    async def test_blocks_request_over_limit(self):
        """Requests over rate limit return 429."""
        auth = APIKeyAuth()
        api_context = {
            'api_key_id': 'key-123',
            'key_name': 'Test Key',
            'rate_limit_per_minute': 60,
            'upload_limit_per_minute': 10
        }

        mock_client = MagicMock()
        # Return count of 60 requests (at limit)
        mock_client.table.return_value.select.return_value.eq.return_value.eq.return_value.gte.return_value.lte.return_value.execute.return_value.data = [
            {'request_count': 60}
        ]

        with patch('app.middleware.api_auth.db_config') as mock_db:
            mock_db.is_configured = True
            mock_db.client = mock_client

            with pytest.raises(HTTPException) as exc_info:
                await auth.check_rate_limit(api_context, '/api/v1/process')

            assert exc_info.value.status_code == 429
            assert "Rate limit exceeded" in exc_info.value.detail

    @pytest.mark.asyncio
    async def test_uses_upload_limit_for_uploads(self):
        """Upload endpoints use upload_limit_per_minute."""
        auth = APIKeyAuth()
        api_context = {
            'api_key_id': 'key-123',
            'key_name': 'Test Key',
            'rate_limit_per_minute': 60,
            'upload_limit_per_minute': 10
        }

        mock_client = MagicMock()
        # Return count of 10 requests (at upload limit)
        mock_client.table.return_value.select.return_value.eq.return_value.eq.return_value.gte.return_value.lte.return_value.execute.return_value.data = [
            {'request_count': 10}
        ]

        with patch('app.middleware.api_auth.db_config') as mock_db:
            mock_db.is_configured = True
            mock_db.client = mock_client

            with pytest.raises(HTTPException) as exc_info:
                await auth.check_rate_limit(api_context, '/api/v1/process', is_upload=True)

            assert exc_info.value.status_code == 429

    @pytest.mark.asyncio
    async def test_allows_request_when_db_unavailable(self):
        """Rate limiting fails open when database is unavailable."""
        auth = APIKeyAuth()
        api_context = {
            'api_key_id': 'key-123',
            'key_name': 'Test Key',
            'rate_limit_per_minute': 60,
            'upload_limit_per_minute': 10
        }

        with patch('app.middleware.api_auth.db_config') as mock_db:
            mock_db.is_configured = False
            mock_db.client = None

            allowed, headers = await auth.check_rate_limit(api_context, '/api/v1/process')

            # Should fail open - allow the request
            assert allowed is True


class TestPermissions:
    """Test permission checking."""

    def test_has_permission_returns_true_for_granted(self):
        """Returns True when permission is granted."""
        auth = APIKeyAuth()
        api_context = {
            'permissions': {'upload': True, 'process': True, 'templates_read': True}
        }

        assert auth.has_permission(api_context, 'upload') is True
        assert auth.has_permission(api_context, 'process') is True
        assert auth.has_permission(api_context, 'templates_read') is True

    def test_has_permission_returns_false_for_missing(self):
        """Returns False when permission is not granted."""
        auth = APIKeyAuth()
        api_context = {
            'permissions': {'upload': True}
        }

        assert auth.has_permission(api_context, 'admin') is False
        assert auth.has_permission(api_context, 'delete') is False

    def test_has_permission_returns_false_for_explicitly_denied(self):
        """Returns False when permission is explicitly set to False."""
        auth = APIKeyAuth()
        api_context = {
            'permissions': {'upload': True, 'admin': False}
        }

        assert auth.has_permission(api_context, 'admin') is False

    def test_has_permission_handles_empty_permissions(self):
        """Handles empty permissions dict gracefully."""
        auth = APIKeyAuth()
        api_context = {'permissions': {}}

        assert auth.has_permission(api_context, 'upload') is False

    def test_has_permission_handles_missing_permissions_key(self):
        """Handles missing permissions key gracefully."""
        auth = APIKeyAuth()
        api_context = {}

        assert auth.has_permission(api_context, 'upload') is False


class TestRateLimitHeaders:
    """Test rate limit response headers."""

    def test_builds_correct_headers(self):
        """Builds correct rate limit headers."""
        auth = APIKeyAuth()
        reset_time = datetime(2025, 1, 1, 12, 0, 0)

        headers = auth._build_rate_limit_headers(
            limit=60,
            remaining=45,
            reset_at=reset_time
        )

        assert headers['X-RateLimit-Limit'] == '60'
        assert headers['X-RateLimit-Remaining'] == '45'
        assert '2025-01-01' in headers['X-RateLimit-Reset']


# Integration test using the global singleton
class TestGlobalSingleton:
    """Test the global api_key_auth singleton."""

    def test_singleton_exists(self):
        """Global singleton is properly instantiated."""
        assert api_key_auth is not None
        assert isinstance(api_key_auth, APIKeyAuth)

    def test_singleton_has_correct_prefix(self):
        """Singleton uses correct API key prefix."""
        assert api_key_auth.API_KEY_PREFIX == "ftxt_"
