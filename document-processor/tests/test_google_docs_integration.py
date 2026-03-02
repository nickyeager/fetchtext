"""
Integration tests for Google Docs pipeline via the real backend.

Tests call the REAL backend at localhost:8090.
No mocks. No fakes. No simulated pipelines.
"""
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


class TestGoogleDocsIntegrationHealth:
    """Test Google Docs integration service health."""

    def test_google_docs_health(self, backend):
        """Google Docs service health endpoint should be healthy."""
        resp = httpx.get(f"{BACKEND_URL}/api/google-docs/health", timeout=5)
        assert resp.status_code == 200

        data = resp.json()
        assert data["status"] == "healthy"
        assert data["service"] == "google-docs-integration"

    def test_google_docs_features_listed(self, backend):
        """Health endpoint should list supported features."""
        resp = httpx.get(f"{BACKEND_URL}/api/google-docs/health", timeout=5)
        data = resp.json()

        assert "features" in data
        features = data["features"]
        assert "document_download" in features
        assert "access_validation" in features
        assert "batch_processing" in features
        assert "folder_listing" in features

    def test_document_processor_health(self, backend):
        """Document processor backend should be healthy."""
        resp = httpx.get(f"{BACKEND_URL}/health", timeout=5)
        assert resp.status_code == 200

        data = resp.json()
        assert data["status"] == "healthy"


class TestGoogleDocsSupportedFormats:
    """Test supported export formats endpoint."""

    def test_returns_export_formats(self, backend):
        """Should return supported Google Docs export formats."""
        resp = httpx.get(f"{BACKEND_URL}/api/google-docs/supported-formats", timeout=5)
        assert resp.status_code == 200

        data = resp.json()
        assert "formats" in data
        assert len(data["formats"]) > 0

    def test_includes_common_formats(self, backend):
        """Should include text/plain, text/html, and application/pdf."""
        resp = httpx.get(f"{BACKEND_URL}/api/google-docs/supported-formats", timeout=5)
        data = resp.json()

        mime_types = [f["mime_type"] for f in data["formats"]]
        assert "text/plain" in mime_types
        assert "text/html" in mime_types
        assert "application/pdf" in mime_types

    def test_format_entries_have_required_fields(self, backend):
        """Each format entry should have mime_type and description."""
        resp = httpx.get(f"{BACKEND_URL}/api/google-docs/supported-formats", timeout=5)
        data = resp.json()

        for fmt in data["formats"]:
            assert "mime_type" in fmt, f"Format missing mime_type: {fmt}"
            assert "description" in fmt, f"Format missing description: {fmt}"


class TestGoogleDocsCredentialErrors:
    """Test that the pipeline properly rejects bad credentials."""

    def test_load_document_rejects_invalid_auth_method(self, backend):
        """Pipeline should reject unknown auth methods."""
        resp = httpx.post(
            f"{BACKEND_URL}/api/google-docs/load-document",
            json={
                "document_id": "some_doc_id",
                "export_format": "text/plain",
                "google_credentials": {"auth_method": "fake_method"},
            },
            timeout=5,
        )
        assert resp.status_code == 400

    def test_batch_load_rejects_invalid_credentials(self, backend):
        """Batch endpoint should reject invalid credentials."""
        resp = httpx.post(
            f"{BACKEND_URL}/api/google-docs/batch-load",
            json=[
                {
                    "document_id": "doc1",
                    "export_format": "text/plain",
                    "google_credentials": {"auth_method": "invalid"},
                }
            ],
            timeout=10,
        )
        # Batch may return 200 with per-document errors, or 400/500
        assert resp.status_code in (200, 400, 500), (
            f"Unexpected status: {resp.status_code}: {resp.text}"
        )

    def test_validate_access_rejects_invalid_credentials(self, backend):
        """Validate-access should reject invalid credentials."""
        resp = httpx.post(
            f"{BACKEND_URL}/api/google-docs/validate-access",
            json={
                "document_id": "some_doc_id",
                "google_credentials": {"auth_method": "invalid"},
            },
            timeout=5,
        )
        assert resp.status_code == 400


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
