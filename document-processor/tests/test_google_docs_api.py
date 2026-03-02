"""
Integration tests for the Google Docs API endpoints.

Tests call the REAL backend at localhost:8090.
No mocks. No fakes.
"""
import json

import pytest
import httpx

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
# Health & Info Endpoints (no credentials needed)
# =============================================================================


class TestGoogleDocsHealth:
    """Test public Google Docs API endpoints."""

    def test_health_endpoint(self, backend):
        """GET /api/google-docs/health should return service status."""
        resp = httpx.get(f"{BACKEND_URL}/api/google-docs/health", timeout=5)
        assert resp.status_code == 200

        data = resp.json()
        assert data["status"] == "healthy"
        assert data["service"] == "google-docs-integration"
        assert "features" in data
        assert len(data["features"]) > 0

    def test_supported_formats_endpoint(self, backend):
        """GET /api/google-docs/supported-formats should list export formats."""
        resp = httpx.get(f"{BACKEND_URL}/api/google-docs/supported-formats", timeout=5)
        assert resp.status_code == 200

        data = resp.json()
        assert "formats" in data
        assert len(data["formats"]) > 0

        # Check that common formats are included
        format_types = [f["mime_type"] for f in data["formats"]]
        assert "text/plain" in format_types
        assert "text/html" in format_types
        assert "application/pdf" in format_types


# =============================================================================
# Credential Validation Tests (call real backend, no Google API needed)
# =============================================================================


class TestGoogleDocsCredentialValidation:
    """Test credential validation via real API calls."""

    def test_load_document_missing_credentials(self, backend):
        """POST /api/google-docs/load-document without credentials returns 422."""
        resp = httpx.post(
            f"{BACKEND_URL}/api/google-docs/load-document",
            json={
                "document_id": "test_document_id",
                "export_format": "text/plain",
                # Missing google_credentials
            },
            timeout=5,
        )
        assert resp.status_code == 422  # Validation error

    def test_load_document_invalid_auth_method(self, backend):
        """POST /api/google-docs/load-document with invalid auth_method returns 400."""
        resp = httpx.post(
            f"{BACKEND_URL}/api/google-docs/load-document",
            json={
                "document_id": "test_document_id",
                "export_format": "text/plain",
                "google_credentials": {
                    "auth_method": "invalid_method",
                },
            },
            timeout=5,
        )
        assert resp.status_code == 400

        data = resp.json()
        assert "Invalid credentials" in data["detail"]

    def test_load_document_incomplete_oauth2(self, backend):
        """POST /api/google-docs/load-document with incomplete OAuth2 returns 400."""
        resp = httpx.post(
            f"{BACKEND_URL}/api/google-docs/load-document",
            json={
                "document_id": "test_document_id",
                "export_format": "text/plain",
                "google_credentials": {
                    "auth_method": "oauth2",
                    "client_id": "test_id",
                    # Missing client_secret
                },
            },
            timeout=5,
        )
        assert resp.status_code == 400

        data = resp.json()
        assert "OAuth2 credentials missing" in data["detail"] or "Invalid credentials" in data["detail"]

    def test_load_document_incomplete_service_account(self, backend):
        """POST /api/google-docs/load-document with incomplete service account returns 400."""
        resp = httpx.post(
            f"{BACKEND_URL}/api/google-docs/load-document",
            json={
                "document_id": "test_document_id",
                "export_format": "text/plain",
                "google_credentials": {
                    "auth_method": "service_account",
                    "service_account_email": "test@example.com",
                    # Missing service_account_key
                },
            },
            timeout=5,
        )
        assert resp.status_code == 400

        data = resp.json()
        assert "Service account credentials missing" in data["detail"] or "Invalid credentials" in data["detail"]

    def test_validate_access_missing_credentials(self, backend):
        """POST /api/google-docs/validate-access without credentials returns 422."""
        resp = httpx.post(
            f"{BACKEND_URL}/api/google-docs/validate-access",
            json={"document_id": "test_document_id"},
            timeout=5,
        )
        assert resp.status_code == 422

    def test_validate_access_invalid_auth_method(self, backend):
        """POST /api/google-docs/validate-access with invalid auth returns 400."""
        resp = httpx.post(
            f"{BACKEND_URL}/api/google-docs/validate-access",
            json={
                "document_id": "test_document_id",
                "google_credentials": {"auth_method": "invalid"},
            },
            timeout=5,
        )
        assert resp.status_code == 400


# =============================================================================
# Google Drive Service — Pure Logic Tests
# =============================================================================


class TestGoogleDriveServiceLogic:
    """Test GoogleDriveService pure logic methods (no external calls)."""

    def test_credentials_format_validation_oauth2(self):
        """Valid OAuth2 credentials should pass validation."""
        from app.services.google_drive_service import google_drive_service

        creds = {
            "auth_method": "oauth2",
            "client_id": "test_id",
            "client_secret": "test_secret",
        }
        is_valid, error = google_drive_service.validate_credentials_format(creds)
        assert is_valid is True
        assert error is None

    def test_credentials_format_validation_oauth2_missing_secret(self):
        """OAuth2 credentials missing client_secret should fail validation."""
        from app.services.google_drive_service import google_drive_service

        creds = {
            "auth_method": "oauth2",
            "client_id": "test_id",
        }
        is_valid, error = google_drive_service.validate_credentials_format(creds)
        assert is_valid is False
        assert "client_secret" in error

    def test_credentials_format_validation_service_account(self):
        """Valid service account credentials should pass validation."""
        from app.services.google_drive_service import google_drive_service

        valid_key = json.dumps({
            "type": "service_account",
            "project_id": "test-project",
            "private_key_id": "test_key_id",
            "private_key": "-----BEGIN PRIVATE KEY-----\nTEST\n-----END PRIVATE KEY-----\n",
            "client_email": "test@test.iam.gserviceaccount.com",
            "client_id": "123",
            "auth_uri": "https://accounts.google.com/o/oauth2/auth",
            "token_uri": "https://oauth2.googleapis.com/token",
        })
        creds = {
            "auth_method": "service_account",
            "service_account_email": "test@test.iam.gserviceaccount.com",
            "service_account_key": valid_key,
        }
        is_valid, error = google_drive_service.validate_credentials_format(creds)
        assert is_valid is True
        assert error is None

    def test_credentials_format_validation_service_account_invalid_json(self):
        """Service account with invalid JSON key should fail validation."""
        from app.services.google_drive_service import google_drive_service

        creds = {
            "auth_method": "service_account",
            "service_account_email": "test@example.com",
            "service_account_key": "invalid json",
        }
        is_valid, error = google_drive_service.validate_credentials_format(creds)
        assert is_valid is False
        assert "valid JSON" in error

    def test_credentials_format_validation_invalid_method(self):
        """Invalid auth method should fail validation."""
        from app.services.google_drive_service import google_drive_service

        creds = {"auth_method": "unsupported_method"}
        is_valid, error = google_drive_service.validate_credentials_format(creds)
        assert is_valid is False


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
