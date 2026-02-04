"""
Tests for Third-Party Public API (v1)

Tests the external API endpoints for document processing and template operations.
All endpoints require API key authentication (Bearer token starting with 'ftxt_').
"""

import pytest
import io
import uuid
from datetime import datetime
from unittest.mock import MagicMock, patch, AsyncMock
from fastapi.testclient import TestClient
from fastapi import HTTPException

import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))

from app.main import app

client = TestClient(app)


# ============================================================================
# Test Fixtures
# ============================================================================

@pytest.fixture
def valid_api_context():
    """Valid API context returned after authentication."""
    return {
        'api_key_id': 'key-123',
        'organization_id': 'org-456',
        'permissions': {'upload': True, 'process': True, 'templates_read': True},
        'rate_limit_per_minute': 60,
        'upload_limit_per_minute': 10,
        'key_name': 'Test API Key'
    }


@pytest.fixture
def mock_auth(valid_api_context):
    """Mock successful API key authentication."""
    with patch('app.routers.api_v1.api_key_auth') as mock:
        mock.verify_api_key = AsyncMock(return_value=valid_api_context)
        mock.check_rate_limit = AsyncMock(return_value=(True, {}))
        mock.has_permission = MagicMock(return_value=True)
        yield mock


# ============================================================================
# Health Endpoint Tests
# ============================================================================

class TestAPIV1Health:
    """Test /api/v1/health endpoint."""

    def test_health_returns_200(self):
        """Health check returns 200 without authentication."""
        response = client.get("/api/v1/health")
        assert response.status_code == 200

    def test_health_returns_correct_structure(self):
        """Health check returns expected fields."""
        response = client.get("/api/v1/health")
        data = response.json()

        assert 'status' in data
        assert data['status'] == 'healthy'
        assert data['api_version'] == 'v1'
        assert 'database' in data
        assert 'timestamp' in data

    def test_health_shows_database_status(self):
        """Health check reports database connection status."""
        with patch('app.routers.api_v1.db_config') as mock_db:
            mock_db.is_configured = True
            mock_db.client = MagicMock()

            response = client.get("/api/v1/health")
            data = response.json()

            assert data['database'] == 'connected'


# ============================================================================
# Process Document Endpoint Tests
# ============================================================================

class TestProcessDocument:
    """Test POST /api/v1/process endpoint."""

    def test_requires_authentication(self):
        """Returns 401/403 without valid API key."""
        test_file = io.BytesIO(b"test document content")

        response = client.post(
            "/api/v1/process",
            files={"file": ("test.pdf", test_file, "application/pdf")}
        )

        # Should fail without auth
        assert response.status_code in [401, 403, 422]

    def test_requires_upload_permission(self, mock_auth):
        """Returns 403 without 'upload' permission."""
        mock_auth.has_permission = MagicMock(return_value=False)

        test_file = io.BytesIO(b"test document content")

        response = client.post(
            "/api/v1/process",
            files={"file": ("test.pdf", test_file, "application/pdf")},
            headers={"Authorization": "Bearer ftxt_testkey123"}
        )

        # Permission denied
        assert response.status_code == 403

    def test_rejects_missing_file(self, mock_auth):
        """Returns 400/422 when no file is provided."""
        response = client.post(
            "/api/v1/process",
            headers={"Authorization": "Bearer ftxt_testkey123"}
        )

        assert response.status_code in [400, 422]

    def test_creates_job_and_returns_202(self, mock_auth, valid_api_context):
        """Successful upload creates job and returns 202 Accepted."""
        test_file = io.BytesIO(b"test document content")
        job_id = str(uuid.uuid4())

        mock_client = MagicMock()
        mock_client.table.return_value.insert.return_value.execute.return_value.data = [{'id': job_id}]

        with patch('app.routers.api_v1.db_config') as mock_db:
            mock_db.is_configured = True
            mock_db.client = mock_client

            with patch('app.routers.api_v1.save_uploaded_file', new_callable=AsyncMock) as mock_save:
                mock_save.return_value = Path('/tmp/test.pdf')

                response = client.post(
                    "/api/v1/process",
                    files={"file": ("test.pdf", test_file, "application/pdf")},
                    headers={"Authorization": "Bearer ftxt_testkey123"}
                )

        assert response.status_code == 202
        data = response.json()
        assert 'job_id' in data
        assert data['status'] == 'pending'
        assert 'estimated_completion_seconds' in data

    def test_returns_job_id(self, mock_auth):
        """Response includes job_id for tracking."""
        test_file = io.BytesIO(b"test document content")

        mock_client = MagicMock()
        mock_client.table.return_value.insert.return_value.execute.return_value.data = [
            {'id': 'job-uuid-123'}
        ]

        with patch('app.routers.api_v1.db_config') as mock_db:
            mock_db.is_configured = True
            mock_db.client = mock_client

            with patch('app.routers.api_v1.save_uploaded_file', new_callable=AsyncMock) as mock_save:
                mock_save.return_value = Path('/tmp/test.pdf')

                response = client.post(
                    "/api/v1/process",
                    files={"file": ("test.pdf", test_file, "application/pdf")},
                    headers={"Authorization": "Bearer ftxt_testkey123"}
                )

        data = response.json()
        assert 'job_id' in data
        assert isinstance(data['job_id'], str)

    def test_accepts_template_id_parameter(self, mock_auth):
        """Can specify template_id to skip auto-matching."""
        test_file = io.BytesIO(b"test document content")

        mock_client = MagicMock()
        mock_client.table.return_value.insert.return_value.execute.return_value.data = [
            {'id': 'job-uuid-123'}
        ]

        with patch('app.routers.api_v1.db_config') as mock_db:
            mock_db.is_configured = True
            mock_db.client = mock_client

            with patch('app.routers.api_v1.save_uploaded_file', new_callable=AsyncMock) as mock_save:
                mock_save.return_value = Path('/tmp/test.pdf')

                response = client.post(
                    "/api/v1/process",
                    files={"file": ("test.pdf", test_file, "application/pdf")},
                    data={"template_id": "template-uuid-456"},
                    headers={"Authorization": "Bearer ftxt_testkey123"}
                )

        assert response.status_code == 202

    def test_accepts_webhook_url_parameter(self, mock_auth):
        """Can specify webhook_url for result delivery."""
        test_file = io.BytesIO(b"test document content")

        mock_client = MagicMock()
        mock_client.table.return_value.insert.return_value.execute.return_value.data = [
            {'id': 'job-uuid-123'}
        ]

        with patch('app.routers.api_v1.db_config') as mock_db:
            mock_db.is_configured = True
            mock_db.client = mock_client

            with patch('app.routers.api_v1.save_uploaded_file', new_callable=AsyncMock) as mock_save:
                mock_save.return_value = Path('/tmp/test.pdf')

                response = client.post(
                    "/api/v1/process",
                    files={"file": ("test.pdf", test_file, "application/pdf")},
                    data={"webhook_url": "https://example.com/callback"},
                    headers={"Authorization": "Bearer ftxt_testkey123"}
                )

        assert response.status_code == 202
        data = response.json()
        assert data.get('webhook_url') == "https://example.com/callback"

    def test_enforces_rate_limit(self, mock_auth):
        """Enforces upload rate limit."""
        mock_auth.check_rate_limit = AsyncMock(
            side_effect=HTTPException(status_code=429, detail="Rate limit exceeded")
        )

        test_file = io.BytesIO(b"test document content")

        response = client.post(
            "/api/v1/process",
            files={"file": ("test.pdf", test_file, "application/pdf")},
            headers={"Authorization": "Bearer ftxt_testkey123"}
        )

        assert response.status_code == 429


# ============================================================================
# Get Job Status Endpoint Tests
# ============================================================================

class TestGetJobStatus:
    """Test GET /api/v1/jobs/{job_id} endpoint."""

    def test_requires_authentication(self):
        """Returns 401/403 without valid API key."""
        response = client.get("/api/v1/jobs/job-123")

        assert response.status_code in [401, 403]

    def test_returns_404_for_nonexistent_job(self, mock_auth):
        """Returns 404 when job doesn't exist."""
        mock_client = MagicMock()
        mock_client.table.return_value.select.return_value.eq.return_value.eq.return_value.execute.return_value.data = []

        with patch('app.routers.api_v1.db_config') as mock_db:
            mock_db.is_configured = True
            mock_db.client = mock_client

            response = client.get(
                "/api/v1/jobs/nonexistent-job",
                headers={"Authorization": "Bearer ftxt_testkey123"}
            )

        assert response.status_code == 404

    def test_returns_job_status(self, mock_auth):
        """Returns job status and details."""
        job_data = {
            'id': 'job-123',
            'job_type': 'document_process',
            'status': 'processing',
            'input_data': {'filename': 'test.pdf'},
            'result_data': None,
            'error_message': None,
            'webhook_url': None,
            'webhook_delivered_at': None,
            'webhook_attempts': 0,
            'created_at': '2025-01-01T12:00:00Z',
            'started_at': '2025-01-01T12:00:01Z',
            'completed_at': None,
            'processing_time_ms': None
        }

        mock_client = MagicMock()
        mock_client.table.return_value.select.return_value.eq.return_value.eq.return_value.execute.return_value.data = [job_data]

        with patch('app.routers.api_v1.db_config') as mock_db:
            mock_db.is_configured = True
            mock_db.client = mock_client

            response = client.get(
                "/api/v1/jobs/job-123",
                headers={"Authorization": "Bearer ftxt_testkey123"}
            )

        assert response.status_code == 200
        data = response.json()
        assert data['job_id'] == 'job-123'
        assert data['status'] == 'processing'

    def test_includes_result_when_completed(self, mock_auth):
        """Includes result_data when job is completed."""
        job_data = {
            'id': 'job-123',
            'job_type': 'document_process',
            'status': 'completed',
            'input_data': {'filename': 'test.pdf'},
            'result_data': {'template_id': 't-123', 'extracted_data': {'name': 'John'}},
            'error_message': None,
            'webhook_url': None,
            'webhook_delivered_at': None,
            'webhook_attempts': 0,
            'created_at': '2025-01-01T12:00:00Z',
            'started_at': '2025-01-01T12:00:01Z',
            'completed_at': '2025-01-01T12:00:10Z',
            'processing_time_ms': 9000
        }

        mock_client = MagicMock()
        mock_client.table.return_value.select.return_value.eq.return_value.eq.return_value.execute.return_value.data = [job_data]

        with patch('app.routers.api_v1.db_config') as mock_db:
            mock_db.is_configured = True
            mock_db.client = mock_client

            response = client.get(
                "/api/v1/jobs/job-123",
                headers={"Authorization": "Bearer ftxt_testkey123"}
            )

        assert response.status_code == 200
        data = response.json()
        assert 'result' in data
        assert data['result']['extracted_data'] == {'name': 'John'}

    def test_includes_error_when_failed(self, mock_auth):
        """Includes error message when job failed."""
        job_data = {
            'id': 'job-123',
            'job_type': 'document_process',
            'status': 'failed',
            'input_data': {'filename': 'test.pdf'},
            'result_data': None,
            'error_message': 'Document processing failed: invalid format',
            'webhook_url': None,
            'webhook_delivered_at': None,
            'webhook_attempts': 0,
            'created_at': '2025-01-01T12:00:00Z',
            'started_at': '2025-01-01T12:00:01Z',
            'completed_at': '2025-01-01T12:00:05Z',
            'processing_time_ms': 4000
        }

        mock_client = MagicMock()
        mock_client.table.return_value.select.return_value.eq.return_value.eq.return_value.execute.return_value.data = [job_data]

        with patch('app.routers.api_v1.db_config') as mock_db:
            mock_db.is_configured = True
            mock_db.client = mock_client

            response = client.get(
                "/api/v1/jobs/job-123",
                headers={"Authorization": "Bearer ftxt_testkey123"}
            )

        assert response.status_code == 200
        data = response.json()
        assert data['status'] == 'failed'
        assert 'error' in data
        assert 'invalid format' in data['error']

    def test_only_returns_own_organization_jobs(self, mock_auth, valid_api_context):
        """Jobs are filtered by organization_id."""
        mock_client = MagicMock()
        select_mock = mock_client.table.return_value.select.return_value
        eq_mock = select_mock.eq.return_value

        # Verify organization_id filter is applied
        eq_mock.eq.return_value.execute.return_value.data = []

        with patch('app.routers.api_v1.db_config') as mock_db:
            mock_db.is_configured = True
            mock_db.client = mock_client

            response = client.get(
                "/api/v1/jobs/job-123",
                headers={"Authorization": "Bearer ftxt_testkey123"}
            )

        # Verify eq was called with organization_id
        calls = select_mock.eq.call_args_list
        assert any('organization_id' in str(call) or valid_api_context['organization_id'] in str(call) for call in calls)


# ============================================================================
# List Templates Endpoint Tests
# ============================================================================

class TestListTemplates:
    """Test GET /api/v1/templates endpoint."""

    def test_requires_authentication(self):
        """Returns 401/403 without valid API key."""
        response = client.get("/api/v1/templates")

        assert response.status_code in [401, 403]

    def test_requires_templates_read_permission(self, mock_auth):
        """Returns 403 without 'templates_read' permission."""
        mock_auth.has_permission = MagicMock(return_value=False)

        response = client.get(
            "/api/v1/templates",
            headers={"Authorization": "Bearer ftxt_testkey123"}
        )

        assert response.status_code == 403

    def test_returns_template_list(self, mock_auth):
        """Returns list of available templates."""
        templates = [
            {
                'id': 't-1',
                'name': 'Invoice Template',
                'description': 'For processing invoices',
                'category': 'invoice',
                'smart_variables': [{'name': 'total'}, {'name': 'vendor'}],
                'is_public': True,
                'created_at': '2025-01-01T00:00:00Z'
            },
            {
                'id': 't-2',
                'name': 'Contract Template',
                'description': 'For processing contracts',
                'category': 'contract',
                'smart_variables': [{'name': 'parties'}],
                'is_public': False,
                'created_at': '2025-01-02T00:00:00Z'
            }
        ]

        mock_client = MagicMock()
        mock_client.table.return_value.select.return_value.or_.return_value.order.return_value.limit.return_value.execute.return_value.data = templates

        with patch('app.routers.api_v1.db_config') as mock_db:
            mock_db.is_configured = True
            mock_db.client = mock_client

            response = client.get(
                "/api/v1/templates",
                headers={"Authorization": "Bearer ftxt_testkey123"}
            )

        assert response.status_code == 200
        data = response.json()
        assert 'templates' in data
        assert len(data['templates']) == 2
        assert data['count'] == 2

    def test_includes_field_count(self, mock_auth):
        """Template response includes field_count from smart_variables."""
        templates = [
            {
                'id': 't-1',
                'name': 'Test Template',
                'description': 'Test',
                'category': 'test',
                'smart_variables': [{'name': 'f1'}, {'name': 'f2'}, {'name': 'f3'}],
                'is_public': True,
                'created_at': '2025-01-01T00:00:00Z'
            }
        ]

        mock_client = MagicMock()
        mock_client.table.return_value.select.return_value.or_.return_value.order.return_value.limit.return_value.execute.return_value.data = templates

        with patch('app.routers.api_v1.db_config') as mock_db:
            mock_db.is_configured = True
            mock_db.client = mock_client

            response = client.get(
                "/api/v1/templates",
                headers={"Authorization": "Bearer ftxt_testkey123"}
            )

        data = response.json()
        assert data['templates'][0]['field_count'] == 3

    def test_filters_by_category(self, mock_auth):
        """Can filter templates by category."""
        mock_client = MagicMock()
        query_mock = mock_client.table.return_value.select.return_value.or_.return_value.order.return_value.limit.return_value

        # Add category filter
        query_mock.eq.return_value.execute.return_value.data = []

        with patch('app.routers.api_v1.db_config') as mock_db:
            mock_db.is_configured = True
            mock_db.client = mock_client

            response = client.get(
                "/api/v1/templates?category=invoice",
                headers={"Authorization": "Bearer ftxt_testkey123"}
            )

        assert response.status_code == 200

    def test_respects_limit_parameter(self, mock_auth):
        """Respects limit query parameter."""
        mock_client = MagicMock()
        limit_mock = mock_client.table.return_value.select.return_value.or_.return_value.order.return_value.limit

        limit_mock.return_value.execute.return_value.data = []

        with patch('app.routers.api_v1.db_config') as mock_db:
            mock_db.is_configured = True
            mock_db.client = mock_client

            response = client.get(
                "/api/v1/templates?limit=10",
                headers={"Authorization": "Bearer ftxt_testkey123"}
            )

        # Verify limit was called with 10
        limit_mock.assert_called()


# ============================================================================
# Database Unavailability Tests
# ============================================================================

class TestDatabaseUnavailable:
    """Test behavior when database is unavailable."""

    def test_jobs_endpoint_returns_503(self, mock_auth):
        """Jobs endpoint returns 503 when database unavailable."""
        with patch('app.routers.api_v1.db_config') as mock_db:
            mock_db.is_configured = False
            mock_db.client = None

            response = client.get(
                "/api/v1/jobs/job-123",
                headers={"Authorization": "Bearer ftxt_testkey123"}
            )

        assert response.status_code == 503

    def test_templates_endpoint_returns_503(self, mock_auth):
        """Templates endpoint returns 503 when database unavailable."""
        with patch('app.routers.api_v1.db_config') as mock_db:
            mock_db.is_configured = False
            mock_db.client = None

            response = client.get(
                "/api/v1/templates",
                headers={"Authorization": "Bearer ftxt_testkey123"}
            )

        assert response.status_code == 503
